import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { assertStockAvailable, renewReservation, extractItemsFromOrderData, extractReservationToken } from '@/lib/stock-guard';

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
    const { amount, orderData, pointsToRedeem, pointsDiscount } = data;

    // ========================================================================
    // CONTROLLO DISPONIBILITÀ - ultimo blocco prima di incassare
    // Klarna crea l'ordine dal webhook a pagamento avvenuto: dopo di qui
    // fermarsi significherebbe rimborsare.
    // ========================================================================
    if (orderData) {
      const stockItems = extractItemsFromOrderData(orderData);
      const reservationToken = extractReservationToken(orderData);

      if (stockItems.length > 0) {
        if (reservationToken) {
          await renewReservation(reservationToken, 'stripe-checkout-klarna');
        }

        const stockCheck = await assertStockAvailable({
          items: stockItems,
          context: 'stripe-checkout-klarna',
          excludeToken: reservationToken,
        });

        if (!stockCheck.ok) {
          console.warn('[KLARNA] Disponibilità insufficiente: sessione di pagamento non aperta');
          return NextResponse.json({
            error: stockCheck.message,
            errorCode: 'INSUFFICIENT_STOCK',
            unavailable: stockCheck.unavailable,
          }, { status: 409 });
        }
      }
    }
    // ========================================================================

    if (!amount) {
      console.error('Parametri mancanti:', { amount });
      return NextResponse.json({ error: 'Parametro amount mancante' }, { status: 400 });
    }

    // Ottieni l'origine in modo sicuro
    let origin = request.headers.get('origin');
    if (!origin) {
      // Fallback se l'origine non è disponibile
      origin = request.headers.get('referer')?.replace(/\/[^/]*$/, '') || 'https://your-domain.com';
    }


    // Salva i dati dell'ordine nel nostro store temporaneo (i metadata Stripe hanno limite di 500 caratteri)
    const storeResponse = await fetch(`${origin}/api/stripe/store-order-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderData,
        pointsToRedeem: pointsToRedeem || 0,
        pointsDiscount: pointsDiscount || 0
      }),
    });

    if (!storeResponse.ok) {
      throw new Error('Errore nel salvataggio dei dati dell\'ordine');
    }

    const { dataId } = await storeResponse.json();

    // Prepara i metadata con solo l'ID di riferimento (molto più piccolo)
    const metadata: Record<string, string> = {
      payment_method: 'klarna',
      order_data_id: dataId
    };

    // Crea la sessione di checkout Stripe con solo Klarna
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['klarna'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Ordine DreamShop',
              description: 'Acquisto su DreamShop con Klarna',
            },
            unit_amount: parseInt(amount),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&payment_method=klarna`,
      cancel_url: `${origin}/checkout?canceled=true`,
      metadata,
      locale: 'it'
    });


    // Ritorna l'URL della sessione
    return NextResponse.json({
      url: session.url,
      sessionId: session.id
    });

  } catch (error: unknown) {
    console.error('Errore durante la creazione della sessione Klarna:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Si è verificato un errore durante la creazione della sessione di pagamento Klarna'
    }, { status: 500 });
  }
}