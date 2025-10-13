import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Inizializza Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
});

/**
 * Endpoint pubblico per verificare lo stato di un pagamento rata tramite Payment Intent
 * Simile a get-order-by-payment-intent ma specifico per rate pianificate
 *
 * Query params:
 * - payment_intent_id: ID del Payment Intent da verificare
 *
 * Risponde con:
 * - 200: { success: true, processed: true } se il webhook ha processato
 * - 202: { success: false, processed: false } se il webhook non ha ancora processato
 * - 400: { error: string } se mancano parametri
 * - 404: { error: string } se il Payment Intent non esiste
 * - 500: { error: string } per errori server
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentIntentId = searchParams.get('payment_intent_id');

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'payment_intent_id è richiesto' },
        { status: 400 }
      );
    }

    // Recupera il Payment Intent da Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verifica che sia un pagamento rata
    if (paymentIntent.metadata?.type !== 'scheduled_payment') {
      return NextResponse.json(
        { error: 'Payment Intent non è un pagamento rata' },
        { status: 400 }
      );
    }

    // Verifica se il webhook ha processato il pagamento
    const webhookProcessed = paymentIntent.metadata?.webhook_processed === 'true';

    if (webhookProcessed) {
      // Webhook ha completato il processing
      return NextResponse.json({
        success: true,
        processed: true,
        orderId: paymentIntent.metadata?.order_id || null
      });
    } else {
      // Webhook non ha ancora processato (stato 202 = Accepted, in elaborazione)
      return NextResponse.json({
        success: false,
        processed: false,
        message: 'Pagamento in elaborazione'
      }, { status: 202 });
    }
  } catch (error: unknown) {
    // Gestione errori Stripe
    if (error && typeof error === 'object' && 'type' in error && 'code' in error) {
      const stripeError = error as { type: string; code?: string; message?: string };

      if (stripeError.type === 'StripeInvalidRequestError' || stripeError.code === 'resource_missing') {
        return NextResponse.json(
          { error: 'Payment Intent non trovato' },
          { status: 404 }
        );
      }
    }

    console.error('[GET-SCHEDULED-ORDER-STATUS] Errore:', error);
    return NextResponse.json(
      { error: 'Errore durante il recupero dello stato del pagamento' },
      { status: 500 }
    );
  }
}
