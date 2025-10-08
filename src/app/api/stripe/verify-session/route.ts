import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateOrder } from '../../../../lib/api';

// Inizializza Stripe con la chiave segreta
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { sessionId, orderId } = data;

    if (!sessionId || !orderId) {
      console.error('Dati mancanti:', { sessionId, orderId });
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    // Recupera la sessione da Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 });
    }

    // Verifica se il pagamento è stato completato
    if (session.payment_status === 'paid') {
      // Aggiorna l'ordine in WooCommerce come pagato
      const orderData = {
        status: 'processing',
        set_paid: true,
        transaction_id: session.payment_intent as string || session.id,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateOrder(parseInt(orderId), orderData as any);

      return NextResponse.json({
        success: true,
        paymentStatus: session.payment_status,
      });
    }

    return NextResponse.json({
      success: false,
      paymentStatus: session.payment_status,
    });

  } catch (error) {
    console.error('Errore durante la verifica della sessione:', error);
    return NextResponse.json({
      error: 'Si è verificato un errore durante la verifica della sessione'
    }, { status: 500 });
  }
}
