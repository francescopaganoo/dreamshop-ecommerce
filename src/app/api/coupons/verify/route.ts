import { NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';

/**
 * Verifica rapida dell'esistenza e validità base del coupon.
 * La validazione completa (categorie, email, limiti, ecc.) viene
 * delegata all'endpoint /api/coupons/apply che chiama il plugin WP.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { message: 'Codice coupon mancante' },
        { status: 400 }
      );
    }

    interface CouponData {
      id: number;
      code: string;
      amount: string;
      discount_type: string;
      date_expires_gmt?: string;
      usage_limit?: number;
      usage_count: number;
      minimum_amount: string;
      maximum_amount: string;
    }

    const response = await api.get('coupons', { code });
    const coupons = response.data as CouponData[];

    if (!coupons || coupons.length === 0) {
      return NextResponse.json(
        { message: 'Coupon non valido o inesistente' },
        { status: 404 }
      );
    }

    const coupon = coupons[0];

    // Check rapidi di base (la validazione completa avviene in /apply)
    if (coupon.date_expires_gmt && new Date(coupon.date_expires_gmt) < new Date()) {
      return NextResponse.json(
        { message: 'Questo coupon è scaduto' },
        { status: 400 }
      );
    }

    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return NextResponse.json(
        { message: 'Questo coupon ha raggiunto il limite di utilizzo' },
        { status: 400 }
      );
    }

    return NextResponse.json({ coupon });

  } catch (error: unknown) {
    console.error('Errore nella verifica del coupon:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Errore nella verifica del coupon' },
      { status: 500 }
    );
  }
}
