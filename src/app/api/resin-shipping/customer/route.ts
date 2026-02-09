import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  id: number;
  email?: string;
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';
const WP_URL = (process.env.NEXT_PUBLIC_WORDPRESS_URL || 'http://localhost:8080').replace(/\/$/, '');
const WC_KEY = process.env.NEXT_PUBLIC_WC_CONSUMER_KEY || '';
const WC_SECRET = process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET || '';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    return NextResponse.json({ error: 'Token non fornito' }, { status: 401 });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    if (!decoded || !decoded.id) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }

    const customerId = decoded.id;

    // Call WordPress REST API with Basic Auth (WooCommerce consumer keys)
    // Pass customer_id as query parameter since the JWT formats differ between Next.js and WP
    const auth = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');
    const response = await fetch(
      `${WP_URL}/wp-json/dreamshop-resin-shipping/v1/customer/shipping-fees?customer_id=${customerId}`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      // If the plugin is not active or endpoint doesn't exist, return empty array
      if (response.status === 404) {
        console.warn('Resin shipping plugin endpoint not found (404) - plugin may not be activated');
        return NextResponse.json([]);
      }
      const errorText = await response.text();
      console.error('WP API error:', response.status, errorText);
      throw new Error(`WP API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API resin-shipping/customer error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: 'Token non valido o scaduto' }, { status: 401 });
    }
    // Return empty array instead of error so the tab doesn't show an error message
    // when the WP plugin is not yet active
    return NextResponse.json([]);
  }
}
