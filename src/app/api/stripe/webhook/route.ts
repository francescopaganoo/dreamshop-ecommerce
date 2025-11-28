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
    console.log(`[WEBHOOK] Event received: ${event.type} (ID: ${event.id})`);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      console.log('[WEBHOOK] payment_intent.succeeded ricevuto:', {
        paymentIntentId: paymentIntent.id,
        amount: (paymentIntent.amount / 100).toFixed(2) + ' EUR',
        status: paymentIntent.status,
        paymentSource: paymentIntent.metadata?.payment_source || 'unknown',
        wcOrderId: paymentIntent.metadata?.wc_order_id || 'not set',
        orderDataId: paymentIntent.metadata?.order_data_id || 'not set',
        metadata: paymentIntent.metadata
      });

      // NUOVO: Gestione pagamenti rate pianificate
      if (paymentIntent.metadata?.type === 'scheduled_payment') {
        console.log('[WEBHOOK] Pagamento rata pianificata rilevato:', paymentIntent.metadata);

        const orderId = paymentIntent.metadata.order_id;
        const userId = paymentIntent.metadata.user_id;

        if (!orderId) {
          console.error('[WEBHOOK] order_id mancante nei metadata del pagamento rata');
          return NextResponse.json({ received: true, error: 'Order ID mancante' });
        }

        // Verifica se già processato (per evitare duplicati in caso di retry Stripe)
        if (paymentIntent.metadata?.webhook_processed === 'true') {
          console.log('[WEBHOOK] Rata già processata in precedenza, skip');
          return NextResponse.json({ received: true, message: 'Rata già processata' });
        }

        try {
          // Aggiorna l'ordine WooCommerce della rata come pagato
          await api.put(`orders/${orderId}`, {
            status: 'processing',
            set_paid: true,
            payment_method: 'stripe',
            payment_method_title: 'Carta di Credito/Debito (Stripe)',
            transaction_id: paymentIntent.id,
            meta_data: [
              {
                key: '_wc_deposits_payment_completed',
                value: 'yes'
              },
              {
                key: '_transaction_id',
                value: paymentIntent.id
              },
              {
                key: '_payment_method',
                value: 'stripe'
              },
              {
                key: '_payment_method_title',
                value: 'Carta di Credito/Debito (Stripe)'
              },
              {
                key: '_webhook_updated',
                value: 'true'
              },
              {
                key: '_webhook_update_time',
                value: new Date().toISOString()
              },
              {
                key: '_stripe_payment_intent_id',
                value: paymentIntent.id
              }
            ]
          });

          // Aggiorna Payment Intent per prevenire riutilizzo
          await stripe.paymentIntents.update(paymentIntent.id, {
            metadata: {
              ...paymentIntent.metadata,
              webhook_processed: 'true',
              webhook_processed_at: new Date().toISOString()
            }
          });

          console.log(`[WEBHOOK] Rata #${orderId} aggiornata con successo per utente ${userId}`);
          return NextResponse.json({ received: true, message: 'Rata aggiornata' });

        } catch (error) {
          console.error('[WEBHOOK] Errore aggiornamento rata pianificata:', error);
          return NextResponse.json({ received: true, error: 'Errore aggiornamento rata' });
        }
      }

      // Verifica se l'ordine esiste già nei metadata (per ordini normali, non rate)
      // Le rate hanno metadata.type === 'scheduled_payment' e vengono gestite sopra
      if (paymentIntent.metadata?.order_id && !paymentIntent.metadata?.type) {
        console.log('[WEBHOOK] Ordine normale già esistente nel Payment Intent:', paymentIntent.metadata.order_id);

        // Verifica e aggiorna transaction_id per ordini iOS
        if (paymentIntent.metadata?.is_ios_checkout === 'true') {
          const orderId = paymentIntent.metadata.order_id;

          try {
            const { data: order } = await api.get(`orders/${orderId}`) as { data: { transaction_id?: string; id: number } };

            // Aggiorna transaction_id se mancante
            if (!order.transaction_id || order.transaction_id !== paymentIntent.id) {
              await api.put(`orders/${orderId}`, {
                transaction_id: paymentIntent.id,
                meta_data: [
                  {
                    key: '_stripe_payment_intent_id',
                    value: paymentIntent.id
                  },
                  {
                    key: '_webhook_updated_transaction_id',
                    value: 'true'
                  }
                ]
              });

              return NextResponse.json({
                received: true,
                message: 'Ordine iOS aggiornato',
                order_id: orderId
              });
            }

            return NextResponse.json({
              received: true,
              message: 'Ordine iOS completo'
            });
          } catch (error) {
            console.error('[WEBHOOK] Errore verifica ordine iOS:', error);
            return NextResponse.json({
              received: true,
              message: 'Ordine iOS processato con warning'
            });
          }
        }

        return NextResponse.json({ received: true, message: 'Ordine già esistente' });
      }


      // Gestisce Payment Intent da Apple/Google Pay (payment_request_cart e payment_request)
      const paymentSource = paymentIntent.metadata?.payment_source;
      if (paymentSource === 'payment_request_cart' || paymentSource === 'payment_request') {
        let wcOrderId = paymentIntent.metadata?.wc_order_id;

        console.log(`[WEBHOOK] Payment Request ricevuto per PI ${paymentIntent.id}, wc_order_id: ${wcOrderId || 'MANCANTE'}`);

        // FALLBACK: Se wc_order_id manca, prova a cercare l'ordine tramite payment_intent_id
        if (!wcOrderId) {
          console.warn('[WEBHOOK] wc_order_id mancante, tentativo fallback search...');

          try {
            // Cerca ordini con questo payment_intent_id nei metadata
            const searchResponse = await api.get('orders', {
              meta_key: '_stripe_payment_intent_id',
              meta_value: paymentIntent.id,
              per_page: 1
            });

            if (searchResponse.data && Array.isArray(searchResponse.data) && searchResponse.data.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const foundOrder = searchResponse.data[0] as any;
              wcOrderId = foundOrder.id.toString();
              console.log(`[WEBHOOK] Ordine trovato tramite fallback search: #${wcOrderId}`);

              // Aggiorna il Payment Intent con l'order_id per evitare ricerche future
              await stripe.paymentIntents.update(paymentIntent.id, {
                metadata: {
                  ...paymentIntent.metadata,
                  wc_order_id: wcOrderId
                }
              });
            } else {
              console.error('[WEBHOOK] Nessun ordine trovato con fallback search');
              return NextResponse.json({
                received: true,
                error: 'Order ID mancante e nessun ordine trovato con fallback search'
              });
            }
          } catch (searchError) {
            console.error('[WEBHOOK] Errore durante fallback search:', searchError);
            return NextResponse.json({
              received: true,
              error: 'Impossibile trovare ordine associato'
            });
          }
        }

        try {
          console.log(`[WEBHOOK] Aggiornamento ordine #${wcOrderId} come pagato`);

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

          console.log(`[WEBHOOK] Ordine #${wcOrderId} aggiornato con successo`);

          // Aggiorna Payment Intent per evitare duplicati
          await stripe.paymentIntents.update(paymentIntent.id, {
            metadata: {
              ...paymentIntent.metadata,
              order_id: wcOrderId,
              webhook_processed: 'true',
              webhook_processed_at: new Date().toISOString()
            }
          });

          return NextResponse.json({ received: true, message: `Ordine #${wcOrderId} aggiornato` });

        } catch (error) {
          console.error(`[WEBHOOK] Errore aggiornamento ordine #${wcOrderId}:`, error);
          return NextResponse.json({ received: true, error: 'Errore aggiornamento ordine' });
        }
      }

      // Gestione pagamenti iOS senza ordine (utente ha chiuso l'app)
      if (!paymentIntent.metadata?.order_id && paymentIntent.metadata?.is_ios_checkout === 'true') {
        const orderDataId = paymentIntent.metadata?.order_data_id;

        if (orderDataId) {
          const storedData = await orderDataStore.get(orderDataId);

          if (storedData) {
            try {
              const { orderData } = storedData;
              const baseOrderData = orderData as Record<string, unknown>;

              const response = await api.post('orders', {
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
                    key: '_webhook_created_ios',
                    value: 'true'
                  }
                ]
              });

              const order = response.data;

              if (order && typeof order === 'object' && 'id' in order) {
                await stripe.paymentIntents.update(paymentIntent.id, {
                  metadata: {
                    ...paymentIntent.metadata,
                    order_id: (order as { id: number }).id.toString(),
                    webhook_processed: 'true'
                  }
                });

                await orderDataStore.delete(orderDataId);

                return NextResponse.json({
                  received: true,
                  message: 'Ordine iOS creato dal webhook',
                  order_id: (order as { id: number }).id
                });
              }
            } catch (error) {
              console.error('[WEBHOOK] Errore creazione ordine iOS:', error);
              return NextResponse.json({
                received: true,
                error: 'Errore creazione ordine iOS'
              }, { status: 200 });
            }
          }
        }

        console.error('[WEBHOOK] Dati ordine iOS mancanti');
        return NextResponse.json({
          received: true,
          error: 'Order data missing for iOS payment'
        }, { status: 200 });
      }

      // Verifica se abbiamo i dati dell'ordine nello store (per pagamenti Stripe normali)
      const orderDataId = paymentIntent.metadata?.order_data_id;
      if (!orderDataId) {
        console.log('[WEBHOOK] Nessun order_data_id nei metadata, skip');
        return NextResponse.json({ received: true, message: 'Nessun dato ordine' });
      }

      // Recupera i dati dell'ordine dallo store
      const storedData = await orderDataStore.get(orderDataId);

      if (!storedData) {
        console.error('[WEBHOOK] Dati ordine non trovati o scaduti');
        return NextResponse.json({ received: true, error: 'Dati ordine non trovati' });
      }

      const { orderData, pointsToRedeem, pointsDiscount } = storedData;

      // Elimina i dati dallo store dopo il recupero
      await orderDataStore.delete(orderDataId);


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

        // Aggiorna il Payment Intent con l'order_id e la descrizione con il numero d'ordine
        await stripe.paymentIntents.update(paymentIntent.id, {
          description: `Order #${wooOrder.id} from DreamShop18`, // Aggiorna la descrizione con il numero d'ordine
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

        // Controllo idempotenza: verifica se esiste già un ordine con questa session
        try {
          // Cerca ordini recenti e verifica i metadata manualmente
          // (WooCommerce REST API non supporta filtro diretto per meta_key/meta_value)
          const recentOrders = await api.get('orders', {
            per_page: 20,
            orderby: 'date',
            order: 'desc'
          });

          if (recentOrders.data && Array.isArray(recentOrders.data)) {
            interface WooOrderMeta {
              key: string;
              value: string;
            }
            interface WooOrder {
              id: number;
              meta_data: WooOrderMeta[];
            }

            const existingOrder = (recentOrders.data as WooOrder[]).find((order: WooOrder) =>
              order.meta_data?.some((meta: WooOrderMeta) =>
                meta.key === '_stripe_session_id' && meta.value === session.id
              )
            );

            if (existingOrder) {
              console.log('[WEBHOOK] Ordine già esistente per session:', session.id, '- Order ID:', existingOrder.id);
              return NextResponse.json({
                received: true,
                message: 'Ordine già esistente',
                order_id: existingOrder.id
              });
            }
          }
        } catch (checkError) {
          console.error('[WEBHOOK] Errore nel controllo ordine esistente:', checkError);
          // Continua comunque
        }

        try {
          // Recupera l'ID dei dati dell'ordine dai metadata
          const orderDataId = session.metadata?.order_data_id;

          if (!orderDataId) {
            console.error('[WEBHOOK] ID dati ordine mancante nei metadata');
            return NextResponse.json({ received: true, error: 'ID dati ordine mancante' });
          }


          // Recupera i dati completi dallo store persistente (WordPress/MySQL)
          const storedData = await orderDataStore.get(orderDataId);

          if (!storedData) {
            console.error('[WEBHOOK] Impossibile recuperare i dati dell\'ordine');
            return NextResponse.json({ received: true, error: 'Dati ordine non trovati o scaduti' });
          }

          const { orderData, pointsDiscount } = storedData;

          // Elimina i dati dallo store dopo il recupero (uso singolo)
          await orderDataStore.delete(orderDataId);



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
