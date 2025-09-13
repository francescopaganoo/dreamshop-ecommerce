import { NextRequest, NextResponse } from 'next/server';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';

/**
 * API per validare un coupon gift card
 * POST /api/gift-cards/validate-coupon
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Ottieni i dati dalla richiesta
    const body = await request.json();
    const { coupon_code, cart_total } = body;
    
    console.log(`Gift Card Validate Coupon API: Validazione coupon ${coupon_code} per carrello €${cart_total}`);
    
    if (!coupon_code) {
      return NextResponse.json({
        success: false,
        message: 'Codice coupon mancante'
      }, { status: 400 });
    }
    
    // Usa l'API WooCommerce per validare il coupon
    const api = new WooCommerceRestApi({
      url: process.env.NEXT_PUBLIC_WORDPRESS_URL!,
      consumerKey: process.env.NEXT_PUBLIC_WC_CONSUMER_KEY!,
      consumerSecret: process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET!,
      version: 'wc/v3',
      queryStringAuth: true 
    });
    
    try {
      // Cerca il coupon in WooCommerce
      const couponResponse = await api.get(`coupons`, {
        code: coupon_code,
        per_page: 1
      });
      
      if (!couponResponse.data || !Array.isArray(couponResponse.data) || couponResponse.data.length === 0) {
        console.log(`Gift Card Validate Coupon API: Coupon ${coupon_code} non trovato`);
        return NextResponse.json({
          success: false,
          message: 'Coupon non trovato'
        });
      }
      
      const coupon = couponResponse.data[0];
      console.log(`Gift Card Validate Coupon API: Coupon trovato:`, coupon);
      
      // Verifica che sia un coupon gift card (generato dal nostro plugin)
      if (!coupon.code.startsWith('GC') || coupon.description !== 'Gift Card - Generato automaticamente') {
        console.log(`Gift Card Validate Coupon API: ${coupon_code} non è un coupon gift card`);
        return NextResponse.json({
          success: false,
          message: 'Questo coupon non è valido per le gift card'
        });
      }
      
      // Verifica stato del coupon
      if (coupon.status !== 'publish') {
        console.log(`Gift Card Validate Coupon API: Coupon ${coupon_code} non pubblicato`);
        return NextResponse.json({
          success: false,
          message: 'Coupon non attivo'
        });
      }
      
      // Verifica utilizzi
      if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
        console.log(`Gift Card Validate Coupon API: Coupon ${coupon_code} già utilizzato`);
        return NextResponse.json({
          success: false,
          message: 'Coupon già utilizzato'
        });
      }
      
      // Calcola lo sconto
      const coupon_amount = parseFloat(coupon.amount);
      const cart_total_num = parseFloat(cart_total) || 0;
      
      let discount_amount = 0;
      if (coupon.discount_type === 'fixed_cart') {
        discount_amount = Math.min(coupon_amount, cart_total_num);
      } else if (coupon.discount_type === 'percent') {
        discount_amount = (cart_total_num * coupon_amount) / 100;
      }
      
      const new_total = Math.max(0, cart_total_num - discount_amount);
      
      console.log(`Gift Card Validate Coupon API: Coupon ${coupon_code} valido - Sconto: €${discount_amount}`);
      
      return NextResponse.json({
        success: true,
        valid: true,
        coupon_code: coupon_code,
        coupon_amount: coupon_amount,
        discount_amount: discount_amount,
        formatted_discount: '€' + discount_amount.toFixed(2).replace('.', ','),
        cart_total: cart_total_num,
        new_total: new_total,
        message: 'Coupon valido'
      });
      
    } catch (apiError) {
      console.error('Gift Card Validate Coupon API: Errore API WooCommerce:', apiError);
      return NextResponse.json({
        success: false,
        message: 'Errore nella validazione del coupon'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Gift Card Validate Coupon API: Errore generale:', error);
    return NextResponse.json({
      success: false,
      message: 'Errore del server'
    }, { status: 500 });
  }
}