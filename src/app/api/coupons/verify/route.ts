import { NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';

export async function GET(request: Request) {
  try {
    // Ottieni il codice coupon dalla query
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json(
        { message: 'Codice coupon mancante' },
        { status: 400 }
      );
    }
    
    // Nota: Per semplificare, non verifichiamo l'autenticazione dell'utente in questa fase
    // Se in futuro è necessario, possiamo implementare un approccio più robusto
    
    // Define interface for coupon response
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

    // Cerca il coupon in WooCommerce
    const response = await api.get('coupons', {
      code: code
    });
    
    // Type assertion for the response data
    const coupons = response.data as CouponData[];
    
    if (!coupons || coupons.length === 0) {
      return NextResponse.json(
        { message: 'Coupon non valido o inesistente' },
        { status: 404 }
      );
    }
    
    const coupon = coupons[0];
    
    // Verifica se il coupon è scaduto
    if (coupon.date_expires_gmt && new Date(coupon.date_expires_gmt) < new Date()) {
      return NextResponse.json(
        { message: 'Questo coupon è scaduto' },
        { status: 400 }
      );
    }
    
    // Verifica se il coupon ha raggiunto il limite di utilizzo
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return NextResponse.json(
        { message: 'Questo coupon ha raggiunto il limite di utilizzo' },
        { status: 400 }
      );
    }
    
    // Nota: Abbiamo rimosso la verifica delle restrizioni email per semplificare
    // In una implementazione completa, qui verificheremmo se il coupon ha restrizioni per email
    
    // Se tutte le verifiche sono passate, restituisci il coupon
    return NextResponse.json({ coupon });
    
  } catch (error: unknown) {
    console.error('Errore nella verifica del coupon:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Errore nella verifica del coupon' },
      { status: 500 }
    );
  }
}
