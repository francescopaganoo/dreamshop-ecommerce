import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import api from '../../../../lib/woocommerce';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { sessionId, orderData } = data;

    if (!sessionId || !orderData) {
      return NextResponse.json({
        error: 'Dati mancanti. Sono richiesti sessionId e orderData'
      }, { status: 400 });
    }

    // Recupera la sessione da Stripe per verificare il pagamento
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 });
    }

    // Verifica se il pagamento è stato completato
    if (session.payment_status !== 'paid') {
      return NextResponse.json({
        error: 'Pagamento non completato',
        paymentStatus: session.payment_status
      }, { status: 400 });
    }

    const userId = orderData.customer_id || 0;

    // Prepara i dati dell'ordine WooCommerce con status "processing" e set_paid true
    const orderDataToSend = {
      ...orderData,
      customer_id: userId,
      payment_method: 'satispay',
      payment_method_title: 'Satispay',
      set_paid: true, // L'ordine è già pagato
      status: 'processing', // Lo stato è processing perché il pagamento è completato
      transaction_id: (session.payment_intent as string) || session.id,
      meta_data: [
        ...(orderData.meta_data || []),
        {
          key: '_stripe_session_id',
          value: sessionId
        },
        {
          key: '_stripe_payment_intent',
          value: (session.payment_intent as string) || sessionId
        },
        {
          key: '_dreamshop_points_assigned',
          value: 'yes'
        }
      ]
    };

    console.log('Creazione ordine WooCommerce dopo pagamento Satispay:', {
      customer_id: userId,
      session_id: sessionId,
      payment_status: session.payment_status,
      status: 'processing',
      set_paid: true
    });

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

      console.log(`Ordine WooCommerce ${wooOrder.id} creato con successo dopo pagamento Satispay ${sessionId}`);

      return NextResponse.json({
        success: true,
        orderId: wooOrder.id,
        status: wooOrder.status || 'processing'
      });

    } catch (wooError) {
      console.error('Errore durante la creazione dell\'ordine in WooCommerce:', wooError);
      return NextResponse.json({
        error: 'Errore durante la creazione dell\'ordine',
        details: wooError
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Errore nella richiesta:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
