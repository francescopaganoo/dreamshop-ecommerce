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
        status: paymentIntent.status,
        metadata: paymentIntent.metadata
      });

      // Verifica se l'ordine esiste già nei metadata
      if (paymentIntent.metadata?.order_id) {
        console.log('[WEBHOOK] Ordine già esistente nel Payment Intent:', paymentIntent.metadata.order_id);
        return NextResponse.json({ received: true, message: 'Ordine già esistente' });
      }


      // Gestisce Payment Intent da Apple/Google Pay (payment_request_cart e payment_request)
      const paymentSource = paymentIntent.metadata?.payment_source;
      if (paymentSource === 'payment_request_cart' || paymentSource === 'payment_request') {
        const wcOrderId = paymentIntent.metadata?.wc_order_id;

        if (!wcOrderId) {
          console.error('[WEBHOOK] Payment Request: wc_order_id mancante nei metadata');
          return NextResponse.json({ received: true, error: 'Order ID mancante' });
        }


        try {
          // Aggiorna l'ordine WooCommerce esistente come pagato
          await api.put(`orders/${wcOrderId}`, {
            status: 'processing',
            set_paid: true,
            transaction_id: paymentIntent.id,
            meta_data: [
              {
                key: '_webhook_updated',
                value: 'true'
              },
              {
                key: '_webhook_update_time',
                value: new Date().toISOString()
              }
            ]
          });

          // Aggiorna Payment Intent per evitare duplicati
          await stripe.paymentIntents.update(paymentIntent.id, {
            metadata: {
              ...paymentIntent.metadata,
              order_id: wcOrderId,
              webhook_processed: 'true'
            }
          });

          return NextResponse.json({ received: true, message: 'Ordine aggiornato' });

        } catch (error) {
          console.error('[WEBHOOK] Errore aggiornamento ordine Payment Request:', error);
          return NextResponse.json({ received: true, error: 'Errore aggiornamento ordine' });
        }
      }

      // Verifica se abbiamo i dati dell'ordine nello store (per pagamenti Stripe normali)
      const orderDataId = paymentIntent.metadata?.order_data_id;
      if (!orderDataId) {
        console.log('[WEBHOOK] Nessun order_data_id nei metadata, skip');
        return NextResponse.json({ received: true, message: 'Nessun dato ordine' });
      }

      // Recupera i dati dell'ordine dallo store
      const storedData = orderDataStore.get(orderDataId);

      if (!storedData) {
        console.error('[WEBHOOK] Dati ordine non trovati o scaduti');
        return NextResponse.json({ received: true, error: 'Dati ordine non trovati' });
      }

      const { orderData, pointsToRedeem, pointsDiscount } = storedData;

      // Elimina i dati dallo store dopo il recupero
      orderDataStore.delete(orderDataId);


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

        console.log(`[WEBHOOK] Ordine WooCommerce ${wooOrder.id} creato con successo da payment_intent ${paymentIntent.id}`);

        // Aggiorna il Payment Intent con l'order_id
        await stripe.paymentIntents.update(paymentIntent.id, {
          metadata: {
            ...paymentIntent.metadata,
            order_id: String(wooOrder.id),
            webhook_processed: 'true'
          }
        });

        // Riscatta i punti se necessario
        if (pointsToRedeem > 0) {
          try {
            const customerId = (baseOrderData.customer_id as number) || 0;

            if (customerId) {
              console.log(`[WEBHOOK] Riscatto ${pointsToRedeem} punti per utente ${customerId}, ordine #${wooOrder.id}`);

              // Chiama l'API interna per riscattare i punti
              const pointsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/points/redeem`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId: customerId,
                  points: pointsToRedeem,
                  orderId: wooOrder.id,
                  internal: true // Flag per indicare chiamata interna dal webhook
                }),
              });

              if (pointsResponse.ok) {
                console.log('[WEBHOOK] Punti riscattati con successo');
              } else {
                console.error('[WEBHOOK] Errore nel riscatto punti:', await pointsResponse.text());
              }
            }
          } catch (pointsError) {
            console.error('[WEBHOOK] Errore durante il riscatto dei punti:', pointsError);
            // Non blocchiamo il webhook se il riscatto punti fallisce
          }
        }

      } catch (error) {
        console.error('[WEBHOOK] Errore durante la creazione dell\'ordine da payment_intent:', error);
        return NextResponse.json({ received: true, error: 'Errore creazione ordine' });
      }
    }
    else if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;



      // Controlla se è un pagamento che richiede creazione ordine (Klarna, Stripe, Satispay senza order_id preesistente)
      const paymentMethod = session.metadata?.payment_method;
      const hasOrderId = !!session.metadata?.order_id;

      if ((paymentMethod === 'klarna' || paymentMethod === 'stripe' || paymentMethod === 'satispay') && !hasOrderId) {

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


          // Recupera i dati completi dallo store in memoria
          const storedData = orderDataStore.get(orderDataId);

          if (!storedData) {
            console.error('[WEBHOOK] Impossibile recuperare i dati dell\'ordine');
            return NextResponse.json({ received: true, error: 'Dati ordine non trovati o scaduti' });
          }

          const { orderData, pointsDiscount } = storedData;

          // Elimina i dati dallo store dopo il recupero (uso singolo)
          orderDataStore.delete(orderDataId);



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

          // Salva l'order_id nei metadata della sessione per riferimento futuro
          await stripe.checkout.sessions.update(session.id, {
            metadata: {
              ...session.metadata,
              order_id: String(wooOrder.id),
              webhook_processed: 'true'
            }
          });


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

      }
    }
    
    return NextResponse.json({ received: true });
    
  } catch (error) {
    console.error('Errore durante la gestione del webhook Stripe:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
