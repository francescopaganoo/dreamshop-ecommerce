import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

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
    const orderId = searchParams.get('order_id');
    const amount = searchParams.get('amount');

    if (!orderId || !amount) {
      console.error('Parametri mancanti:', { orderId, amount });
      return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
    }

    // Ottieni l'origine in modo sicuro
    let origin = request.headers.get('origin');
    if (!origin) {
      // Fallback se l'origine non è disponibile
      origin = request.headers.get('referer')?.replace(/\/[^/]*$/, '') || 'https://your-domain.com';
    }


    // Crea la sessione di checkout Stripe con solo Satispay
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['satispay'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Ordine #${orderId}`,
              description: 'Acquisto su DreamShop',
            },
            unit_amount: parseInt(amount),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/checkout/success?order_id=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?canceled=true`,
      metadata: {
        order_id: orderId,
        payment_method: 'satispay'
      },
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