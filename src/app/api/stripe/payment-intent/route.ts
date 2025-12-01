import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { orderDataStore } from '../../../../lib/orderDataStore';

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

    const { amount, orderId, paymentMethod, orderData, pointsToRedeem, pointsDiscount, description } = data;

    if (!amount) {
      console.error('Dati mancanti:', { amount });
      return NextResponse.json({ error: 'Amount mancante' }, { status: 400 });
    }

    // Prepara i metadati
    const metadata: Record<string, string> = {
      platform: typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'other',
      payment_method: paymentMethod || 'stripe' // Default a stripe se non specificato
    };

    // Se abbiamo i dati dell'ordine, salvali nello store per il webhook
    if (orderData) {
      const dataId = orderDataStore.generateId();
      const saved = await orderDataStore.set(dataId, {
        orderData,
        pointsToRedeem: pointsToRedeem || 0,
        pointsDiscount: pointsDiscount || 0
      });

      if (!saved) {
        console.error('[PAYMENT-INTENT] Errore nel salvataggio dati ordine');
        return NextResponse.json({ error: 'Errore nel salvataggio dei dati dell\'ordine' }, { status: 500 });
      }

      metadata.order_data_id = dataId;
      console.log('[PAYMENT-INTENT] Dati ordine salvati nello store con ID:', dataId);
    }

    // Aggiungi orderId ai metadati solo se presente (per ordini già creati)
    if (orderId) {
      metadata.order_id = orderId.toString();
    }

    // Configurazione per pagamenti standard (non Payment Request)
    // Apple Pay e Google Pay sono gestiti separatamente tramite Payment Request API
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'eur',
      // Supporto per carte di credito e Klarna
      payment_method_types: ['card', 'klarna'],
      description: description || 'Payment for DreamShop18', // Descrizione che apparirà nella dashboard Stripe
      metadata,
      // Opzioni di base per il pagamento con carta
      payment_method_options: {
        card: {
          // Richiedi 3D Secure solo quando necessario
          request_three_d_secure: 'automatic'
        }
      }
    });

    console.log('[PAYMENT-INTENT] Payment Intent creato:', paymentIntent.id);

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
