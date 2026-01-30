import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import { orderDataStore } from '../../../../lib/orderDataStore';
import { validateDepositEligibility, hasDepositInCartItems } from '../../../../lib/deposits';

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
  // Deposit/installment fields
  enableDeposit?: 'yes' | 'no';
  depositAmount?: string;
  depositType?: string;
  paymentPlanId?: string;
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

    // ========================================================================
    // VALIDAZIONE DEPOSITI - Gli ordini a rate richiedono autenticazione
    // ========================================================================
    const hasAnyDepositInCart = hasDepositInCartItems(cartItems);
    const depositValidation = validateDepositEligibility({
      userId,
      hasDeposit: hasAnyDepositInCart,
      context: 'payment-request-cart-order'
    });

    if (!depositValidation.isValid) {
      console.error(`[payment-request-cart-order] Ordine a rate bloccato: userId=${userId}, hasDeposit=${hasAnyDepositInCart}`);
      return NextResponse.json({
        error: depositValidation.error,
        errorCode: depositValidation.errorCode
      }, { status: 403 });
    }
    // ========================================================================

    // Verifica la disponibilità di tutti i prodotti e calcola il totale
    let subtotal = 0;
    const verifiedItems = [];
    let hasAnyDeposit = false; // Track if any item has deposit enabled

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

        // Check if this item has deposit enabled
        const itemHasDeposit = item.enableDeposit === 'yes';
        if (itemHasDeposit) {
          hasAnyDeposit = true;
        }

        // Calculate item total (with deposit if enabled)
        let itemTotal = unitPrice * item.quantity;
        const itemSubtotal = itemTotal; // Original price for WooCommerce line_item

        if (itemHasDeposit && item.depositAmount) {
          const depositValue = parseFloat(item.depositAmount);
          if (item.depositType === 'percent') {
            itemTotal = itemTotal * (depositValue / 100);
          } else {
            itemTotal = depositValue * item.quantity;
          }
        }

        subtotal += itemTotal;

        verifiedItems.push({
          product_id: item.product_id,
          variation_id: item.variation_id || null,
          quantity: item.quantity,
          price: unitPrice.toString(),
          total: itemTotal.toString(),
          subtotal: itemSubtotal.toString(),
          // Deposit metadata
          enableDeposit: item.enableDeposit || 'no',
          depositAmount: item.depositAmount,
          depositType: item.depositType,
          paymentPlanId: item.paymentPlanId
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

    // Prepara i line items per WooCommerce con supporto per acconti
    const lineItems = verifiedItems.map(item => {
      const baseLineItem: {
        product_id: number;
        variation_id?: number;
        quantity: number;
        subtotal?: string;
        total?: string;
        meta_data?: Array<{ key: string; value: string }>;
      } = {
        product_id: item.product_id,
        quantity: item.quantity
      };

      // Add variation_id if present
      if (item.variation_id) {
        baseLineItem.variation_id = item.variation_id;
      }

      // If deposit is enabled, add deposit metadata
      if (item.enableDeposit === 'yes') {
        baseLineItem.subtotal = item.total; // Deposit amount
        baseLineItem.total = item.total; // Deposit amount
        baseLineItem.meta_data = [
          { key: '_wc_convert_to_deposit', value: 'yes' },
          { key: '_wc_deposit_type', value: item.depositType || 'percent' },
          { key: '_wc_deposit_amount', value: item.depositAmount || '40' }
        ];

        // Add payment plan if present
        if (item.paymentPlanId) {
          baseLineItem.meta_data.push(
            { key: '_wc_payment_plan', value: item.paymentPlanId },
            { key: '_deposit_payment_plan', value: item.paymentPlanId }
          );
        }
      }

      return baseLineItem;
    });

    // Prepara le linee di spedizione
    const shippingLines = [];
    if (shippingOption && shippingCost > 0) {
      shippingLines.push({
        method_id: shippingOption.id,
        method_title: shippingOption.label,
        total: shippingCost.toFixed(2)
      });
    }

    // Prepara i dati dell'ordine (NON lo creiamo ancora)
    const orderData = {
      payment_method: 'stripe',
      payment_method_title: 'Apple Pay / Google Pay',
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

    // STEP 1: Salva i dati dell'ordine nello store (come Klarna e carta normale)
    // L'ordine verrà creato SOLO DOPO che il pagamento è confermato
    console.log('[PAYMENT-REQUEST-CART] Step 2: Saving order data to store (order will be created AFTER payment succeeds)');

    const dataId = orderDataStore.generateId();
    const saved = await orderDataStore.set(dataId, {
      orderData,
      pointsToRedeem: 0,
      pointsDiscount: discount
    });

    if (!saved) {
      console.error('[PAYMENT-REQUEST-CART] Failed to save order data to store');
      return NextResponse.json({ error: 'Errore nel salvataggio dei dati dell\'ordine' }, { status: 500 });
    }

    console.log(`[PAYMENT-REQUEST-CART] Step 3: Order data saved with ID: ${dataId}`);

    // STEP 2: Crea e conferma il Payment Intent (SENZA ordine WooCommerce)
    console.log('[PAYMENT-REQUEST-CART] Step 4: Creating Payment Intent (NO WooCommerce order yet)');

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
          order_data_id: dataId, // ← Riferimento ai dati salvati
          user_id: userId.toString(),
          items_count: cartItems.length.toString(),
          subtotal: subtotal.toString(),
          discount: discount.toString(),
          shipping_cost: shippingCost.toString(),
          payment_source: 'payment_request_cart',
          enable_deposit: hasAnyDeposit ? 'yes' : 'no'
        }
      });

      console.log(`[PAYMENT-REQUEST-CART] Step 5: Payment Intent ${paymentIntent.id} created with status: ${paymentIntent.status}`);

    } catch (paymentError) {
      console.error('[PAYMENT-REQUEST-CART] Step 5 FAILED: Payment error:', paymentError);

      // Pagamento fallito → elimina i dati dallo store (nessun ordine da cancellare!)
      try {
        await orderDataStore.delete(dataId);
        console.log(`[PAYMENT-REQUEST-CART] Order data ${dataId} deleted due to payment failure`);
      } catch (deleteError) {
        console.error(`[PAYMENT-REQUEST-CART] Failed to delete order data ${dataId}:`, deleteError);
      }

      throw paymentError;
    }

    // BEST PRACTICE STRIPE: L'ordine WooCommerce viene creato SOLO dal webhook
    // per evitare race condition tra route e webhook che causano ordini duplicati.
    // Il frontend fa redirect alla pagina success con payment_intent param,
    // dove un polling recupera l'order_id creato dal webhook.
    if (paymentIntent.status === 'succeeded') {
      console.log('[PAYMENT-REQUEST-CART] Step 6: Payment succeeded, webhook will create WooCommerce order');
    } else if (paymentIntent.status === 'requires_action') {
      console.log('[PAYMENT-REQUEST-CART] Payment requires additional action (3DS), webhook will create order');
    } else {
      console.warn(`[PAYMENT-REQUEST-CART] Unexpected payment status: ${paymentIntent.status}`);
    }

    // Restituisci i dati per il frontend. L'ordine verrà creato dal webhook.
    return NextResponse.json({
      success: true,
      order_id: null,
      order_number: null,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentStatus: paymentIntent.status,
      requiresAction: paymentIntent.status === 'requires_action',
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