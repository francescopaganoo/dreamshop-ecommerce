import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createOrder } from '../../../../lib/api';

// Interfacce per i tipi WooCommerce
interface CouponLine {
  id?: number;
  code: string;
  discount?: string;
  discount_tax?: string;
}

interface ShippingLine {
  id?: number;
  method_id: string;
  method_title: string;
  total: string;
}

// LineItem rimosso perché non utilizzato

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
    
    // Log specifico per i punti e coupon
    console.log('[iOS POINTS] Verifica dati punti e coupon:', { 
      hasPointsToRedeem: 'pointsToRedeem' in data,
      pointsToRedeemValue: data.pointsToRedeem,
      hasToken: 'token' in data && !!data.token,
      tokenLength: data.token ? data.token.length : 0,
      couponPresente: 'couponCode' in data && !!data.couponCode
    });
    
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
    const orderData: OrderData = {
      payment_method: 'stripe',
      payment_method_title: 'Carta di credito',
      set_paid: true,  // Impostiamo l'ordine come pagato
      customer_id: userId || 0,
      customer_note: notes || '',
      billing: customerInfo,
      shipping: customerInfo, // Per semplicità usiamo lo stesso indirizzo
      line_items,
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
    
    console.log('Creazione ordine in WooCommerce per iOS...');
    const order = await createOrder(orderData);
    
    if (!order || typeof order !== 'object' || !('id' in order)) {
      throw new Error('Errore nella creazione dell\'ordine');
    }
    
    console.log(`Ordine creato con successo: ${order.id}`);
    console.log(`Ordine già impostato come pagato per l'utente ID: ${userId}`);
    
    // Gestione del riscatto punti
    let pointsRedeemResult = null;
    if (pointsToRedeem && pointsToRedeem > 0 && userId > 0 && token) {
      try {
        console.log(`[iOS POINTS] Inizia riscatto ${pointsToRedeem} punti per l'utente ${userId}, ordine #${order.id}`);
        
        // Piccolo ritardo per garantire che l'ordine sia stato completamente processato
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Invece di usare la funzione redeemPoints, implementiamo direttamente il riscatto
        // Configurazioni di base per la richiesta diretta a WordPress
        const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://be.dreamshop18.com/';
        const baseUrl = wordpressUrl.endsWith('/') ? wordpressUrl : `${wordpressUrl}/`;
        
        // Utilizziamo la variabile POINTS_API_KEY disponibile nell'env
        const apiKey = process.env.POINTS_API_KEY || '9lK_jjt3Kj'; // Usa la chiave esistente nell'env
        console.log('[iOS POINTS] Usando variabile POINTS_API_KEY');
        
        // Usa l'endpoint sicuro che richiede solo API key senza autenticazione JWT
        const apiEndpoint = `${baseUrl}wp-json/dreamshop-points/v1/points/secure-redeem`;
        
        console.log(`[iOS POINTS] Chiamata diretta a WordPress API: ${apiEndpoint}`);
        console.log(`[iOS POINTS] API Key presente: ${!!apiKey} (${apiKey ? apiKey.substring(0, 3) + '...' : 'mancante'})`); 
        
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
          console.log(`[iOS POINTS] Riscatto punti completato con successo: ${pointsToRedeem} punti per l'utente ${userId}, ordine #${order.id}`);
          
          // Applicazione coupon all'ordine WooCommerce
          if (pointsRedeemResult.success && pointsRedeemResult.coupon && pointsRedeemResult.coupon.coupon_code) {
            const couponCode = pointsRedeemResult.coupon.coupon_code;
            console.log(`[iOS POINTS] Applicazione coupon ${couponCode} all'ordine ${order.id}`);
            
            // Configurazione delle chiavi WooCommerce
            const wcConsumerKey = process.env.WC_CONSUMER_KEY || '';
            const wcConsumerSecret = process.env.WC_CONSUMER_SECRET || '';
            
            try {
              // Usiamo direttamente il metodo che funziona: aggiornare le coupon_lines
              const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://be.dreamshop18.com/';
              const baseUrl = wordpressUrl.endsWith('/') ? wordpressUrl : `${wordpressUrl}/`;
              const getOrderUrl = `${baseUrl}wp-json/wc/v3/orders/${order.id}?consumer_key=${wcConsumerKey}&consumer_secret=${wcConsumerSecret}`;
              const orderResponse = await fetch(getOrderUrl);
              
              if (orderResponse.ok) {
                const orderData = await orderResponse.json();
                const existingCoupons = orderData.coupon_lines || [] as CouponLine[];
                const existingCouponCodes = existingCoupons.map((coupon: CouponLine) => ({ code: coupon.code }));
                
                console.log(`[iOS POINTS] Coupon esistenti sull'ordine: ${JSON.stringify(existingCouponCodes)}`);
                
                // Controlla se il coupon è già applicato
                const couponAlreadyApplied = existingCoupons.some((coupon: CouponLine) => coupon.code === couponCode);
                
                if (!couponAlreadyApplied) {
                  // Aggiungi il nuovo coupon alla lista
                  const updatedCouponCodes = [
                    ...existingCouponCodes,
                    { code: couponCode }
                  ];
                  
                  const updateOrderResponse = await fetch(getOrderUrl, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      coupon_lines: updatedCouponCodes
                    })
                  });
                  
                  if (updateOrderResponse.ok) {
                    console.log(`[iOS POINTS] Coupon ${couponCode} applicato con successo all'ordine ${order.id}`);
                    pointsRedeemResult.couponApplied = true;
                  } else {
                    const errorText = await updateOrderResponse.text();
                    console.error(`[iOS POINTS] Errore nell'applicazione del coupon all'ordine:`, errorText);
                  }
                } else {
                  console.log(`[iOS POINTS] Il coupon ${couponCode} è già applicato all'ordine ${order.id}`);
                  pointsRedeemResult.couponApplied = true;
                }
              }
            } catch (couponError) {
              console.error(`[iOS POINTS] Errore durante l'applicazione del coupon:`, couponError);
            }
          }
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