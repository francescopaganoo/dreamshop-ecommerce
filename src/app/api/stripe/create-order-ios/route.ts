import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createOrder } from '../../../../lib/api';
import api from '../../../../lib/woocommerce';

// Interfacce per i tipi WooCommerce
interface ShippingLine {
  id?: number;
  method_id: string;
  method_title: string;
  total: string;
}

// LineItem rimosso perché non utilizzato

// Interfacce per i tipi degli elementi
interface MetaData {
  key: string;
  value: string;
}

interface LineItemInput {
  product_id?: number;
  id?: number;
  quantity: number;
  variation_id?: number;
  meta_data?: MetaData[];
}

// Questa interfaccia locale deve essere compatibile con quella in lib/api.ts
interface OrderData {
  payment_method: string;
  payment_method_title: string;
  set_paid: boolean;
  customer_id?: number;
  customer_note?: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items: {
    product_id: number;
    quantity: number;
    variation_id?: number;
    subtotal?: string;
    total?: string;
    meta_data?: {
      key: string;
      value: string;
    }[];
  }[];
  shipping_lines: ShippingLine[];
  coupon_lines?: {
    code: string;
  }[];
  meta_data: {
    key: string;
    value: string;
  }[];
}

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
    
    // Log specifico per i line_items e i loro metadati
    if (data.line_items) {
      data.line_items.forEach((item: LineItemInput, index: number) => {
        console.log(`iOS - Item ${index}:`, {
          product_id: item.product_id || item.id,
          quantity: item.quantity,
          variation_id: item.variation_id,
          meta_data: item.meta_data,
          hasDepositMeta: item.meta_data && item.meta_data.some((meta: MetaData) => meta.key === '_wc_convert_to_deposit')
        });
      });
    }
    

    
    const { 
      paymentMethodId, 
      amount, 
      customerInfo, 
      line_items, 
      shipping, 
      notes, 
      directCustomerId = 0,
      isAuthenticated = false,
      pointsToRedeem = 0,
      token = '',
      couponCode = ''
    } = data;
    
    // SOLUZIONE SEMPLIFICATA: Prendiamo direttamente l'ID utente dal form
    // Non facciamo più verifiche token che potrebbero fallire
    let userId = 0;
    
    // Usa directCustomerId se disponibile (inviato dal frontend)
    if (directCustomerId && isAuthenticated) {
      userId = directCustomerId;
    } else {
      console.log('iOS: Nessun ID utente valido fornito, ordine sarà come guest');
    }
    
    if (!paymentMethodId || !amount || !customerInfo || !line_items) {
      console.error('Dati mancanti per l\'ordine iOS');
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }
    
    // Crea il Payment Intent senza confermare ancora
    let paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      payment_method: paymentMethodId,
      payment_method_types: ['card'],
      confirm: false,
      metadata: {
        payment_source: 'ios_app',
        customer_email: customerInfo.email,
        customer_id: userId.toString(),
        is_ios_checkout: 'true'
      }
    });
    
    // Crea un ordine in WooCommerce già come pagato (set_paid: true)
    // Assicurati che i line_items abbiano tutti i metadati necessari
    // IMPORTANTE: Rimuovi gli ID dai meta_data perché WooCommerce li rifiuta durante la creazione di nuovi ordini
    // Helper per verificare se un item è un regalo automatico
    const isAutoGiftItem = (item: LineItemInput): boolean => {
      if (!item.meta_data) return false;
      return item.meta_data.some(meta => meta.key === '_is_auto_gift' && meta.value === 'yes');
    };

    const processedLineItems = line_items.map((item: LineItemInput) => {
      // Filtra i metadati per rimuovere gli ID e mantenere solo quelli essenziali per l'ordine
      const filteredMetaData = item.meta_data
        ? item.meta_data
            .filter((meta: MetaData) => {
              // Mantieni solo metadati rilevanti per l'ordine (acconti, deposits, regali automatici, etc)
              return meta.key.startsWith('_wc_') ||
                     meta.key.includes('deposit') ||
                     meta.key.includes('payment_plan') ||
                     meta.key === '_is_auto_gift' ||
                     meta.key === '_gift_rule_id' ||
                     meta.key === '_gift_rule_name';
            })
            .map((meta: MetaData) => ({
              key: meta.key,
              value: meta.value
              // NON includere l'ID - WooCommerce lo assegna automaticamente
            }))
        : [];

      const processedItem: {
        product_id: number | undefined;
        quantity: number;
        variation_id?: number;
        subtotal?: string;
        total?: string;
        meta_data: MetaData[];
      } = {
        product_id: item.product_id || item.id,
        quantity: item.quantity,
        variation_id: item.variation_id || undefined,
        meta_data: filteredMetaData
      };

      // Se è un regalo automatico, imposta il prezzo a 0
      if (isAutoGiftItem(item)) {
        processedItem.subtotal = '0';
        processedItem.total = '0';
      }

      return processedItem;
    });

    
    // Log specifico per verificare che i metadati degli acconti siano stati preservati
    processedLineItems.forEach((item: { product_id?: number; quantity: number; variation_id?: number; meta_data?: MetaData[] }, index: number) => {
      const hasDepositMeta = item.meta_data && item.meta_data.some((meta: MetaData) => meta.key === '_wc_convert_to_deposit');
      if (hasDepositMeta) {
        console.log(`iOS - ACCONTO RILEVATO nell'item ${index} (product_id: ${item.product_id}):`, {
          meta_data: item.meta_data?.filter((meta: MetaData) => meta.key.includes('deposit') || meta.key.includes('_wc_')) || []
        });
      }
    });

    const orderData: OrderData = {
      payment_method: 'stripe',
      payment_method_title: 'Carta di credito',
      set_paid: true,  // Impostiamo l'ordine come pagato
      customer_id: userId || 0,
      customer_note: notes || '',
      billing: customerInfo,
      shipping: customerInfo, // Per semplicità usiamo lo stesso indirizzo
      line_items: processedLineItems,
      shipping_lines: [
        {
          method_id: 'flat_rate',
          method_title: 'Spedizione standard',
          total: String(shipping)
        }
      ],
      // Aggiungi il coupon manuale se presente
      coupon_lines: couponCode ? [
        {
          code: couponCode
        }
      ] : [],
      meta_data: [
        {
          key: 'stripe_payment_intent_id',
          value: paymentIntent.id
        },
        {
          key: 'is_ios_checkout',
          value: 'true'
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
    

    
    let order;
    try {
      order = await createOrder(orderData);
    } catch (createOrderError: unknown) {
      // Log dettagliato dell'errore per debugging
      console.error('Error creating order:', createOrderError);

      // Se è un errore Axios, estrai i dettagli della risposta
      if (createOrderError && typeof createOrderError === 'object' && 'response' in createOrderError) {
        const axiosError = createOrderError as { response?: { status?: number; data?: unknown; statusText?: string } };
        if (axiosError.response) {
          console.error('WooCommerce API Error Details:', {
            status: axiosError.response.status,
            statusText: axiosError.response.statusText,
            data: axiosError.response.data
          });
        }
      }

      throw createOrderError;
    }



    if (!order || typeof order !== 'object' || !('id' in order)) {
      throw new Error('Errore nella creazione dell\'ordine');
    }

    // Aggiorna il PaymentIntent con l'order_id prima di confermarlo
    try {
      await stripe.paymentIntents.update(paymentIntent.id, {
        description: `Order #${order.id} from DreamShop18 (iOS)`,
        metadata: {
          ...paymentIntent.metadata,
          order_id: order.id.toString(),
          webhook_processed: 'true'
        }
      });
    } catch (updateError) {
      console.error('iOS - Errore aggiornamento PaymentIntent:', updateError);
    }

    // Conferma il Payment Intent
    try {
      paymentIntent = await stripe.paymentIntents.confirm(paymentIntent.id);

      if (paymentIntent.status !== 'succeeded') {
        console.error(`iOS - Pagamento fallito: ${paymentIntent.status}`);

        try {
          await api.delete(`orders/${order.id}`, { force: true });
        } catch (deleteError) {
          console.error('iOS - Errore cancellazione ordine:', deleteError);
        }

        return NextResponse.json({
          error: `Pagamento non riuscito: ${paymentIntent.status}`
        }, { status: 400 });
      }
    } catch (confirmError) {
      console.error('iOS - Errore conferma pagamento:', confirmError);

      try {
        await api.delete(`orders/${order.id}`, { force: true });
      } catch (deleteError) {
        console.error('iOS - Errore cancellazione ordine:', deleteError);
      }

      return NextResponse.json({
        error: 'Errore durante la conferma del pagamento'
      }, { status: 500 });
    }

    // Salva il transaction_id nell'ordine WooCommerce
    try {
      await api.put(`orders/${order.id}`, {
        transaction_id: paymentIntent.id,
        meta_data: [
          {
            key: '_stripe_payment_intent_id',
            value: paymentIntent.id
          }
        ]
      });
    } catch (transactionError) {
      console.error('iOS - Errore salvataggio transaction_id:', transactionError);
    }

    // TENTATIVO 1: Chiamata diretta all'endpoint per forzare l'elaborazione degli acconti
    try {
      
      const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL!;
      const baseUrl = wordpressUrl.endsWith('/') ? wordpressUrl : `${wordpressUrl}/`;
      
      // Chiamata per forzare il re-processamento dell'ordine con gli acconti
      const activateDepositsUrl = `${baseUrl}wp-json/dreamshop/v1/orders/${order.id}/force-deposits-processing`;
      
      const forceResponse = await fetch(activateDepositsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          force_processing: true,
          source: 'ios_api'
        })
      });
      
      if (forceResponse.ok) {
        const forceResult = await forceResponse.json();
        console.log('iOS - Elaborazione acconti forzata con successo:', forceResult);
      } else {
        console.log('iOS - Elaborazione acconti forzata non disponibile (endpoint non trovato)');
      }
    } catch (forceError) {
      console.log('iOS - Errore nell\'elaborazione forzata degli acconti:', forceError);
    }
    
    // Gestione del riscatto punti
    let pointsRedeemResult = null;
    if (pointsToRedeem && pointsToRedeem > 0 && userId > 0 && token) {
      try {
        
        // Piccolo ritardo per garantire che l'ordine sia stato completamente processato
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Invece di usare la funzione redeemPoints, implementiamo direttamente il riscatto
        // Configurazioni di base per la richiesta diretta a WordPress
        const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL!;
        const baseUrl = wordpressUrl.endsWith('/') ? wordpressUrl : `${wordpressUrl}/`;
        
        // Utilizziamo la variabile POINTS_API_KEY disponibile nell'env
        const apiKey = process.env.POINTS_API_KEY!; // Usa la chiave dalle variabili d'ambiente
        
        // Usa l'endpoint sicuro che richiede solo API key senza autenticazione JWT
        const apiEndpoint = `${baseUrl}wp-json/dreamshop-points/v1/points/secure-redeem`;
        
        
        if (!apiKey) {
          console.error('[iOS POINTS] ERRORE CRITICO: API Key mancante! Verifica la variabile DREAMSHOP_POINTS_API_KEY');
        }
        
        // Chiamata diretta all'API WordPress
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey
          },
          body: JSON.stringify({
            user_id: userId,
            points: pointsToRedeem,
            description: `Punti utilizzati per uno sconto sull'ordine #${order.id}`,
            order_id: order.id
          })
        });
        
        if (response.ok) {
          pointsRedeemResult = await response.json();
          
          // Il plugin WordPress gestisce automaticamente l'applicazione dello sconto tramite l'endpoint secure-redeem
        } else {
          const errorText = await response.text();
          console.error(`[iOS POINTS] Errore risposta API: ${response.status}`, errorText);
          pointsRedeemResult = { success: false, error: errorText };
        }
        
      } catch (pointsError) {
        console.error('[iOS POINTS] Eccezione durante il riscatto punti:', pointsError);
        pointsRedeemResult = { success: false, error: 'Eccezione durante il riscatto punti' };
        // Non interrompiamo il flusso se il riscatto punti fallisce
      }
    }
        
    // Restituisci l'ordine, il paymentIntent e il risultato del riscatto punti
    return NextResponse.json({ 
      success: true,
      orderId: typeof order.id === 'number' ? order.id.toString() : String(order.id),
      paymentIntentId: paymentIntent.id,
      paymentStatus: paymentIntent.status,
      pointsRedeemed: pointsRedeemResult && pointsRedeemResult.success ? true : false,
      pointsResponse: pointsRedeemResult
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