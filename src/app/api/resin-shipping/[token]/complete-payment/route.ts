import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { resinShippingCustomId } from '@/lib/resinShipping';

const WP_URL = (process.env.NEXT_PUBLIC_WORDPRESS_URL || 'http://localhost:8080').replace(/\/$/, '');
const WC_KEY = process.env.NEXT_PUBLIC_WC_CONSUMER_KEY || '';
const WC_SECRET = process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET || '';

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API_URL = process.env.NODE_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
});

const AMOUNT_TOLERANCE = 0.01;

interface ShippingFee {
  id: number;
  shipping_amount: string;
  payment_status: string;
}

interface PayPalCapture {
  id: string;
  status: string;
  amount?: { currency_code: string; value: string };
}

interface PayPalOrder {
  id: string;
  status: string;
  purchase_units?: Array<{
    custom_id?: string;
    payments?: { captures?: PayPalCapture[] };
  }>;
}

class PaymentVerificationError extends Error {}

/**
 * Verify on PayPal that the order is captured, for this shipping fee and for the right amount.
 * Returns the capture ID to store on the shipping record.
 */
async function verifyPayPalPayment(paypalOrderId: string, fee: ShippingFee): Promise<string> {
  const tokenResponse = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  });
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error('Errore nell\'autenticazione con PayPal');
  }

  const orderResponse = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
  });
  if (!orderResponse.ok) {
    throw new PaymentVerificationError(`Ordine PayPal non trovato (${orderResponse.status})`);
  }

  const order = await orderResponse.json() as PayPalOrder;
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];

  if (order.status !== 'COMPLETED' || !capture || capture.status !== 'COMPLETED') {
    throw new PaymentVerificationError(
      `Pagamento PayPal non completato (ordine: ${order.status}, cattura: ${capture?.status || 'assente'})`
    );
  }

  if (unit?.custom_id !== resinShippingCustomId(fee.id)) {
    throw new PaymentVerificationError('Il pagamento PayPal non corrisponde a questa spedizione');
  }

  const paid = parseFloat(capture.amount?.value || '0');
  const expected = parseFloat(fee.shipping_amount);
  if (capture.amount?.currency_code !== 'EUR' || Math.abs(paid - expected) > AMOUNT_TOLERANCE) {
    throw new PaymentVerificationError(
      `Importo PayPal non corrispondente (pagato: ${capture.amount?.value} ${capture.amount?.currency_code}, atteso: ${fee.shipping_amount} EUR)`
    );
  }

  return capture.id;
}

/**
 * Verify on Stripe that the PaymentIntent succeeded for this shipping fee and amount.
 */
async function verifyStripePayment(paymentIntentId: string, token: string, fee: ShippingFee): Promise<void> {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status !== 'succeeded') {
    throw new PaymentVerificationError(`Pagamento Stripe non completato (stato: ${paymentIntent.status})`);
  }
  if (paymentIntent.metadata?.type !== 'resin_shipping' || paymentIntent.metadata?.token !== token) {
    throw new PaymentVerificationError('Il pagamento Stripe non corrisponde a questa spedizione');
  }
  const expectedCents = Math.round(parseFloat(fee.shipping_amount) * 100);
  if (paymentIntent.currency !== 'eur' || paymentIntent.amount_received !== expectedCents) {
    throw new PaymentVerificationError('Importo Stripe non corrispondente');
  }
}

export async function POST(request: NextRequest) {
  // Extract token from URL path
  const pathSegments = request.nextUrl.pathname.split('/');
  const tokenIndex = pathSegments.indexOf('complete-payment') - 1;
  const token = pathSegments[tokenIndex] || '';

  if (!token || token.length !== 64) {
    return NextResponse.json({ error: 'Token non valido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { paymentMethod, paypalOrderId, paymentIntentId, expectedTotal } = body;

    const auth = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');

    // Load the shipping fee: the amount to verify comes from WordPress, never from the client
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
      return NextResponse.json({ error: 'Spedizione non trovata' }, { status: feeResponse.status === 404 ? 404 : 500 });
    }
    const fee = await feeResponse.json() as ShippingFee;

    // Build the mark-paid payload only from a payment verified with the provider
    const markPaidData: Record<string, string> = {};

    try {
      if (paymentMethod === 'paypal') {
        if (!paypalOrderId) {
          return NextResponse.json({ error: 'ID ordine PayPal mancante' }, { status: 400 });
        }
        markPaidData.paypal_order_id = await verifyPayPalPayment(paypalOrderId, fee);
      } else if (paymentMethod === 'stripe') {
        if (!paymentIntentId) {
          return NextResponse.json({ error: 'ID pagamento Stripe mancante' }, { status: 400 });
        }
        await verifyStripePayment(paymentIntentId, token, fee);
        markPaidData.stripe_payment_intent_id = paymentIntentId;
      } else {
        return NextResponse.json({ error: 'Metodo di pagamento non valido' }, { status: 400 });
      }
    } catch (verificationError) {
      if (verificationError instanceof PaymentVerificationError) {
        console.error(`API resin-shipping complete-payment: verifica fallita per spedizione #${fee.id}:`, verificationError.message);
        return NextResponse.json({ error: verificationError.message }, { status: 402 });
      }
      throw verificationError;
    }

    // Call WordPress API to mark as paid
    const response = await fetch(
      `${WP_URL}/wp-json/dreamshop-resin-shipping/v1/shipping-fee/${token}/mark-paid`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(markPaidData)
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `WP API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: data.message || 'Pagamento completato',
      expectedTotal
    });
  } catch (error: unknown) {
    const apiError = error instanceof Error ? error : new Error('Errore sconosciuto');
    console.error('API resin-shipping complete-payment error:', apiError.message);
    return NextResponse.json({
      error: apiError.message || 'Errore nel completamento del pagamento'
    }, { status: 500 });
  }
}
