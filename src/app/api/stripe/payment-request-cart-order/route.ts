import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';

// Inizializza Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Inizializza WooCommerce API
const WooCommerce = new WooCommerceRestApi({
  url: process.env.NEXT_PUBLIC_WORDPRESS_URL || '',
  consumerKey: process.env.NEXT_PUBLIC_WC_CONSUMER_KEY || '',
  consumerSecret: process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET || '',
  version: 'wc/v3'
});

interface CartItem {
  product_id: number;
  variation_id?: number;
  quantity: number;
  name: string;
  price: string;
}

interface AddressData {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

interface ShippingOption {
  id: string;
  label: string;
  amount: number;
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    
    const {
      cartItems,
      userId,
      paymentMethodId,
      shippingOption,
      discount = 0,
      billingData,
      shippingData
    }: {
      cartItems: CartItem[];
      userId: number;
      paymentMethodId: string;
      shippingOption?: ShippingOption;
      discount?: number;
      billingData: AddressData;
      shippingData: AddressData;
    } = await request.json();



    // Verifica che ci siano items nel carrello
    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: 'Carrello vuoto' }, { status: 400 });
    }

    // Verifica la disponibilità di tutti i prodotti e calcola il totale
    let subtotal = 0;
    const verifiedItems = [];

    for (const item of cartItems) {
      try {
        const productResponse = await WooCommerce.get(`products/${item.product_id}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const product: any = productResponse.data;

        if (!product) {
          throw new Error(`Prodotto ${item.product_id} non trovato`);
        }

        if (product.stock_status !== 'instock') {
          throw new Error(`Prodotto "${product.name}" non disponibile`);
        }

        // Usa il prezzo attuale dal database, non quello dal carrello
        const unitPrice = parseFloat(product.sale_price || product.price || '0');
        if (unitPrice <= 0) {
          throw new Error(`Prezzo non valido per "${product.name}"`);
        }

        const itemTotal = unitPrice * item.quantity;
        subtotal += itemTotal;

        verifiedItems.push({
          product_id: item.product_id,
          variation_id: item.variation_id || null,
          quantity: item.quantity,
          price: unitPrice.toString(),
          total: itemTotal.toString()
        });

      } catch (error) {
        console.error(`Errore verifica prodotto ${item.product_id}:`, error);
        return NextResponse.json({ 
          error: `Errore prodotto: ${error instanceof Error ? error.message : 'Prodotto non disponibile'}` 
        }, { status: 400 });
      }
    }

    // Calcola i costi di spedizione
    const shippingCost = shippingOption ? shippingOption.amount / 100 : 0; // Converti da centesimi

    // Calcola il totale finale
    const orderTotal = subtotal - discount + shippingCost;
    const stripeAmount = Math.round(orderTotal * 100); // Converti in centesimi

    console.log('[PAYMENT-REQUEST-CART] Step 1: Calculated totals', {
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      shippingCost: shippingCost.toFixed(2),
      orderTotal: orderTotal.toFixed(2),
      itemsCount: cartItems.length
    });

    if (stripeAmount <= 0) {
      return NextResponse.json({ error: 'Totale ordine non valido' }, { status: 400 });
    }

    // Prepara i line items per WooCommerce
    const lineItems = verifiedItems.map(item => ({
      product_id: item.product_id,
      variation_id: item.variation_id || undefined,
      quantity: item.quantity
    }));

    // Prepara le linee di spedizione
    const shippingLines = [];
    if (shippingOption && shippingCost > 0) {
      shippingLines.push({
        method_id: shippingOption.id,
        method_title: shippingOption.label,
        total: shippingCost.toFixed(2)
      });
    }

    // STEP 1: Crea l'ordine in WooCommerce PRIMA del pagamento
    console.log('[PAYMENT-REQUEST-CART] Step 2: Creating WooCommerce order BEFORE payment');

    const orderData = {
      payment_method: 'stripe',
      payment_method_title: 'Apple Pay / Google Pay',
      status: 'pending', // Pending fino a conferma pagamento
      set_paid: false, // Verrà aggiornato dopo la conferma del pagamento
      customer_id: userId > 0 ? userId : 0,
      billing: {
        first_name: billingData.first_name,
        last_name: billingData.last_name,
        address_1: billingData.address_1,
        address_2: billingData.address_2 || '',
        city: billingData.city,
        state: billingData.state,
        postcode: billingData.postcode,
        country: billingData.country,
        email: billingData.email || '',
        phone: billingData.phone || ''
      },
      shipping: {
        first_name: shippingData.first_name,
        last_name: shippingData.last_name,
        address_1: shippingData.address_1,
        address_2: shippingData.address_2 || '',
        city: shippingData.city,
        state: shippingData.state,
        postcode: shippingData.postcode,
        country: shippingData.country
      },
      line_items: lineItems,
      shipping_lines: shippingLines,
      coupon_lines: discount > 0 ? [{
        code: 'payment_request_discount',
        discount: discount.toString()
      }] : [],
      meta_data: [
        {
          key: '_payment_source',
          value: 'payment_request_cart'
        },
        {
          key: '_original_subtotal',
          value: subtotal.toString()
        },
        {
          key: '_stripe_amount_to_charge',
          value: orderTotal.toFixed(2)
        }
      ]
    };

    let order;
    try {
      const orderResponse = await WooCommerce.post('orders', orderData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      order = orderResponse.data as any;
      console.log(`[PAYMENT-REQUEST-CART] Step 3: Order #${order.id} created successfully`);
    } catch (orderError) {
      console.error('[PAYMENT-REQUEST-CART] Step 3 FAILED: Order creation error:', orderError);
      // Se l'ordine non può essere creato, fermiamoci qui PRIMA di addebitare il cliente
      throw new Error(`Impossibile creare l'ordine: ${orderError instanceof Error ? orderError.message : 'Errore sconosciuto'}`);
    }

    // STEP 2: Ora che abbiamo l'ordine, crea e conferma il Payment Intent
    console.log(`[PAYMENT-REQUEST-CART] Step 4: Creating Payment Intent for order #${order.id}`);

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: stripeAmount,
        currency: 'eur',
        payment_method: paymentMethodId,
        confirmation_method: 'automatic',
        confirm: true,
        return_url: `${origin}/checkout/success`,
        metadata: {
          wc_order_id: order.id.toString(), // ← FONDAMENTALE: ordine già creato
          user_id: userId.toString(),
          items_count: cartItems.length.toString(),
          subtotal: subtotal.toString(),
          discount: discount.toString(),
          shipping_cost: shippingCost.toString(),
          payment_source: 'payment_request_cart'
        }
      });

      console.log(`[PAYMENT-REQUEST-CART] Step 5: Payment Intent ${paymentIntent.id} created with status: ${paymentIntent.status}`);

      // Aggiorna l'ordine con il payment_intent_id
      await WooCommerce.put(`orders/${order.id}`, {
        meta_data: [
          {
            key: '_stripe_payment_intent_id',
            value: paymentIntent.id
          }
        ]
      });

    } catch (paymentError) {
      console.error(`[PAYMENT-REQUEST-CART] Step 5 FAILED: Payment error for order #${order.id}:`, paymentError);

      // Pagamento fallito → cancella l'ordine per evitare ordini orfani
      try {
        await WooCommerce.put(`orders/${order.id}`, {
          status: 'cancelled',
          customer_note: `Pagamento fallito: ${paymentError instanceof Error ? paymentError.message : 'Errore sconosciuto'}`
        });
        console.log(`[PAYMENT-REQUEST-CART] Order #${order.id} cancelled due to payment failure`);
      } catch (cancelError) {
        console.error(`[PAYMENT-REQUEST-CART] Failed to cancel order #${order.id}:`, cancelError);
      }

      throw paymentError;
    }

    // STEP 3: Se il pagamento è riuscito, aggiorna l'ordine
    if (paymentIntent.status === 'succeeded') {
      console.log(`[PAYMENT-REQUEST-CART] Step 6: Payment succeeded, updating order #${order.id}`);

      try {
        await WooCommerce.put(`orders/${order.id}`, {
          status: 'processing',
          set_paid: true,
          transaction_id: paymentIntent.id
        });
        console.log(`[PAYMENT-REQUEST-CART] Order #${order.id} marked as paid`);
      } catch (updateError) {
        console.error(`[PAYMENT-REQUEST-CART] Warning: Failed to update order #${order.id}, webhook will handle it:`, updateError);
        // Non lanciare errore qui: il webhook può recuperare
        // L'importante è che wc_order_id sia nei metadata del Payment Intent
      }
    } else if (paymentIntent.status === 'requires_action') {
      console.log(`[PAYMENT-REQUEST-CART] Payment requires additional action (3DS), order #${order.id} remains pending`);
    } else {
      console.warn(`[PAYMENT-REQUEST-CART] Unexpected payment status: ${paymentIntent.status} for order #${order.id}`);
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      order_number: order.number,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentStatus: paymentIntent.status, // ← AGGIUNTO: status per frontend
      requiresAction: paymentIntent.status === 'requires_action', // ← AGGIUNTO: flag 3DS
      total: orderTotal.toFixed(2)
    });

  } catch (error) {
    console.error('❌ Errore durante la creazione dell\'ordine carrello Payment Request:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Errore durante la creazione dell\'ordine'
    }, { status: 500 });
  }
}