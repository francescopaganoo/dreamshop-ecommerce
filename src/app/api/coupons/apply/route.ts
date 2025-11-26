import { NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, items, userId } = body;
    
    if (!code) {
      return NextResponse.json(
        { message: 'Codice coupon mancante' },
        { status: 400 }
      );
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: 'Carrello vuoto o non valido' },
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
      usage_limit_per_user?: number;
      usage_count: number;
      used_by?: string[];
      minimum_amount: string;
      maximum_amount: string;
      product_ids: number[];
      excluded_product_ids: number[];
      exclude_sale_items: boolean;
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
    
    // Verifica se il coupon ha raggiunto il limite di utilizzo globale
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return NextResponse.json(
        { message: 'Questo coupon ha raggiunto il limite di utilizzo' },
        { status: 400 }
      );
    }

    // Verifica se il coupon ha raggiunto il limite di utilizzo per utente
    if (coupon.usage_limit_per_user && userId) {
      const userUsageCount = coupon.used_by?.filter(id => id === userId.toString()).length || 0;
      if (userUsageCount >= coupon.usage_limit_per_user) {
        return NextResponse.json(
          { message: 'Hai già utilizzato questo coupon il numero massimo di volte consentito' },
          { status: 400 }
        );
      }
    }
    
    // Calcola il totale del carrello
    let cartTotal = 0;
    const updatedItems = [...items];
    
    for (const item of items) {
      // Verifica se item.product esiste prima di accedere a price
      // Supporta sia il formato {product: {price: ...}} che {price: ...}
      const itemPrice = parseFloat(
        item.product ? (item.product.price || item.product.regular_price || '0') : (item.price || item.regular_price || '0')
      ) || 0;
      const itemQuantity = item.quantity || 1;
      cartTotal += itemPrice * itemQuantity;
    }
    
    // Verifica l'importo minimo dell'ordine
    if (coupon.minimum_amount && parseFloat(coupon.minimum_amount) > cartTotal) {
      return NextResponse.json(
        { 
          message: `Questo coupon richiede un importo minimo di €${coupon.minimum_amount}`,
          minimumAmount: parseFloat(coupon.minimum_amount)
        },
        { status: 400 }
      );
    }
    
    // Verifica l'importo massimo dell'ordine
    if (coupon.maximum_amount && coupon.maximum_amount !== '' && parseFloat(coupon.maximum_amount) > 0 && parseFloat(coupon.maximum_amount) < cartTotal) {
      return NextResponse.json(
        { 
          message: `Questo coupon è valido solo per ordini fino a €${coupon.maximum_amount}`,
          maximumAmount: parseFloat(coupon.maximum_amount)
        },
        { status: 400 }
      );
    }
    
    // Calcola lo sconto in base al tipo di coupon
    let discount = 0;
    
    switch (coupon.discount_type) {
      case 'percent':
        // Sconto percentuale sul totale del carrello
        discount = cartTotal * (parseFloat(coupon.amount) / 100);
        break;
        
      case 'fixed_cart':
        // Sconto fisso sul totale del carrello
        discount = Math.min(parseFloat(coupon.amount), cartTotal);
        break;
        
      case 'fixed_product':
        // Sconto fisso su prodotti specifici
        let eligibleTotal = 0;
        
        for (const item of items) {
          // Gestisce sia il formato {product: {id: ...}} che {id: ...}
          const productId = item.product ? item.product.id : item.id;
          
          // Verifica se item.product esiste prima di accedere a price
          const itemPrice = parseFloat(
            item.product ? (item.product.price || item.product.regular_price || '0') : (item.price || item.regular_price || '0')
          ) || 0;
          const itemQuantity = item.quantity || 1;
          
          // Verifica la presenza di sale_price in entrambi i formati
          const hasSalePrice = item.product 
            ? !!item.product.sale_price 
            : !!item.sale_price;
          
          // Verifica se il prodotto è idoneo per lo sconto
          const isEligible = (
            // Se non ci sono product_ids specificati, tutti i prodotti sono idonei
            (coupon.product_ids.length === 0 || coupon.product_ids.includes(productId)) &&
            // Verifica che il prodotto non sia escluso
            !coupon.excluded_product_ids.includes(productId) &&
            // Verifica che il prodotto non sia in saldo se exclude_sale_items è true
            !(coupon.exclude_sale_items && hasSalePrice)
          );
          
          if (isEligible) {
            eligibleTotal += itemPrice * itemQuantity;
          }
        }
        
        // Applica lo sconto ai prodotti idonei
        discount = Math.min(parseFloat(coupon.amount), eligibleTotal);
        break;
    }
    
    // Arrotonda lo sconto a due decimali
    discount = Math.round(discount * 100) / 100;
    
    return NextResponse.json({
      discount,
      items: updatedItems,
      coupon
    });
    
  } catch (error: unknown) {
    console.error('Errore nell\'applicazione del coupon:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Errore nell\'applicazione del coupon' },
      { status: 500 }
    );
  }
}
