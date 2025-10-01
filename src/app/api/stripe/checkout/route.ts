import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createOrder } from '../../../../lib/api';

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
    
    const { cartItems, customerInfo, notes } = data;
    
    if (!cartItems || !customerInfo) {
      console.error('Dati mancanti:', { cartItems: !!cartItems, customerInfo: !!customerInfo });
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }
    
    // Define interface for cart items
    interface CartItem {
      id: string | number;
      quantity: number;
    }
    
    // Crea l'ordine in WooCommerce con stato "pending"
    // Trasforma i cartItems nel formato corretto per WooCommerce
    const line_items = cartItems.map((item: CartItem) => ({
      product_id: typeof item.id === 'string' ? parseInt(item.id) || 0 : item.id || 0,
      quantity: item.quantity
    }));
    
    
    const orderData = {
      payment_method: 'stripe',
      payment_method_title: 'Carta di Credito (Stripe)',
      set_paid: false, // L'ordine sarà impostato come pagato dopo la conferma di Stripe
      customer_note: notes || '',
      billing: customerInfo,
      shipping: customerInfo,
      line_items: line_items
    };
    
    // Define interface for order response
    interface OrderResponse {
      id: number;
      number?: string;
      status?: string;
    }
    
    // Crea l'ordine in WooCommerce
    const order = await createOrder(orderData) as OrderResponse;
    
    if (!order || !order.id) {
      throw new Error('Errore nella creazione dell\'ordine');
    }
    
    // Define interface for cart items with product details
    interface ProductCartItem extends CartItem {
      name?: string;
      price: string | number;
      description?: string;
      images?: Array<{src?: string}>;
    }
    
    // Prepara gli elementi per la sessione Stripe
    const lineItems = cartItems.map((item: ProductCartItem) => {
      const price = typeof item.price === 'string' ? parseFloat(item.price) || 0 : item.price || 0;
      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.name || 'Prodotto',
            description: item.description || '',
            images: item.images && item.images[0]?.src ? [item.images[0].src] : [],
          },
          unit_amount: Math.round(price * 100), // Converti in centesimi
        },
        quantity: item.quantity,
      };
    });
    
    // Aggiungi la spedizione come elemento separato
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: {
          name: 'Spedizione',
          description: 'Costo di spedizione standard',
        },
        unit_amount: 599, // €5.99 in centesimi
      },
      quantity: 1,
    });
    
    // Rileva se la richiesta proviene da iOS/Safari
    const userAgent = request.headers.get('user-agent') || '';
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    
    // Ottieni l'origine in modo sicuro
    let origin = request.headers.get('origin');
    if (!origin) {
      // Fallback se l'origine non è disponibile
      origin = request.headers.get('referer')?.replace(/\/[^/]*$/, '') || 'https://your-domain.com';
    }
    

    
    // Crea la sessione di checkout Stripe con configurazioni ottimizzate per iOS
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'klarna'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/checkout/success?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?canceled=true`,
      metadata: {
        order_id: order.id.toString(),
        is_ios: isIOS ? 'true' : 'false'
      },
      // Impostazioni aggiuntive per migliorare la compatibilità con iOS
      ...(isIOS && {
        locale: 'it', // Imposta la lingua per evitare problemi di localizzazione
        payment_method_options: {
          card: {
            // Disabilita il salvataggio della carta per semplificare il flusso
            setup_future_usage: undefined
          }
        }
      })
    });
    
    return NextResponse.json({ sessionId: session.id, url: session.url });
    
  } catch (error: unknown) {
    console.error('Errore durante la creazione della sessione Stripe:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Si è verificato un errore durante la creazione della sessione di pagamento' 
    }, { status: 500 });
  }
}
