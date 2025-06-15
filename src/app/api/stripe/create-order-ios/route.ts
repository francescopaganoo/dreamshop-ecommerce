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
    
    const { paymentMethodId, amount, customerInfo, line_items, shipping, notes, token } = data;
    
    // Recupera l'ID utente dal token JWT (simile agli altri endpoint)
    let userId = 0;
    if (token) {
      try {
        // Verifica il token e ottieni l'ID utente
        const validateResponse = await fetch(`${process.env.NEXT_PUBLIC_WORDPRESS_URL}/wp-json/jwt-auth/v1/token/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (validateResponse.ok) {
          const userData = await validateResponse.json();
          if (userData && userData.data && userData.data.id) {
            userId = parseInt(userData.data.id, 10);
            console.log(`iOS: Utente autenticato con ID ${userId}`);
          }
        } else {
          console.log('iOS: Token non valido o scaduto');
        }
      } catch (authError) {
        console.error('iOS: Errore durante la verifica del token:', authError);
        // Continuamo comunque, nel peggiore dei casi l'ordine sarà come guest
      }
    }
    
    if (!paymentMethodId || !amount || !customerInfo || !line_items) {
      console.error('Dati mancanti per l\'ordine iOS');
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }
    
    // Crea un ordine in WooCommerce
    const orderData = {
      payment_method: 'stripe',
      payment_method_title: 'Carta di Credito (Stripe)',
      set_paid: false,
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
        
        console.log('Ordine aggiornato come pagato per l\'utente ID:', userId);
          // L'ordine è ora completato e i punti verranno assegnati automaticamente
          // perché abbiamo correttamente impostato customer_id
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