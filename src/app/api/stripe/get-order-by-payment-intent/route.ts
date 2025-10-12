import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentIntentId = searchParams.get('payment_intent_id');

    if (!paymentIntentId) {
      return NextResponse.json({
        error: 'Payment Intent ID mancante'
      }, { status: 400 });
    }

    console.log('[GET-ORDER] Recupero ordine per Payment Intent:', paymentIntentId);

    // Recupera il Payment Intent da Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verifica se il webhook ha già creato l'ordine
    const orderId = paymentIntent.metadata?.order_id;

    if (!orderId) {
      console.log('[GET-ORDER] Ordine non ancora creato dal webhook');
      return NextResponse.json({
        success: false,
        message: 'Ordine non ancora pronto',
        paymentStatus: paymentIntent.status
      }, { status: 202 }); // 202 Accepted - processing
    }

    console.log('[GET-ORDER] Ordine trovato:', orderId);

    return NextResponse.json({
      success: true,
      orderId: parseInt(orderId),
      paymentStatus: paymentIntent.status
    });

  } catch (error) {
    console.error('[GET-ORDER] Errore:', error);
    return NextResponse.json({
      error: 'Errore durante il recupero dell\'ordine',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
