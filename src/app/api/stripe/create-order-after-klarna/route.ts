import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';
import Stripe from 'stripe';
import { orderDataStore } from '../../../../lib/orderDataStore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { sessionId, orderData, pointsToRedeem, pointsDiscount } = data;

    if (!sessionId || !orderData) {
      return NextResponse.json({
        error: 'Session ID o dati ordine mancanti'
      }, { status: 400 });
    }


    // Recupera la sessione da Stripe per verificare il pagamento
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json({
        error: 'Sessione non trovata'
      }, { status: 404 });
    }

    // Verifica che il pagamento sia stato completato
    if (session.payment_status !== 'paid') {
      return NextResponse.json({
        error: 'Pagamento non completato',
        paymentStatus: session.payment_status
      }, { status: 400 });
    }

    // Controllo idempotenza: verifica se esiste già un ordine con questa session
    try {
      // Cerca ordini recenti e verifica i metadata manualmente
      // (WooCommerce REST API non supporta filtro diretto per meta_key/meta_value)
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
        interface WooOrder {
          id: number;
          status: string;
          meta_data: WooOrderMeta[];
        }

        const existingOrder = (recentOrders.data as WooOrder[]).find((order: WooOrder) =>
          order.meta_data?.some((meta: WooOrderMeta) =>
            meta.key === '_stripe_session_id' && meta.value === sessionId
          )
        );

        if (existingOrder) {
          console.log('[KLARNA] Ordine già esistente per session:', sessionId, '- Order ID:', existingOrder.id);
          return NextResponse.json({
            success: true,
            orderId: existingOrder.id,
            status: existingOrder.status,
            pointsToRedeem: pointsToRedeem || 0,
            alreadyExists: true
          });
        }
      }
    } catch (checkError) {
      console.error('[KLARNA] Errore nel controllo ordine esistente:', checkError);
      // Continua comunque, meglio rischiare un duplicato che non creare l'ordine
    }

    // Prepara i dati dell'ordine WooCommerce con status "processing" e set_paid true
    const orderDataToSend = {
      ...orderData,
      payment_method: 'klarna',
      payment_method_title: 'Klarna',
      set_paid: true, // L'ordine è già pagato
      status: 'processing', // Lo stato è processing perché il pagamento è completato
      transaction_id: session.payment_intent as string || session.id,
      meta_data: [
        ...(orderData.meta_data || []),
        {
          key: '_stripe_session_id',
          value: session.id
        },
        {
          key: '_stripe_payment_intent_id',
          value: session.payment_intent as string || ''
        }
      ]
    };

    // Aggiungi fee_lines per gli sconti se presenti
    if (pointsDiscount > 0) {
      orderDataToSend.fee_lines = [
        ...(orderDataToSend.fee_lines || []),
        {
          name: 'Sconto Punti DreamShop',
          total: String(-pointsDiscount),
          tax_class: '',
          tax_status: 'none'
        }
      ];
    }



    // Crea l'ordine in WooCommerce
    try {
      const response = await api.post('orders', orderDataToSend);

      const order = response.data;

      if (!order || typeof order !== 'object' || !('id' in order)) {
        throw new Error('Risposta non valida dalla creazione dell\'ordine');
      }

      interface WooOrder {
        id: number;
        total?: string;
        status?: string;
      }

      const wooOrder = order as WooOrder;

      // Cancella i dati temporanei dallo store WordPress/MySQL
      const orderDataId = session.metadata?.order_data_id;
      if (orderDataId) {
        await orderDataStore.delete(orderDataId);
        console.log('[KLARNA] Dati temporanei eliminati:', orderDataId);
      }

      return NextResponse.json({
        success: true,
        orderId: wooOrder.id,
        status: wooOrder.status || 'processing',
        pointsToRedeem: pointsToRedeem || 0
      });

    } catch (wooError) {
      console.error('[KLARNA] Errore durante la creazione dell\'ordine in WooCommerce:', wooError);
      return NextResponse.json({
        error: 'Errore durante la creazione dell\'ordine',
        details: wooError
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[KLARNA] Errore nella richiesta:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
