import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
});

export async function GET(request: NextRequest) {
  const paymentIntentId = request.nextUrl.searchParams.get('payment_intent_id');

  if (!paymentIntentId) {
    return NextResponse.json({ error: 'payment_intent_id richiesto' }, { status: 400 });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.metadata?.webhook_processed === 'true') {
      return NextResponse.json({
        success: true,
        processed: true,
        message: 'Pagamento confermato'
      });
    }

    // Payment not yet processed by webhook
    return NextResponse.json(
      { success: true, processed: false, message: 'In elaborazione' },
      { status: 202 }
    );
  } catch (error: unknown) {
    const apiError = error instanceof Error ? error : new Error('Errore sconosciuto');
    console.error('API get-resin-shipping-status error:', apiError.message);
    return NextResponse.json({ error: 'Errore nel controllo dello stato' }, { status: 500 });
  }
}
