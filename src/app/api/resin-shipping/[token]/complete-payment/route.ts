import { NextRequest, NextResponse } from 'next/server';

const WP_URL = (process.env.NEXT_PUBLIC_WORDPRESS_URL || 'http://localhost:8080').replace(/\/$/, '');
const WC_KEY = process.env.NEXT_PUBLIC_WC_CONSUMER_KEY || '';
const WC_SECRET = process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET || '';

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
    const { paymentMethod, transactionId, paypalOrderId, paymentIntentId, expectedTotal } = body;

    // Build the mark-paid payload
    const markPaidData: Record<string, string> = {};

    if (paymentMethod === 'paypal') {
      if (paypalOrderId) {
        markPaidData.paypal_order_id = paypalOrderId;
      }
      if (transactionId) {
        markPaidData.paypal_order_id = transactionId;
      }
    } else if (paymentMethod === 'stripe') {
      if (paymentIntentId) {
        markPaidData.stripe_payment_intent_id = paymentIntentId;
      }
    }

    // Call WordPress API to mark as paid
    const auth = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');
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
