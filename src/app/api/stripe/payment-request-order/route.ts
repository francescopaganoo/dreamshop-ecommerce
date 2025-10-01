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
      paymentMethodId,
      billingData,
      shippingData
    }: {
      productId: number;
      quantity: number;
      userId: number;
      enableDeposit: 'yes' | 'no';
      paymentMethodId: string;
      billingData: BillingData;
      shippingData: BillingData;
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

    const totalAmount = unitPrice * quantity;
    const stripeAmount = Math.round(totalAmount * 100); // Converti in centesimi

    // Crea e conferma Payment Intent direttamente 
    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmount,
      currency: 'eur',
      payment_method: paymentMethodId,
      confirmation_method: 'automatic',
      confirm: true, // Conferma immediatamente 
      return_url: `${origin}/checkout/success`,
      metadata: {
        product_id: productId.toString(),
        quantity: quantity.toString(),
        user_id: userId.toString(),
        enable_deposit: enableDeposit,
        payment_source: 'payment_request'
      }
    });

    // Prepara i dati dell'ordine WooCommerce
    const lineItems = [];
    
    if (enableDeposit === 'yes') {
      // Logica per il deposito se necessaria
      const depositAmount = totalAmount * 0.3; // 30% di deposito
      
      lineItems.push({
        product_id: productId,
        quantity: quantity,
        meta_data: [
          {
            key: '_wc_deposit_meta',
            value: {
              enable: 'yes',
              deposit: depositAmount.toFixed(2),
              remaining: (totalAmount - depositAmount).toFixed(2)
            }
          }
        ]
      });
    } else {
      lineItems.push({
        product_id: productId,
        quantity: quantity
      });
    }

    // Crea l'ordine in WooCommerce
    const orderData = {
      payment_method: 'stripe',
      payment_method_title: 'Apple Pay / Google Pay',
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
          method_id: 'flat_rate',
          method_title: 'Spedizione Standard',
          total: '0.00'
        }
      ],
      meta_data: [
        {
          key: '_stripe_payment_intent_id',
          value: paymentIntent.id
        },
        {
          key: '_payment_source',
          value: 'payment_request'
        }
      ]
    };

    const orderResponse = await WooCommerce.post('orders', orderData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order: any = orderResponse.data;

    // Aggiorna il Payment Intent con l'order ID
    await stripe.paymentIntents.update(paymentIntent.id, {
      metadata: {
        ...paymentIntent.metadata,
        wc_order_id: order.id.toString()
      }
    });


    // Se il pagamento è confermato (in test mode), aggiorna lo stato dell'ordine
    if (paymentIntent.status === 'succeeded') {
      try {
        await WooCommerce.put(`orders/${order.id}`, {
          status: 'processing', // o 'completed' se preferisci
          set_paid: true,
          transaction_id: paymentIntent.id
        });
      } catch (updateError) {
        console.error('Errore aggiornamento ordine:', updateError);
        // Non fail tutto l'ordine per questo errore
      }
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('Errore durante la creazione dell\'ordine Payment Request:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Errore durante la creazione dell\'ordine'
    }, { status: 500 });
  }
}