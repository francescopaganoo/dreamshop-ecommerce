import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import api from '../../../../lib/woocommerce';
import { orderDataStore } from '../../../../lib/orderDataStore';
import { validateDepositEligibility } from '../../../../lib/deposits';

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

    // 3. CHECK PRIORITARIO: Controlla nel nostro DB se il webhook ha già creato l'ordine
    const storeResult = await orderDataStore.getByPaymentIntent(paymentIntentId);
    if (storeResult && storeResult.status === 'completed' && storeResult.wcOrderId) {
      console.log('[STRIPE-CARD] Ordine già creato dal webhook (trovato nel DB):', storeResult.wcOrderId);
      return NextResponse.json({
        success: true,
        orderId: storeResult.wcOrderId,
        alreadyExists: true
      });
    }

    // 4. Controlla anche i metadata del PI su Stripe (potrebbe essere stato aggiornato nel frattempo)
    const existingOrderId = paymentIntent.metadata?.order_id;
    if (existingOrderId) {
      console.log('[STRIPE-CARD] Ordine già esistente nei metadata Stripe:', existingOrderId);
      return NextResponse.json({
        success: true,
        orderId: parseInt(existingOrderId),
        alreadyExists: true
      });
    }

    // 5. Controllo idempotenza: cerca ordini esistenti in WooCommerce
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
          console.log('[STRIPE-CARD] Ordine già esistente in WooCommerce:', paymentIntentId, '-> orderId:', existingOrder.id);

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

    // 6. Nessun ordine trovato, recupera i dati dallo store per crearlo
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

    const { orderData, pointsToRedeem } = storedData;
    const typedOrderData = orderData as Record<string, unknown>;

    // 6. Prepara i dati dell'ordine WooCommerce
    const userId = (typedOrderData.customer_id as number) || 0;

    // NOTA: Lo sconto punti è già incluso nelle fee_lines di orderData dal checkout
    // Usiamo direttamente le fee_lines senza aggiungere duplicati
    const feeLines = (typedOrderData.fee_lines as Array<{name: string; total: string; tax_class?: string; tax_status?: string}>) || [];

    // Controlla se ci sono prodotti con acconto nei line_items
    const lineItems = (typedOrderData.line_items as Array<{
      product_id: number;
      quantity: number;
      meta_data?: Array<{key: string; value: string}>;
    }>) || [];

    const hasDeposit = lineItems.some(item =>
      item.meta_data?.some(meta => meta.key === '_wc_convert_to_deposit' && meta.value === 'yes')
    );

    // ========================================================================
    // VALIDAZIONE DEPOSITI - Gli ordini a rate richiedono autenticazione
    // ========================================================================
    const depositValidation = validateDepositEligibility({
      userId,
      hasDeposit,
      context: 'stripe-create-order-after-card-payment'
    });

    if (!depositValidation.isValid) {
      console.error(`[stripe-create-order-after-card-payment] Ordine a rate bloccato: userId=${userId}, hasDeposit=${hasDeposit}`);
      return NextResponse.json({
        error: depositValidation.error,
        errorCode: depositValidation.errorCode
      }, { status: 403 });
    }
    // ========================================================================

    // Log dettagliato per debug
    console.log(`[STRIPE-CARD] Ordine contiene acconti: ${hasDeposit}`);
    console.log(`[STRIPE-CARD] Line items count: ${lineItems.length}`);
    lineItems.forEach((item, index) => {
      console.log(`[STRIPE-CARD] Item ${index}: product_id=${item.product_id}, meta_data=`, JSON.stringify(item.meta_data || []));
    });

    const orderDataToSend = {
      ...typedOrderData,
      customer_id: userId,
      payment_method: 'stripe',
      payment_method_title: 'Carta di Credito (Stripe)',
      set_paid: true,
      // BUGFIX: Per ordini con acconto, impostare direttamente 'partial-payment'
      // per evitare ritardi causati dagli hook WP
      status: hasDeposit ? 'partial-payment' : 'processing',
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

      // 10. Marca come completato nello store (NON eliminare)
      await orderDataStore.markCompleted(dataId, {
        wcOrderId: wooOrder.id,
        paymentIntentId
      });

      // 11. Decrementa i punti dell'utente se sono stati usati per lo sconto
      if (pointsToRedeem > 0 && userId > 0) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';
          const apiKey = process.env.POINTS_API_KEY;

          if (apiKey) {
            const deductResponse = await fetch(`${baseUrl}/wp-json/dreamshop-points/v1/points/deduct-only`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
              },
              body: JSON.stringify({
                user_id: userId,
                points: pointsToRedeem,
                order_id: wooOrder.id,
                description: `Punti utilizzati per sconto ordine #${wooOrder.id}`
              })
            });

            const deductResult = await deductResponse.json();
            if (deductResponse.ok && deductResult.success) {
              console.log(`[STRIPE-CARD] Punti decrementati: userId=${userId}, points=${pointsToRedeem}, newBalance=${deductResult.new_balance}`);
            } else {
              console.error('[STRIPE-CARD] Errore nel decremento punti:', deductResult);
            }
          }
        } catch (pointsError) {
          console.error('[STRIPE-CARD] Errore nel decremento punti:', pointsError);
        }
      }

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
