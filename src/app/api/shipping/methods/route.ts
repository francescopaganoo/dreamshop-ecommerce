import { NextRequest, NextResponse } from 'next/server';
import { getShippingMethodsForAddress, ShippingAddressType, ShippingCartItem } from '@/lib/shipping-rates';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { shipping_address, cart_total = 0, cart_items = [] } = data as {
      shipping_address: ShippingAddressType,
      cart_total: number,
      cart_items?: ShippingCartItem[]
    };

    if (!shipping_address || !shipping_address.country) {
      return NextResponse.json({
        error: 'Indirizzo di spedizione non valido',
        methods: []
      });
    }


    try {
      const result = await getShippingMethodsForAddress(shipping_address, cart_total, cart_items);
      return NextResponse.json(result);

    } catch (error) {
      console.error('API: Errore nel recupero dei metodi di spedizione:', error);
      return NextResponse.json({
        error: 'Errore nel recupero dei metodi di spedizione',
        methods: []
      });
    }

  } catch (error) {
    console.error('API: Errore nella richiesta:', error);
    return NextResponse.json({
      error: 'Errore nella richiesta',
      methods: []
    });
  }
}
