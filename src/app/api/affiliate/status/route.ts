import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';
const WP_URL = (process.env.NEXT_PUBLIC_WORDPRESS_URL || '').replace(/\/$/, '');
const WC_KEY = process.env.NEXT_PUBLIC_WC_CONSUMER_KEY || '';
const WC_SECRET = process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET || '';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ is_affiliate: false });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (!decoded || !decoded.id) {
      return NextResponse.json({ is_affiliate: false });
    }

    const auth = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');

    const response = await fetch(
      `${WP_URL}/wp-json/affiliate-coupon/v1/status?user_id=${decoded.id}`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({ is_affiliate: false });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API affiliate/status error:', error);
    return NextResponse.json({ is_affiliate: false });
  }
}
