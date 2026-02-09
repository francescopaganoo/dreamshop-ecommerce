import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { orderDataStore } from '../../../../lib/orderDataStore';

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

    // 1. Cerca prima nel nostro DB (più veloce e affidabile di Stripe)
    const storeResult = await orderDataStore.getByPaymentIntent(paymentIntentId);

    if (storeResult) {
      if (storeResult.status === 'completed' && storeResult.wcOrderId) {
        console.log('[GET-ORDER] Ordine trovato nel DB:', storeResult.wcOrderId);
        return NextResponse.json({
          success: true,
          orderId: storeResult.wcOrderId,
          paymentStatus: 'succeeded'
        });
      }
      console.log(`[GET-ORDER] Record trovato nel DB ma status=${storeResult.status}, wcOrderId=${storeResult.wcOrderId} (in attesa del webhook)`);
    }

    // 2. Fallback: controlla i metadata del Payment Intent su Stripe
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const orderId = paymentIntent.metadata?.order_id;

      if (orderId) {
        console.log('[GET-ORDER] Ordine trovato nei metadata Stripe:', orderId);
        return NextResponse.json({
          success: true,
          orderId: parseInt(orderId),
          paymentStatus: paymentIntent.status
        });
      }
    } catch (stripeError) {
      console.error('[GET-ORDER] Errore recupero da Stripe:', stripeError);
    }

    // 3. Ordine non ancora creato
    console.log('[GET-ORDER] Ordine non ancora creato dal webhook');
    return NextResponse.json({
      success: false,
      message: 'Ordine non ancora pronto',
      paymentStatus: 'succeeded'
    }, { status: 202 }); // 202 Accepted - processing

  } catch (error) {
    console.error('[GET-ORDER] Errore:', error);
    return NextResponse.json({
      error: 'Errore durante il recupero dell\'ordine',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
