import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Inizializza Stripe con la chiave segreta
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY non è configurata nelle variabili d\'ambiente');
}

const stripe = new Stripe(stripeSecretKey || '');

export async function POST(request: NextRequest) {
  try {
    if (!stripeSecretKey) {
      console.error('Impossibile procedere: STRIPE_SECRET_KEY mancante');
      return NextResponse.json({ error: 'Configurazione Stripe mancante' }, { status: 500 });
    }
    
    const data = await request.json();
    
    const { paymentIntentId, orderId } = data;
    
    if (!paymentIntentId || !orderId) {
      console.error('Dati mancanti per la conferma del pagamento');
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }
    
    // Conferma il pagamento intent
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
    
    
    if (paymentIntent.status === 'succeeded') {
      // Aggiorna l'ordine come pagato
      await fetch(`${request.nextUrl.origin}/api/stripe/update-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          paymentIntentId
        }),
      });
      
      
      return NextResponse.json({
        success: true,
        paymentStatus: paymentIntent.status
      });
    } else if (paymentIntent.status === 'requires_action') {
      // Richiede ancora un'azione (potrebbe essere necessaria un'ulteriore autenticazione)
      return NextResponse.json({
        requires_action: true,
        payment_intent_client_secret: paymentIntent.client_secret
      });
    } else {
      // Altri stati (processing, requires_payment_method, ecc.)
      return NextResponse.json({
        success: false,
        paymentStatus: paymentIntent.status,
        message: 'Pagamento in elaborazione o non completato'
      });
    }
    
  } catch (error: unknown) {
    console.error('Errore durante la conferma del pagamento:', error);
    
    // Gestisci errori specifici di Stripe
    if (error instanceof Stripe.errors.StripeCardError) {
      return NextResponse.json({ 
        error: error.message || 'La carta è stata rifiutata.'
      }, { status: 400 });
    } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      // Errori di richiesta non valida
      return NextResponse.json({ 
        error: 'Configurazione di pagamento non valida. Contatta l\'assistenza.'
      }, { status: 400 });
    } else {
      // Altri errori genericici
      return NextResponse.json({ 
        error: 'Si è verificato un errore durante la conferma del pagamento'
      }, { status: 500 });
    }
  }
}

