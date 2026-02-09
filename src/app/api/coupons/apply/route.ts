import { NextResponse } from 'next/server';

const WP_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, items, email } = body;

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

    // Prepara gli items per l'endpoint WP
    const wpItems = items.map((item: Record<string, unknown>) => ({
      id: item.id,
      quantity: item.quantity || 1,
      price: item.price || item.regular_price || '0',
      sale_price: item.sale_price || '',
      variation_id: item.variation_id || 0,
      categories: item.categories || [],
    }));

    // Chiama il plugin WordPress per la validazione completa
    const wpResponse = await fetch(`${WP_URL}/wp-json/dreamshop/v1/validate-coupon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        items: wpItems,
        email: email || '',
      }),
    });

    const wpData = await wpResponse.json();

    if (!wpResponse.ok || !wpData.valid) {
      return NextResponse.json(
        { message: wpData.message || 'Coupon non valido' },
        { status: wpResponse.status || 400 }
      );
    }

    // Restituisci il risultato al frontend
    return NextResponse.json({
      discount: wpData.discount,
      free_shipping: wpData.free_shipping || false,
      coupon: wpData.coupon,
      items,
    });

  } catch (error: unknown) {
    console.error('Errore nell\'applicazione del coupon:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Errore nell\'applicazione del coupon' },
      { status: 500 }
    );
  }
}
