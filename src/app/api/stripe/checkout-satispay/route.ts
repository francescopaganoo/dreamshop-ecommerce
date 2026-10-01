import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { orderDataStore } from '@/lib/orderDataStore';
import { renewReservation, extractReservationToken } from '@/lib/stock-guard';
import { CHECKOUT_RESERVATION_TTL_MINUTES, checkoutSessionExpiresAt } from '@/lib/checkout-session-window';

// Inizializza Stripe con la chiave segreta
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY non è configurata nelle variabili d\'ambiente');
}

const stripe = new Stripe(stripeSecretKey || '');

export async function GET(request: NextRequest) {
  try {
    if (!stripeSecretKey) {
      console.error('Impossibile procedere: STRIPE_SECRET_KEY mancante');
      return NextResponse.json({ error: 'Configurazione Stripe mancante' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const amount = searchParams.get('amount');
    const description = searchParams.get('description');
    const dataId = searchParams.get('dataId'); // ID dei dati salvati nello store

    if (!amount || !dataId) {
      console.error('Parametri mancanti:', { amount, dataId });
      return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
    }

    // Usa la descrizione passata o un fallback
    const orderDescription = description || 'Ordine DreamShop';

    
    // Ottieni l'origine in modo sicuro
    let origin = request.headers.get('origin');
    if (!origin) {
      // Fallback se l'origine non è disponibile
      origin = request.headers.get('referer')?.replace(/\/[^/]*$/, '') || 'https://your-domain.com';
    }


    // Il pezzo resta riservato per tutta la finestra in cui la sessione e' pagabile.
    // store-order-data ha appena rinnovato la prenotazione con la durata
    // predefinita (15 min), piu' corta della sessione. Non blocca il pagamento:
    // se il rinnovo fallisce la disponibilita' e' gia' stata verificata.
    const storedOrder = await orderDataStore.get(dataId);
    const reservationToken = storedOrder ? extractReservationToken(storedOrder.orderData) : '';
    if (reservationToken) {
      await renewReservation(reservationToken, 'stripe-checkout-satispay', CHECKOUT_RESERVATION_TTL_MINUTES);
    }

    // Crea la sessione di checkout Stripe con solo Satispay
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['satispay'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: orderDescription,
              description: 'Acquisto su DreamShop',
            },
            unit_amount: parseInt(amount),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&payment_method=satispay`,
      cancel_url: `${origin}/checkout?canceled=true`,
      metadata: {
        payment_method: 'satispay',
        order_data_id: dataId,
        order_description: orderDescription
      },
      // Scade prima dei dati dell'ordine: vedi checkout-session-window.ts
      expires_at: checkoutSessionExpiresAt(),
      locale: 'it'
    });

    

    // Reindirizza direttamente alla sessione di checkout
    return NextResponse.redirect(session.url!);

  } catch (error: unknown) {
    console.error('Errore durante la creazione della sessione Satispay:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Si è verificato un errore durante la creazione della sessione di pagamento Satispay'
    }, { status: 500 });
  }
}