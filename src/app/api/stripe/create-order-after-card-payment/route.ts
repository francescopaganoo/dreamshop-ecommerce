import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import api from '../../../../lib/woocommerce';
import { orderDataStore } from '../../../../lib/orderDataStore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Crea l'ordine WooCommerce dopo il pagamento con carta Stripe
 * Usato come fallback quando il webhook non funziona
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { paymentIntentId } = data;

    if (!paymentIntentId) {
      return NextResponse.json({
        error: 'Payment Intent ID mancante'
      }, { status: 400 });
    }

    console.log('[STRIPE-CARD] Creazione ordine per Payment Intent:', paymentIntentId);

    // 1. Recupera e verifica il Payment Intent da Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (!paymentIntent) {
      return NextResponse.json({
        error: 'Payment Intent non trovato'
      }, { status: 404 });
    }

    // 2. Verifica che il pagamento sia stato completato
    if (paymentIntent.status !== 'succeeded') {
      console.error('[STRIPE-CARD] Pagamento non completato. Status:', paymentIntent.status);
      return NextResponse.json({
        error: 'Pagamento non completato',
        paymentStatus: paymentIntent.status
      }, { status: 400 });
    }

    // 3. Controlla se l'ordine è già stato creato (dal webhook)
    const existingOrderId = paymentIntent.metadata?.order_id;
    if (existingOrderId) {
      console.log('[STRIPE-CARD] Ordine già esistente:', existingOrderId);
      return NextResponse.json({
        success: true,
        orderId: parseInt(existingOrderId),
        alreadyExists: true
      });
    }

    // 4. Controllo idempotenza: cerca ordini esistenti con questo payment_intent_id
    try {
      const recentOrders = await api.get('orders', {
        per_page: 20,
        orderby: 'date',
        order: 'desc'
      });

      if (recentOrders.data && Array.isArray(recentOrders.data)) {
        interface WooOrderMeta {
          id: number;
          key: string;
          value: string;
        }
        interface WooOrderCheck {
          id: number;
          status: string;
          meta_data: WooOrderMeta[];
        }

        const existingOrder = (recentOrders.data as WooOrderCheck[]).find((order: WooOrderCheck) =>
          order.meta_data?.some((meta: WooOrderMeta) =>
            meta.key === '_stripe_payment_intent_id' && meta.value === paymentIntentId
          )
        );

        if (existingOrder) {
          console.log('[STRIPE-CARD] Ordine già esistente per paymentIntentId:', paymentIntentId, '-> orderId:', existingOrder.id);

          // Aggiorna i metadata del Payment Intent
          await stripe.paymentIntents.update(paymentIntentId, {
            metadata: {
              ...paymentIntent.metadata,
              order_id: existingOrder.id.toString()
            }
          });

          return NextResponse.json({
            success: true,
            orderId: existingOrder.id,
            status: existingOrder.status,
            alreadyExists: true
          });
        }
      }
    } catch (checkError) {
      console.error('[STRIPE-CARD] Errore nel controllo ordine esistente:', checkError);
    }

    // 5. Recupera i dati dell'ordine dallo store MySQL
    const dataId = paymentIntent.metadata?.order_data_id;
    if (!dataId) {
      return NextResponse.json({
        error: 'Dati ordine non trovati nei metadata del Payment Intent'
      }, { status: 400 });
    }

    const storedData = await orderDataStore.get(dataId);
    if (!storedData) {
      return NextResponse.json({
        error: 'Dati ordine non trovati o scaduti nello store'
      }, { status: 404 });
    }

    const { orderData, pointsToRedeem, pointsDiscount } = storedData;
    const typedOrderData = orderData as Record<string, unknown>;

    // 6. Prepara i dati dell'ordine WooCommerce
    const userId = (typedOrderData.customer_id as number) || 0;

    // NOTA: Lo sconto punti è già incluso nelle fee_lines di orderData dal checkout
    // Usiamo direttamente le fee_lines senza aggiungere duplicati
    const feeLines = (typedOrderData.fee_lines as Array<{name: string; total: string; tax_class?: string; tax_status?: string}>) || [];

    const orderDataToSend = {
      ...typedOrderData,
      customer_id: userId,
      payment_method: 'stripe',
      payment_method_title: 'Carta di Credito (Stripe)',
      set_paid: true,
      status: 'processing',
      transaction_id: paymentIntentId,
      meta_data: [
        ...((typedOrderData.meta_data as Array<{key: string; value: string}>) || []),
        {
          key: '_stripe_payment_intent_id',
          value: paymentIntentId
        },
        {
          key: '_stripe_data_id',
          value: dataId
        },
        {
          key: '_payment_method',
          value: 'stripe'
        },
        {
          key: '_dreamshop_points_assigned',
          value: 'yes'
        }
      ],
      fee_lines: feeLines.length > 0 ? feeLines : undefined
    };

    // 7. Crea l'ordine in WooCommerce
    try {
      const response = await api.post('orders', orderDataToSend);
      const order = response.data;

      if (!order || typeof order !== 'object' || !('id' in order)) {
        throw new Error('Risposta non valida dalla creazione dell\'ordine');
      }

      interface WooOrder {
        id: number;
        status?: string;
      }

      const wooOrder = order as WooOrder;

      console.log('[STRIPE-CARD] Ordine creato con successo:', wooOrder.id);

      // 8. Aggiorna i metadata del Payment Intent con l'ID ordine
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: {
          ...paymentIntent.metadata,
          order_id: wooOrder.id.toString()
        }
      });

      // 9. Aggiungi nota all'ordine
      try {
        await api.post(`orders/${wooOrder.id}/notes`, {
          note: `Ordine creato via fallback (webhook non disponibile). Payment Intent: ${paymentIntentId}`,
          customer_note: false
        });
      } catch (noteError) {
        console.error('[STRIPE-CARD] Errore aggiunta nota:', noteError);
      }

      // 10. Cancella i dati temporanei
      await orderDataStore.delete(dataId);

      return NextResponse.json({
        success: true,
        orderId: wooOrder.id,
        status: wooOrder.status || 'processing',
        pointsToRedeem: pointsToRedeem || 0
      });

    } catch (wooError) {
      console.error('[STRIPE-CARD] Errore creazione ordine WooCommerce:', wooError);
      return NextResponse.json({
        error: 'Errore durante la creazione dell\'ordine',
        details: wooError
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[STRIPE-CARD] Errore generale:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
