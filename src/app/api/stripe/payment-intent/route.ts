import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Inizializza Stripe con la chiave segreta
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
console.log('Stripe Secret Key disponibile:', !!stripeSecretKey);

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
    console.log('Dati ricevuti per payment intent:', JSON.stringify(data, null, 2));
    
    const { amount, orderId } = data;
    
    if (!amount || !orderId) {
      console.error('Dati mancanti:', { amount, orderId });
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }
    
    // Configurazione per pagamenti standard (non Payment Request)
    // Apple Pay e Google Pay sono gestiti separatamente tramite Payment Request API
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'eur',
      // Per i pagamenti standard usiamo solo carte
      payment_method_types: ['card'],
      metadata: {
        order_id: orderId.toString(),
        platform: typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'other'
      },
      // Opzioni di base per il pagamento con carta
      payment_method_options: {
        card: {
          // Richiedi 3D Secure solo quando necessario
          request_three_d_secure: 'automatic'
        }
      }
    });
    
    console.log(`Payment Intent creato con successo: ${paymentIntent.id}`);
    
    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
    
  } catch (error) {
    console.error('Errore durante la creazione del payment intent:', error);
    return NextResponse.json({ 
      error: 'Si è verificato un errore durante la creazione del payment intent' 
    }, { status: 500 });
  }
}
