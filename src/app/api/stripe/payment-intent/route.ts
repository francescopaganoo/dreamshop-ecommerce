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

    const { amount, orderId, paymentMethod } = data;

    if (!amount) {
      console.error('Dati mancanti:', { amount });
      return NextResponse.json({ error: 'Amount mancante' }, { status: 400 });
    }

    // Prepara i metadati
    const metadata: Record<string, string> = {
      platform: typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'other'
    };

    // Aggiungi orderId ai metadati solo se presente
    if (orderId) {
      metadata.order_id = orderId.toString();
    }

    // Aggiungi paymentMethod ai metadati se presente (per Satispay)
    if (paymentMethod) {
      metadata.payment_method = paymentMethod;
    }

    // Configurazione per pagamenti standard (non Payment Request)
    // Apple Pay e Google Pay sono gestiti separatamente tramite Payment Request API
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'eur',
      // Supporto per carte di credito e Klarna
      payment_method_types: ['card', 'klarna'],
      metadata,
      // Opzioni di base per il pagamento con carta
      payment_method_options: {
        card: {
          // Richiedi 3D Secure solo quando necessario
          request_three_d_secure: 'automatic'
        }
      }
    });
    
    
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
