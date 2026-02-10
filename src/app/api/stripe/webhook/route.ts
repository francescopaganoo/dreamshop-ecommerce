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

      // Gestione pagamenti spedizione resina
      if (paymentIntent.metadata?.type === 'resin_shipping') {
        console.log('[WEBHOOK] Pagamento spedizione resina rilevato:', paymentIntent.metadata);

        const resinToken = paymentIntent.metadata.token;
        const shippingFeeId = paymentIntent.metadata.shipping_fee_id;

        if (!resinToken) {
          console.error('[WEBHOOK] Token mancante nei metadata spedizione resina');
          return NextResponse.json({ received: true, error: 'Token mancante' });
        }

        if (paymentIntent.metadata?.webhook_processed === 'true') {
          console.log('[WEBHOOK] Spedizione resina già processata, skip');
          return NextResponse.json({ received: true, message: 'Già processata' });
        }

        try {
          const wpUrl = (process.env.NEXT_PUBLIC_WORDPRESS_URL || 'http://localhost:8080').replace(/\/$/, '');
          const wcKey = process.env.NEXT_PUBLIC_WC_CONSUMER_KEY || '';
          const wcSecret = process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET || '';
          const basicAuth = Buffer.from(`${wcKey}:${wcSecret}`).toString('base64');

          const markPaidResponse = await fetch(
            `${wpUrl}/wp-json/dreamshop-resin-shipping/v1/shipping-fee/${resinToken}/mark-paid`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                stripe_payment_intent_id: paymentIntent.id
              })
            }
          );

          if (!markPaidResponse.ok) {
            throw new Error(`Mark paid failed: ${markPaidResponse.status}`);
          }

          await stripe.paymentIntents.update(paymentIntent.id, {
            metadata: {
              ...paymentIntent.metadata,
              webhook_processed: 'true',
              webhook_processed_at: new Date().toISOString()
            }
          });

          console.log(`[WEBHOOK] Spedizione resina #${shippingFeeId} segnata come pagata`);
          return NextResponse.json({ received: true, message: 'Spedizione resina pagata' });

        } catch (error) {
          console.error('[WEBHOOK] Errore processing spedizione resina:', error);
          return NextResponse.json({ received: true, error: 'Errore spedizione resina' });
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
        const wcOrderId = paymentIntent.metadata?.wc_order_id;
        const orderDataId = paymentIntent.metadata?.order_data_id;
        const enableDeposit = paymentIntent.metadata?.enable_deposit;
        const orderCreated = paymentIntent.metadata?.order_created;

        console.log(`[WEBHOOK] Payment Request ricevuto per PI ${paymentIntent.id}`, {
          wc_order_id: wcOrderId || 'MANCANTE',
          order_data_id: orderDataId || 'MANCANTE',
          enable_deposit: enableDeposit || 'no',
          order_created: orderCreated || 'false'
        });

        // Se l'ordine è già stato creato (dalla route o da un webhook precedente), skip
        if (orderCreated === 'true' && wcOrderId) {
          console.log(`[WEBHOOK] Ordine #${wcOrderId} già creato, skip`);
          return NextResponse.json({ received: true, message: `Ordine #${wcOrderId} già esistente` });
        }

        // FLUSSO PRINCIPALE: Il webhook è l'UNICO creatore di ordini per Apple Pay/Google Pay.
        // La route NON crea più ordini (per evitare race condition e duplicati).
        if (orderDataId && !wcOrderId) {
          console.log(`[WEBHOOK] Creazione ordine da order_data_id: ${orderDataId}`);

          try {
            // Recupera i dati dell'ordine dallo store
            const storedData = await orderDataStore.get(orderDataId);

            if (!storedData) {
              console.error(`[WEBHOOK] Dati ordine non trovati per order_data_id: ${orderDataId}`);
              return NextResponse.json({ received: true, error: 'Dati ordine non trovati o scaduti' });
            }

            // Type assertion per orderData
            const savedOrderData = storedData.orderData as Record<string, unknown>;
            const existingMetaData = (savedOrderData.meta_data as Array<{ key: string; value: string }>) || [];

            // Determina lo status corretto
            const hasDeposit = enableDeposit === 'yes';

            // Crea l'ordine in WooCommerce
            const orderResponse = await api.post('orders', {
              ...savedOrderData,
              status: hasDeposit ? 'partial-payment' : 'processing',
              set_paid: true,
              transaction_id: paymentIntent.id,
              meta_data: [
                ...existingMetaData,
                {
                  key: '_stripe_payment_intent_id',
                  value: paymentIntent.id
                },
                {
                  key: '_webhook_created',
                  value: 'true'
                },
                {
                  key: '_webhook_created_at',
                  value: new Date().toISOString()
                }
              ]
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const order = (orderResponse.data as any);
            console.log(`[WEBHOOK] Ordine #${order.id} creato con successo (status: ${hasDeposit ? 'partial-payment' : 'processing'})`);

            // Marca l'ordine come completato nello store (NON eliminare, serve al frontend per il polling)
            await orderDataStore.markCompleted(orderDataId, {
              wcOrderId: order.id,
              paymentIntentId: paymentIntent.id
            });

            // Aggiorna il Payment Intent con l'order_id
            await stripe.paymentIntents.update(paymentIntent.id, {
              metadata: {
                ...paymentIntent.metadata,
                wc_order_id: order.id.toString(),
                order_id: order.id.toString(),
                order_created: 'true',
                webhook_processed: 'true',
                webhook_processed_at: new Date().toISOString()
              }
            });

            return NextResponse.json({ received: true, message: `Ordine #${order.id} creato`, order_id: order.id });

          } catch (error) {
            console.error('[WEBHOOK] Errore creazione ordine da order_data_id:', error);
            return NextResponse.json({ received: true, error: 'Errore creazione ordine' });
          }
        }

        // VECCHIO FLUSSO (backward compatibility): Se abbiamo wc_order_id, aggiorna l'ordine esistente
        if (wcOrderId) {
          try {
            console.log(`[WEBHOOK] Aggiornamento ordine esistente #${wcOrderId} come pagato`);

            // BUGFIX: Per ordini con acconto, NON cambiare lo stato a 'processing'
            // Lo stato deve rimanere 'partial-payment' perché è solo la prima rata
            if (enableDeposit === 'yes') {
              // Per ordini con rate, aggiorna solo set_paid e transaction_id
              await api.put(`orders/${wcOrderId}`, {
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
              console.log(`[WEBHOOK] Ordine #${wcOrderId} con acconto aggiornato (status remains partial-payment)`);
            } else {
              // Per ordini normali (senza rate), imposta 'processing'
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
              console.log(`[WEBHOOK] Ordine #${wcOrderId} aggiornato con successo (processing)`);
            }

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

        // Se non abbiamo né wc_order_id né order_data_id, errore
        console.error('[WEBHOOK] Payment Request senza wc_order_id né order_data_id');
        return NextResponse.json({ received: true, error: 'Dati ordine mancanti' });
      }

      // Gestione pagamenti iOS (nuovo flusso webhook-only: l'ordine viene creato QUI)
      if (!paymentIntent.metadata?.order_id && paymentIntent.metadata?.is_ios_checkout === 'true') {
        const orderDataId = paymentIntent.metadata?.order_data_id;
        const enableDeposit = paymentIntent.metadata?.enable_deposit;

        if (orderDataId) {
          const storedData = await orderDataStore.get(orderDataId);

          if (storedData) {
            try {
              const { orderData, pointsToRedeem } = storedData;
              const baseOrderData = orderData as Record<string, unknown>;

              // Controlla se ci sono prodotti con acconto nei line_items
              const lineItems = (baseOrderData.line_items as Array<{
                product_id: number;
                quantity: number;
                meta_data?: Array<{key: string; value: string}>;
              }>) || [];

              const hasDeposit = enableDeposit === 'yes' || lineItems.some(item =>
                item.meta_data?.some(meta => meta.key === '_wc_convert_to_deposit' && meta.value === 'yes')
              );

              console.log(`[WEBHOOK] iOS - Creazione ordine da order_data_id: ${orderDataId}, acconti: ${hasDeposit}`);

              const response = await api.post('orders', {
                ...baseOrderData,
                payment_method: 'stripe',
                payment_method_title: 'Carta di Credito (Stripe)',
                set_paid: true,
                status: hasDeposit ? 'partial-payment' : 'processing',
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
                  },
                  {
                    key: '_webhook_created_at',
                    value: new Date().toISOString()
                  }
                ]
              });

              const order = response.data;

              if (order && typeof order === 'object' && 'id' in order) {
                const iosOrderId = (order as { id: number }).id;
                console.log(`[WEBHOOK] iOS - Ordine #${iosOrderId} creato con successo (status: ${hasDeposit ? 'partial-payment' : 'processing'})`);

                // Marca come completato nello store (per il polling dalla success page)
                await orderDataStore.markCompleted(orderDataId, {
                  wcOrderId: iosOrderId,
                  paymentIntentId: paymentIntent.id
                });

                // Aggiorna PaymentIntent con order_id e descrizione
                await stripe.paymentIntents.update(paymentIntent.id, {
                  description: `Order #${iosOrderId} from DreamShop18 (iOS)`,
                  metadata: {
                    ...paymentIntent.metadata,
                    order_id: iosOrderId.toString(),
                    webhook_processed: 'true',
                    webhook_processed_at: new Date().toISOString()
                  }
                });

                // Gestione force-deposits-processing per ordini con acconti
                if (hasDeposit) {
                  try {
                    const wpUrl = (process.env.NEXT_PUBLIC_WORDPRESS_URL || '').replace(/\/$/, '');
                    const activateDepositsUrl = `${wpUrl}/wp-json/dreamshop/v1/orders/${iosOrderId}/force-deposits-processing`;

                    const forceResponse = await fetch(activateDepositsUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ force_processing: true, source: 'ios_webhook' })
                    });

                    if (forceResponse.ok) {
                      console.log(`[WEBHOOK] iOS - Force deposits processing OK per ordine #${iosOrderId}`);
                    }
                  } catch (forceError) {
                    console.log('[WEBHOOK] iOS - Force deposits non disponibile:', forceError);
                  }
                }

                // Decrementa i punti se sono stati usati per lo sconto
                if (pointsToRedeem && pointsToRedeem > 0) {
                  const customerId = (baseOrderData.customer_id as number) || 0;

                  if (customerId > 0) {
                    try {
                      const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';
                      const apiKey = process.env.POINTS_API_KEY;

                      if (apiKey) {
                        const deductResponse = await fetch(`${baseUrl}/wp-json/dreamshop-points/v1/points/deduct-only`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': apiKey
                          },
                          body: JSON.stringify({
                            user_id: customerId,
                            points: pointsToRedeem,
                            order_id: iosOrderId,
                            description: `Punti utilizzati per sconto ordine #${iosOrderId}`
                          })
                        });

                        const deductResult = await deductResponse.json();
                        if (deductResponse.ok && deductResult.success) {
                          console.log(`[WEBHOOK] iOS - Punti decrementati: userId=${customerId}, points=${pointsToRedeem}, newBalance=${deductResult.new_balance}`);
                        } else {
                          console.error('[WEBHOOK] iOS - Errore decremento punti:', deductResult);
                        }
                      }
                    } catch (pointsError) {
                      console.error('[WEBHOOK] iOS - Errore decremento punti:', pointsError);
                    }
                  }
                }

                return NextResponse.json({
                  received: true,
                  message: 'Ordine iOS creato dal webhook',
                  order_id: iosOrderId
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

      const { orderData, pointsToRedeem } = storedData;

      // Type-safe spread
      const baseOrderData = orderData as Record<string, unknown>;

      // Controlla se ci sono prodotti con acconto nei line_items
      const lineItemsForDeposit = (baseOrderData.line_items as Array<{
        product_id: number;
        quantity: number;
        meta_data?: Array<{key: string; value: string}>;
      }>) || [];

      const hasDepositInOrder = lineItemsForDeposit.some(item =>
        item.meta_data?.some(meta => meta.key === '_wc_convert_to_deposit' && meta.value === 'yes')
      );

      console.log(`[WEBHOOK] Stripe normal - Ordine contiene acconti: ${hasDepositInOrder}`);

      // Prepara i dati dell'ordine WooCommerce
      const orderDataToSend: Record<string, unknown> = {
        ...baseOrderData,
        payment_method: 'stripe',
        payment_method_title: 'Carta di Credito (Stripe)',
        set_paid: true,
        // BUGFIX: Per ordini con acconto, impostare direttamente 'partial-payment'
        status: hasDepositInOrder ? 'partial-payment' : 'processing',
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

      // NOTA: Lo sconto punti è già incluso nelle fee_lines di orderData dal checkout
      // Non aggiungiamo di nuovo per evitare duplicazioni

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

        // Marca come completato nello store (NON eliminare)
        await orderDataStore.markCompleted(orderDataId, {
          wcOrderId: wooOrder.id,
          paymentIntentId: paymentIntent.id
        });

        // Aggiorna il Payment Intent con l'order_id e la descrizione con il numero d'ordine
        await stripe.paymentIntents.update(paymentIntent.id, {
          description: `Order #${wooOrder.id} from DreamShop18`,
          metadata: {
            ...paymentIntent.metadata,
            order_id: String(wooOrder.id),
            webhook_processed: 'true'
          }
        });

        // Decrementa i punti dell'utente se sono stati usati per lo sconto
        if (pointsToRedeem > 0) {
          const customerId = (baseOrderData.customer_id as number) || 0;

          if (customerId > 0) {
            try {
              const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';
              const apiKey = process.env.POINTS_API_KEY;

              if (apiKey) {
                const deductResponse = await fetch(`${baseUrl}/wp-json/dreamshop-points/v1/points/deduct-only`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                  },
                  body: JSON.stringify({
                    user_id: customerId,
                    points: pointsToRedeem,
                    order_id: wooOrder.id,
                    description: `Punti utilizzati per sconto ordine #${wooOrder.id}`
                  })
                });

                const deductResult = await deductResponse.json();
                if (deductResponse.ok && deductResult.success) {
                  console.log(`[WEBHOOK] Punti decrementati: userId=${customerId}, points=${pointsToRedeem}, newBalance=${deductResult.new_balance}`);
                } else {
                  console.error('[WEBHOOK] Errore nel decremento punti:', deductResult);
                }
              }
            } catch (pointsError) {
              console.error('[WEBHOOK] Errore nel decremento punti:', pointsError);
            }
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

          const { orderData, pointsToRedeem } = storedData;

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

          // NOTA: Lo sconto punti è già incluso nelle fee_lines di orderData dal checkout
          // Non aggiungiamo di nuovo per evitare duplicazioni

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

          // Marca come completato nello store
          await orderDataStore.markCompleted(orderDataId, {
            wcOrderId: wooOrder.id,
            paymentIntentId: session.payment_intent as string || session.id
          });

          // Salva l'order_id nei metadata della sessione per riferimento futuro
          await stripe.checkout.sessions.update(session.id, {
            metadata: {
              ...session.metadata,
              order_id: String(wooOrder.id),
              webhook_processed: 'true'
            }
          });

          // Decrementa i punti dell'utente se sono stati usati per lo sconto
          const customerId = (baseOrderData2.customer_id as number) || 0;
          if (pointsToRedeem && pointsToRedeem > 0 && customerId > 0) {
            try {
              const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';
              const apiKey = process.env.POINTS_API_KEY;

              if (apiKey) {
                const deductResponse = await fetch(`${baseUrl}/wp-json/dreamshop-points/v1/points/deduct-only`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                  },
                  body: JSON.stringify({
                    user_id: customerId,
                    points: pointsToRedeem,
                    order_id: wooOrder.id,
                    description: `Punti utilizzati per sconto ordine #${wooOrder.id}`
                  })
                });

                const deductResult = await deductResponse.json();
                if (deductResponse.ok && deductResult.success) {
                  console.log(`[WEBHOOK] Punti decrementati (checkout.session): userId=${customerId}, points=${pointsToRedeem}, newBalance=${deductResult.new_balance}`);
                } else {
                  console.error('[WEBHOOK] Errore nel decremento punti (checkout.session):', deductResult);
                }
              }
            } catch (pointsError) {
              console.error('[WEBHOOK] Errore nel decremento punti (checkout.session):', pointsError);
            }
          }

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
