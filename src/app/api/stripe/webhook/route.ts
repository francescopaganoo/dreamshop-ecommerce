import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateOrder } from '../../../../lib/api';
import api from '../../../../lib/woocommerce';
import { orderDataStore } from '../../../../lib/orderDataStore';

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
    
    // Gestisci gli eventi
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      console.log('[WEBHOOK] payment_intent.succeeded ricevuto:', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        status: paymentIntent.status
      });

      // Aspetta un po' per dare tempo al frontend di aggiornare il Payment Intent
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Ricarica il Payment Intent per vedere se nel frattempo è stato aggiornato dal frontend
      const refreshedPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);

      // Verifica se l'ordine esiste già (creato dal frontend)
      if (refreshedPaymentIntent.metadata?.order_id) {
        console.log('[WEBHOOK] Ordine già esistente (creato dal frontend):', refreshedPaymentIntent.metadata.order_id);
        return NextResponse.json({ received: true, message: 'Ordine già esistente' });
      }

      console.log('[WEBHOOK] Nessun ordine esistente, procedo con creazione dal webhook');

      // Verifica se abbiamo i dati dell'ordine nello store
      const orderDataId = paymentIntent.metadata?.order_data_id;
      if (!orderDataId) {
        console.log('[WEBHOOK] Nessun order_data_id nei metadata, skip');
        return NextResponse.json({ received: true, message: 'Nessun dato ordine' });
      }

      console.log('[WEBHOOK] Recupero dati ordine con ID:', orderDataId);

      // Recupera i dati dell'ordine dallo store
      const storedData = orderDataStore.get(orderDataId);

      if (!storedData) {
        console.error('[WEBHOOK] Dati ordine non trovati o scaduti');
        return NextResponse.json({ received: true, error: 'Dati ordine non trovati' });
      }

      const { orderData, pointsDiscount } = storedData;

      // Elimina i dati dallo store dopo il recupero
      orderDataStore.delete(orderDataId);

      console.log('[WEBHOOK] Creazione ordine da payment_intent.succeeded');

      // Type-safe spread
      const baseOrderData = orderData as Record<string, unknown>;

      // Prepara i dati dell'ordine WooCommerce
      const orderDataToSend: Record<string, unknown> = {
        ...baseOrderData,
        payment_method: 'stripe',
        payment_method_title: 'Carta di Credito (Stripe)',
        set_paid: true,
        status: 'processing',
        transaction_id: paymentIntent.id,
        meta_data: [
          ...(baseOrderData.meta_data as unknown[] || []),
          {
            key: '_stripe_payment_intent_id',
            value: paymentIntent.id
          },
          {
            key: '_webhook_created',
            value: 'true'
          },
          {
            key: '_webhook_type',
            value: 'payment_intent'
          }
        ]
      };

      // Aggiungi fee_lines per gli sconti se presenti
      if (pointsDiscount > 0) {
        orderDataToSend.fee_lines = [
          ...(orderDataToSend.fee_lines as unknown[] || []),
          {
            name: 'Sconto Punti DreamShop',
            total: String(-pointsDiscount),
            tax_class: '',
            tax_status: 'none'
          }
        ];
      }

      try {
        // Crea l'ordine in WooCommerce
        const response = await api.post('orders', orderDataToSend);
        const order = response.data;

        if (!order || typeof order !== 'object' || !('id' in order)) {
          throw new Error('Risposta non valida dalla creazione dell\'ordine');
        }

        interface WooOrder {
          id: number;
          total?: string;
          status?: string;
        }

        const wooOrder = order as WooOrder;
        console.log(`[WEBHOOK] Ordine WooCommerce ${wooOrder.id} creato con successo dal webhook (payment_intent)`);

        // Aggiorna il Payment Intent con l'order_id
        await stripe.paymentIntents.update(paymentIntent.id, {
          metadata: {
            ...paymentIntent.metadata,
            order_id: String(wooOrder.id),
            webhook_processed: 'true'
          }
        });

        console.log('[WEBHOOK] Payment Intent aggiornato con order_id:', wooOrder.id);

      } catch (error) {
        console.error('[WEBHOOK] Errore durante la creazione dell\'ordine da payment_intent:', error);
        return NextResponse.json({ received: true, error: 'Errore creazione ordine' });
      }
    }
    else if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('[WEBHOOK] checkout.session.completed ricevuto:', {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        paymentMethod: session.metadata?.payment_method
      });

      // Controlla se è un pagamento che richiede creazione ordine (Klarna, Stripe, Satispay senza order_id preesistente)
      const paymentMethod = session.metadata?.payment_method;
      const hasOrderId = !!session.metadata?.order_id;

      if ((paymentMethod === 'klarna' || paymentMethod === 'stripe' || paymentMethod === 'satispay') && !hasOrderId) {
        console.log(`[WEBHOOK] Pagamento ${paymentMethod} completato, creazione ordine WooCommerce...`);

        // Verifica che il pagamento sia stato completato
        if (session.payment_status !== 'paid') {
          console.error('[WEBHOOK] Pagamento non completato:', session.payment_status);
          return NextResponse.json({ received: true, error: 'Pagamento non completato' });
        }

        try {
          // Recupera l'ID dei dati dell'ordine dai metadata
          const orderDataId = session.metadata?.order_data_id;

          if (!orderDataId) {
            console.error('[WEBHOOK] ID dati ordine mancante nei metadata');
            return NextResponse.json({ received: true, error: 'ID dati ordine mancante' });
          }

          console.log('[WEBHOOK] Recupero dati ordine con ID:', orderDataId);

          // Recupera i dati completi dallo store in memoria
          const storedData = orderDataStore.get(orderDataId);

          if (!storedData) {
            console.error('[WEBHOOK] Impossibile recuperare i dati dell\'ordine');
            return NextResponse.json({ received: true, error: 'Dati ordine non trovati o scaduti' });
          }

          const { orderData, pointsToRedeem, pointsDiscount } = storedData;

          // Elimina i dati dallo store dopo il recupero (uso singolo)
          orderDataStore.delete(orderDataId);

          console.log('[WEBHOOK] Dati ordine recuperati:', {
            customerId: (orderData as { customer_id?: number }).customer_id,
            pointsToRedeem,
            pointsDiscount
          });

          // Determina il titolo del metodo di pagamento
          let paymentMethodTitle = 'Pagamento Online';
          if (paymentMethod === 'klarna') {
            paymentMethodTitle = 'Klarna';
          } else if (paymentMethod === 'stripe') {
            paymentMethodTitle = 'Carta di Credito (Stripe)';
          } else if (paymentMethod === 'satispay') {
            paymentMethodTitle = 'Satispay';
          }

          // Type-safe spread
          const baseOrderData2 = orderData as Record<string, unknown>;

          // Prepara i dati dell'ordine WooCommerce
          const orderDataToSend: Record<string, unknown> = {
            ...baseOrderData2,
            payment_method: paymentMethod,
            payment_method_title: paymentMethodTitle,
            set_paid: true,
            status: 'processing',
            transaction_id: session.payment_intent as string || session.id,
            meta_data: [
              ...(baseOrderData2.meta_data as unknown[] || []),
              {
                key: '_stripe_session_id',
                value: session.id
              },
              {
                key: '_stripe_payment_intent_id',
                value: session.payment_intent as string || ''
              },
              {
                key: '_webhook_created',
                value: 'true'
              }
            ]
          };

          // Aggiungi fee_lines per gli sconti se presenti
          if (pointsDiscount > 0) {
            orderDataToSend.fee_lines = [
              ...(orderDataToSend.fee_lines as unknown[] || []),
              {
                name: 'Sconto Punti DreamShop',
                total: String(-pointsDiscount),
                tax_class: '',
                tax_status: 'none'
              }
            ];
          }

          console.log('[WEBHOOK] Creazione ordine WooCommerce:', {
            customer_id: orderDataToSend.customer_id,
            payment_intent_id: session.payment_intent,
            session_id: session.id,
            status: 'processing',
            set_paid: true,
            pointsToRedeem,
            pointsDiscount
          });

          // Crea l'ordine in WooCommerce
          const response = await api.post('orders', orderDataToSend);
          const order = response.data;

          if (!order || typeof order !== 'object' || !('id' in order)) {
            throw new Error('Risposta non valida dalla creazione dell\'ordine');
          }

          interface WooOrder {
            id: number;
            total?: string;
            status?: string;
          }

          const wooOrder = order as WooOrder;
          console.log(`[WEBHOOK] Ordine WooCommerce ${wooOrder.id} creato con successo dal webhook (${paymentMethod})`);

          // Salva l'order_id nei metadata della sessione per riferimento futuro
          await stripe.checkout.sessions.update(session.id, {
            metadata: {
              ...session.metadata,
              order_id: String(wooOrder.id),
              webhook_processed: 'true'
            }
          });

          console.log('[WEBHOOK] Metadata sessione aggiornati con order_id:', wooOrder.id);

        } catch (error) {
          console.error(`[WEBHOOK] Errore durante la creazione dell'ordine ${paymentMethod}:`, error);
          // Non restituiamo un errore a Stripe, altrimenti ritenterà
          return NextResponse.json({ received: true, error: 'Errore creazione ordine' });
        }
      }
      // Gestione ordini normali (con order_id preesistente)
      else if (session.metadata?.order_id) {
        const orderId = session.metadata.order_id;

        // Aggiorna l'ordine in WooCommerce come pagato
        await updateOrder(parseInt(orderId), {
          set_paid: true,
          payment_method: 'stripe',
          payment_method_title: `Stripe (Payment Intent: ${session.payment_intent})`,
        });

        console.log(`[WEBHOOK] Ordine ${orderId} aggiornato come pagato`);
      }
    }
    
    return NextResponse.json({ received: true });
    
  } catch (error) {
    console.error('Errore durante la gestione del webhook Stripe:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
