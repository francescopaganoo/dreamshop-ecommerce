import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createOrder } from '../../../../lib/api';

// Interfaccia per l'aggiornamento dell'ordine
interface OrderUpdateData {
  set_paid: boolean;
  payment_method: string;
  payment_method_title: string;
  meta_data: Array<{
    key: string;
    value: string;
  }>;
}

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
    
    const { paymentMethodId, amount, customerInfo, line_items, shipping, notes } = data;
    
    if (!paymentMethodId || !amount || !customerInfo || !line_items) {
      console.error('Dati mancanti per l\'ordine iOS');
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }
    
    // Crea un ordine in WooCommerce
    const orderData = {
      payment_method: 'stripe',
      payment_method_title: 'Carta di Credito (Stripe)',
      set_paid: false,
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
      ]
    };
    
    console.log('Creazione ordine in WooCommerce per iOS...');
    const order = await createOrder(orderData);
    
    if (!order || typeof order !== 'object' || !('id' in order)) {
      throw new Error('Errore nella creazione dell\'ordine');
    }
    
    console.log(`Ordine creato con successo: ${order.id}`);
    
    // Crea un payment intent e conferma direttamente con il payment method
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      payment_method: paymentMethodId,
      payment_method_types: ['card'],
      confirm: true, // Conferma immediatamente
      metadata: {
        order_id: typeof order.id === 'number' ? order.id.toString() : String(order.id),
        platform: 'ios'
      }
    });
    
    console.log(`Payment Intent creato e confermato: ${paymentIntent.id}, status: ${paymentIntent.status}`);
    
    // Gestisci i diversi stati del payment intent
    if (paymentIntent.status === 'succeeded') {
      try {
        // Importa direttamente la funzione per aggiornare l'ordine
        const { updateOrder } = await import('../../../../lib/api');
        
        // Aggiorna l'ordine direttamente
        const orderId = typeof order.id === 'number' ? order.id : Number(order.id);
        const orderUpdateData: OrderUpdateData = {
          set_paid: true,
          payment_method: 'stripe',
          payment_method_title: 'Carta di Credito (Stripe)',
          meta_data: [
            {
              key: 'payment_intent_id',
              value: paymentIntent.id
            }
          ]
        };
        
        await updateOrder(orderId, orderUpdateData);
        
        console.log('Ordine aggiornato come pagato');
      } catch (updateError) {
        console.error('Errore durante l\'aggiornamento dell\'ordine:', updateError);
        // Continuiamo comunque, l'ordine è stato creato e il pagamento è andato a buon fine
      }
    } else if (paymentIntent.status === 'requires_action') {
      // Il pagamento richiede un'azione aggiuntiva (3D Secure)
      console.log('Il pagamento richiede autenticazione 3D Secure');
      
      // Restituisci le informazioni necessarie per completare l'autenticazione
      return NextResponse.json({
        requires_action: true,
        payment_intent_client_secret: paymentIntent.client_secret,
        orderId: typeof order.id === 'number' ? order.id.toString() : String(order.id)
      });
    }
    
    return NextResponse.json({ 
      success: true,
      orderId: typeof order.id === 'number' ? order.id.toString() : String(order.id),
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