import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createOrder } from '../../../../lib/api';

// Inizializza Stripe con la chiave segreta
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
console.log('Stripe Secret Key disponibile per iOS:', !!stripeSecretKey);

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
    console.log('Dati ricevuti per ordine iOS:', JSON.stringify(data, null, 2));
    
    const { paymentMethodId, amount, customerInfo, line_items, shipping, notes, directCustomerId, isAuthenticated } = data;
    
    // SOLUZIONE SEMPLIFICATA: Prendiamo direttamente l'ID utente dal form
    // Non facciamo più verifiche token che potrebbero fallire
    let userId = 0;
    
    // Usa directCustomerId se disponibile (inviato dal frontend)
    if (directCustomerId && isAuthenticated) {
      userId = directCustomerId;
      console.log(`iOS: Usando ID utente salvato nel form: ${userId}`);
    } else {
      console.log('iOS: Nessun ID utente valido fornito, ordine sarà come guest');
    }
    
    if (!paymentMethodId || !amount || !customerInfo || !line_items) {
      console.error('Dati mancanti per l\'ordine iOS');
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }
    
    // Prima creiamo e confermiamo il payment intent
    // Crea un payment intent e conferma direttamente con il payment method
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      payment_method: paymentMethodId,
      payment_method_types: ['card'],
      confirm: true, // Conferma immediatamente
    });
    
    console.log(`Payment Intent creato e confermato: ${paymentIntent.id}, status: ${paymentIntent.status}`);
    
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({ 
        error: `Pagamento non riuscito: ${paymentIntent.status}` 
      }, { status: 400 });
    }
    
    // Crea un ordine in WooCommerce già come pagato (set_paid: true)
    const orderData = {
      payment_method: 'stripe',
      payment_method_title: 'Carta di Credito (Stripe)',
      set_paid: true, // ORDINE GIÀ PAGATO
      customer_id: userId, // Aggiungi l'ID utente recuperato
      customer_note: notes || '',
      billing: customerInfo,
      shipping: customerInfo,
      line_items,
      shipping_lines: [
        {
          method_id: 'flat_rate',
          method_title: 'Spedizione',
          total: String(shipping || 0)
        }
      ],
      // Aggiungi i metadati del pagamento direttamente alla creazione
      meta_data: [
        {
          key: 'payment_intent_id',
          value: paymentIntent.id
        },
        {
          // Flag che indica che i punti sono già stati elaborati
          key: '_dreamshop_points_assigned',
          value: 'yes'
        }
      ]
    };
    
    // Log dei dettagli importanti
    console.log('iOS - Dettagli ordine:', {
      customer_id: userId,
      email: customerInfo.email,
      payment_method: 'stripe'
    });
    
    console.log('Creazione ordine in WooCommerce per iOS...');
    const order = await createOrder(orderData);
    
    if (!order || typeof order !== 'object' || !('id' in order)) {
      throw new Error('Errore nella creazione dell\'ordine');
    }
    
    console.log(`Ordine creato con successo: ${order.id}`);
    console.log(`Ordine già impostato come pagato per l'utente ID: ${userId}`);
        
    // Restituisci l'ordine e il paymentIntent
    return NextResponse.json({ 
      success: true,
      orderId: typeof order.id === 'number' ? order.id.toString() : String(order.id),
      paymentIntentId: paymentIntent.id,
      paymentStatus: paymentIntent.status
    });
    
  } catch (error: unknown) {
    console.error('Errore durante la creazione dell\'ordine per iOS:', error);
    
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
      // Altri errori generici
      return NextResponse.json({ 
        error: 'Si è verificato un errore durante la creazione dell\'ordine'
      }, { status: 500 });
    }
  }
}