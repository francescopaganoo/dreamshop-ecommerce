import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';
const WP_URL = (process.env.NEXT_PUBLIC_WORDPRESS_URL || '').replace(/\/$/, '');
const WC_KEY = process.env.NEXT_PUBLIC_WC_CONSUMER_KEY || '';
const WC_SECRET = process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET || '';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Token non fornito' }, { status: 401 });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (!decoded || !decoded.id) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }

    const auth = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';

    let wpUrl = `${WP_URL}/wp-json/affiliate-coupon/v1/dashboard?user_id=${decoded.id}`;
    if (startDate) wpUrl += `&start_date=${encodeURIComponent(startDate)}`;
    if (endDate) wpUrl += `&end_date=${encodeURIComponent(endDate)}`;

    const response = await fetch(wpUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WP API error:', response.status, errorText);
      return NextResponse.json({ error: 'Errore nel recupero dati' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API affiliate/dashboard error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: 'Token non valido o scaduto' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
