import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const WP_URL = (process.env.NEXT_PUBLIC_WORDPRESS_URL || 'http://localhost:8080').replace(/\/$/, '');
const WC_KEY = process.env.NEXT_PUBLIC_WC_CONSUMER_KEY || '';
const WC_SECRET = process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET || '';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
});

export async function POST(request: NextRequest) {
  // Extract token from URL path
  const pathSegments = request.nextUrl.pathname.split('/');
  const tokenIndex = pathSegments.indexOf('stripe-pay') - 1;
  const token = pathSegments[tokenIndex] || '';

  if (!token || token.length !== 64) {
    return NextResponse.json({ error: 'Token non valido' }, { status: 400 });
  }

  try {
    // Fetch shipping fee details from WordPress
    const auth = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');
    const feeResponse = await fetch(
      `${WP_URL}/wp-json/dreamshop-resin-shipping/v1/shipping-fee/${token}`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!feeResponse.ok) {
      if (feeResponse.status === 404) {
        return NextResponse.json({ error: 'Spedizione non trovata' }, { status: 404 });
      }
      throw new Error(`WP API error: ${feeResponse.status}`);
    }

    const shippingFee = await feeResponse.json();

    if (shippingFee.payment_status === 'paid') {
      return NextResponse.json({ error: 'Questa spedizione è già stata pagata' }, { status: 400 });
    }

    // Create Stripe PaymentIntent
    const amount = Math.round(parseFloat(shippingFee.shipping_amount) * 100);

    if (amount <= 0) {
      return NextResponse.json({ error: 'Importo non valido' }, { status: 400 });
    }

    const idempotencyKey = `resin_shipping_${token}_${Date.now()}`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      metadata: {
        type: 'resin_shipping',
        token: token,
        shipping_fee_id: shippingFee.id.toString(),
        order_id: shippingFee.order_id.toString(),
        product_id: shippingFee.product_id.toString(),
      },
      description: `Spedizione resina per ordine #${shippingFee.order_number}`,
      payment_method_types: ['card'],
    }, {
      idempotencyKey
    });

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret
    });
  } catch (error: unknown) {
    const apiError = error instanceof Error ? error : new Error('Errore sconosciuto');
    console.error('API resin-shipping stripe-pay error:', apiError.message);
    return NextResponse.json({
      error: apiError.message || 'Errore durante la creazione del Payment Intent'
    }, { status: 500 });
  }
}
