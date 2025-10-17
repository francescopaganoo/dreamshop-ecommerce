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

interface BillingData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

export async function POST(request: NextRequest) {
  try {
    // Ottieni l'URL base dalla richiesta
    const origin = request.nextUrl.origin;
    
    const {
      productId,
      quantity,
      userId,
      enableDeposit,
      depositAmount,
      depositType,
      paymentPlanId,
      paymentMethodId,
      shippingMethod,
      billingData,
      shippingData,
      variationId,
      variationAttributes
    }: {
      productId: number;
      quantity: number;
      userId: number;
      enableDeposit: 'yes' | 'no';
      depositAmount?: string;
      depositType?: string;
      paymentPlanId?: string;
      paymentMethodId: string;
      shippingMethod?: { id: string; title: string; cost: number };
      billingData: BillingData;
      shippingData: BillingData;
      variationId?: number;
      variationAttributes?: Array<{ name: string; option: string }>;
    } = await request.json();

    // Ottieni i dettagli del prodotto
    const productResponse = await WooCommerce.get(`products/${productId}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product: any = productResponse.data;

    if (!product) {
      return NextResponse.json({ error: 'Prodotto non trovato' }, { status: 404 });
    }

    // Verifica stock
    if (product.stock_status !== 'instock') {
      return NextResponse.json({ error: 'Prodotto non disponibile' }, { status: 400 });
    }

    // Calcola il prezzo
    const unitPrice = parseFloat(product.sale_price || product.price || '0');

    if (unitPrice <= 0) {
      return NextResponse.json({ error: 'Prezzo prodotto non valido' }, { status: 400 });
    }

    let productAmount = unitPrice * quantity;

    // Se l'acconto è abilitato, calcola l'importo dell'acconto
    if (enableDeposit === 'yes' && depositAmount) {
      const depositValue = parseFloat(depositAmount);
      if (depositType === 'percent') {
        productAmount = productAmount * (depositValue / 100);
      } else {
        productAmount = depositValue * quantity;
      }
    }

    // Calcola il costo della spedizione
    const shippingCost = shippingMethod?.cost ?? 0;

    // Totale che l'utente paga = prodotto + spedizione
    const totalAmount = productAmount + shippingCost;
    const stripeAmount = Math.round(totalAmount * 100); // Converti in centesimi

    // Il subtotale del prodotto (senza spedizione)
    const productSubtotal = productAmount;

    console.log('[PAYMENT-REQUEST] Step 1: Preparing order data', {
      productId,
      variationId,
      quantity,
      enableDeposit,
      depositAmount,
      depositType,
      paymentPlanId,
      productSubtotal: productSubtotal.toFixed(2),
      totalAmount: totalAmount.toFixed(2)
    });

    // Prepara i dati dell'ordine WooCommerce
    const lineItems = [];

    if (enableDeposit === 'yes') {
      lineItems.push({
        product_id: productId,
        quantity: quantity,
        subtotal: productSubtotal.toFixed(2),
        total: productSubtotal.toFixed(2),
        // IMPORTANTE: Aggiungi variation_id se presente
        ...(variationId && variationId > 0 && { variation_id: variationId }),
        meta_data: [
          // Aggiungi attributi della variazione se presenti
          ...(variationAttributes && Array.isArray(variationAttributes)
            ? variationAttributes.map((attr: { name: string; option: string }) => ({
                key: attr.name,
                value: attr.option
              }))
            : []
          ),
          { key: '_wc_convert_to_deposit', value: 'yes' },
          { key: '_wc_deposit_type', value: depositType || 'percent' },
          { key: '_wc_deposit_amount', value: depositAmount || '40' },
          ...(paymentPlanId ? [
            { key: '_wc_payment_plan', value: paymentPlanId },
            { key: '_deposit_payment_plan', value: paymentPlanId }
          ] : [])
        ]
      });
    } else {
      lineItems.push({
        product_id: productId,
        quantity: quantity,
        subtotal: productSubtotal.toFixed(2),
        total: productSubtotal.toFixed(2),
        // IMPORTANTE: Aggiungi variation_id se presente
        ...(variationId && variationId > 0 && { variation_id: variationId }),
        meta_data: [
          // Aggiungi attributi della variazione se presenti
          ...(variationAttributes && Array.isArray(variationAttributes)
            ? variationAttributes.map((attr: { name: string; option: string }) => ({
                key: attr.name,
                value: attr.option
              }))
            : []
          )
        ]
      });
    }

    // STEP 1: Crea l'ordine in WooCommerce PRIMA del pagamento
    // Questo previene il problema: pagamento OK ma ordine non creato
    console.log('[PAYMENT-REQUEST] Step 2: Creating WooCommerce order BEFORE payment');

    const orderData = {
      payment_method: 'stripe',
      payment_method_title: 'Apple Pay / Google Pay',
      status: 'pending', // Pending fino a conferma pagamento
      set_paid: false, // Sarà impostato a true dopo la conferma del pagamento
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
        email: billingData.email,
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
      shipping_lines: [
        {
          method_id: shippingMethod?.id || 'flat_rate',
          method_title: shippingMethod?.title || 'Spedizione Standard',
          total: (shippingMethod?.cost ?? 0).toFixed(2)
        }
      ],
      meta_data: [
        {
          key: '_payment_source',
          value: 'payment_request'
        },
        {
          key: '_stripe_amount_to_charge',
          value: totalAmount.toFixed(2)
        },
        {
          key: '_stripe_product_amount',
          value: productSubtotal.toFixed(2)
        },
        {
          key: '_stripe_shipping_amount',
          value: shippingCost.toFixed(2)
        }
      ]
    };

    let order;
    try {
      const orderResponse = await WooCommerce.post('orders', orderData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      order = orderResponse.data as any;
      console.log(`[PAYMENT-REQUEST] Step 3: Order #${order.id} created successfully`);
    } catch (orderError) {
      console.error('[PAYMENT-REQUEST] Step 3 FAILED: Order creation error:', orderError);
      // Se l'ordine non può essere creato, fermiamoci qui PRIMA di addebitare il cliente
      throw new Error(`Impossibile creare l'ordine: ${orderError instanceof Error ? orderError.message : 'Errore sconosciuto'}`);
    }

    // STEP 2: Ora che abbiamo l'ordine, crea e conferma il Payment Intent
    console.log(`[PAYMENT-REQUEST] Step 4: Creating Payment Intent for order #${order.id}`);

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: stripeAmount,
        currency: 'eur',
        payment_method: paymentMethodId,
        confirmation_method: 'automatic',
        confirm: true, // Conferma immediatamente
        return_url: `${origin}/checkout/success`,
        metadata: {
          wc_order_id: order.id.toString(), // ← FONDAMENTALE: ordine già creato
          product_id: productId.toString(),
          quantity: quantity.toString(),
          user_id: userId.toString(),
          enable_deposit: enableDeposit,
          payment_source: 'payment_request'
        }
      });

      console.log(`[PAYMENT-REQUEST] Step 5: Payment Intent ${paymentIntent.id} created with status: ${paymentIntent.status}`);

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
      console.error(`[PAYMENT-REQUEST] Step 5 FAILED: Payment error for order #${order.id}:`, paymentError);

      // Pagamento fallito → cancella l'ordine per evitare ordini orfani
      try {
        await WooCommerce.put(`orders/${order.id}`, {
          status: 'cancelled',
          customer_note: `Pagamento fallito: ${paymentError instanceof Error ? paymentError.message : 'Errore sconosciuto'}`
        });
        console.log(`[PAYMENT-REQUEST] Order #${order.id} cancelled due to payment failure`);
      } catch (cancelError) {
        console.error(`[PAYMENT-REQUEST] Failed to cancel order #${order.id}:`, cancelError);
      }

      throw paymentError;
    }

    // STEP 3: Se il pagamento è riuscito, aggiorna l'ordine
    if (paymentIntent.status === 'succeeded') {
      console.log(`[PAYMENT-REQUEST] Step 6: Payment succeeded, updating order #${order.id}`);

      try {
        await WooCommerce.put(`orders/${order.id}`, {
          status: 'processing',
          set_paid: true,
          transaction_id: paymentIntent.id
        });
        console.log(`[PAYMENT-REQUEST] Order #${order.id} marked as paid`);
      } catch (updateError) {
        console.error(`[PAYMENT-REQUEST] Warning: Failed to update order #${order.id}, webhook will handle it:`, updateError);
        // Non lanciare errore qui: il webhook può recuperare
        // L'importante è che wc_order_id sia nei metadata del Payment Intent
      }
    } else if (paymentIntent.status === 'requires_action') {
      console.log(`[PAYMENT-REQUEST] Payment requires additional action (3DS), order #${order.id} remains pending`);
    } else {
      console.warn(`[PAYMENT-REQUEST] Unexpected payment status: ${paymentIntent.status} for order #${order.id}`);
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentStatus: paymentIntent.status, // ← AGGIUNTO: status per frontend
      requiresAction: paymentIntent.status === 'requires_action' // ← AGGIUNTO: flag 3DS
    });

  } catch (error) {
    console.error('Errore durante la creazione dell\'ordine Payment Request:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Errore durante la creazione dell\'ordine'
    }, { status: 500 });
  }
}