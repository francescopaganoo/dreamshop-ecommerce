import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({
        error: 'Session ID mancante'
      }, { status: 400 });
    }

    
    // Recupera la sessione da Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json({
        error: 'Sessione non trovata'
      }, { status: 404 });
    }

    // Verifica se il webhook ha già creato l'ordine
    const orderId = session.metadata?.order_id;
    const webhookProcessed = session.metadata?.webhook_processed === 'true';

    
    return NextResponse.json({
      orderId: orderId ? parseInt(orderId) : null,
      webhookProcessed,
      paymentStatus: session.payment_status
    });

  } catch (error) {
    console.error('[CHECK-SESSION] Errore:', error);
    return NextResponse.json({
      error: 'Errore interno del server'
    }, { status: 500 });
  }
}
