import { NextRequest, NextResponse } from 'next/server';

const WP_URL = (process.env.NEXT_PUBLIC_WORDPRESS_URL || 'http://localhost:8080').replace(/\/$/, '');
const WC_KEY = process.env.NEXT_PUBLIC_WC_CONSUMER_KEY || '';
const WC_SECRET = process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET || '';

export async function GET(request: NextRequest) {
  // Extract token from URL path
  const pathSegments = request.nextUrl.pathname.split('/');
  const token = pathSegments[pathSegments.length - 1] || '';

  if (!token || token.length !== 64) {
    return NextResponse.json({ error: 'Token non valido' }, { status: 400 });
  }

  try {
    const auth = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');
    const response = await fetch(
      `${WP_URL}/wp-json/dreamshop-resin-shipping/v1/shipping-fee/${token}`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Spedizione non trovata' }, { status: 404 });
      }
      throw new Error(`WP API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API resin-shipping/[token] error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
