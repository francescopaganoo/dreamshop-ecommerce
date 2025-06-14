import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateOrder } from '../../../../lib/api';

// Inizializza Stripe con la chiave segreta
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Webhook secret per verificare la firma
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Disabilita il parser del corpo per i webhook Stripe
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: NextRequest) {
  try {
    // Ottieni il corpo della richiesta come buffer
    const chunks: Buffer[] = [];
    // ReadableStream type for request.body
    const readableStream = request.body as ReadableStream<Uint8Array>;
    const reader = readableStream.getReader();
    
    let done = false;
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        chunks.push(Buffer.from(value));
      }
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');
    
    // Ottieni la firma Stripe dall'header
    const signature = request.headers.get('stripe-signature');
    
    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: 'Firma mancante o webhook secret non configurato' }, { status: 400 });
    }
    
    // Verifica l'evento
    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      console.error(`Errore di verifica della firma: ${errorMessage}`);
      return NextResponse.json({ error: `Errore di verifica della firma: ${errorMessage}` }, { status: 400 });
    }
    
    // Gestisci l'evento
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Ottieni l'ID dell'ordine dai metadati
      const orderId = session.metadata?.order_id;
      
      if (orderId) {
        // Aggiorna l'ordine in WooCommerce come pagato
        // Nota: possiamo usare solo le proprietà definite in OrderData
        await updateOrder(parseInt(orderId), {
          set_paid: true,
          // Aggiorniamo anche il metodo di pagamento per includere l'ID della transazione
          payment_method: 'stripe',
          payment_method_title: `Stripe (Payment Intent: ${session.payment_intent})`,
        });
        
        console.log(`Ordine ${orderId} aggiornato come pagato`);
      }
    }
    
    return NextResponse.json({ received: true });
    
  } catch (error) {
    console.error('Errore durante la gestione del webhook Stripe:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
