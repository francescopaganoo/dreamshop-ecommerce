import { NextRequest, NextResponse } from 'next/server';
import { quoteWalletShipping, ShippingUnavailableError, WalletShippingItem } from '@/lib/shipping-rates';

// Spedizione da mostrare nel foglio Apple Pay / Google Pay quando cambia
// l'indirizzo. Usa lo stesso calcolo con cui le route di pagamento verificano
// la spedizione prima di addebitare, cosi' wallet e addebito non divergono.
export async function POST(request: NextRequest) {
  try {
    const { country, cart_total = 0, items = [], coupon_code = '' } = await request.json() as {
      country: string;
      cart_total?: number;
      items?: WalletShippingItem[];
      coupon_code?: string;
    };

    const quote = await quoteWalletShipping({ country, cartTotal: cart_total, items, couponCode: coupon_code });

    return NextResponse.json({
      method: {
        id: quote.id,
        title: quote.title,
        description: quote.description,
        cost: quote.cost
      }
    });

  } catch (error) {
    if (error instanceof ShippingUnavailableError) {
      return NextResponse.json({ error: error.message, errorCode: 'SHIPPING_UNAVAILABLE' }, { status: 422 });
    }

    console.error('[wallet-quote] Errore nel calcolo della spedizione:', error);
    return NextResponse.json({ error: 'Errore nel calcolo della spedizione' }, { status: 500 });
  }
}
