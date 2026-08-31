import { NextRequest, NextResponse } from 'next/server';
import { assertStockAvailable, renewReservation, type StockGuardItem } from '@/lib/stock-guard';

// ============================================================================
// CONTROLLO DISPONIBILITÀ PRIMA DEL PAGAMENTO
// ============================================================================
//
// Chiamato dal checkout subito prima di aprire PayPal, cioè nell'ultimo istante
// in cui fermarsi non costa un rimborso.
//
// La prenotazione del cliente viene rinnovata (il conto riparte da zero, così un
// pagamento lento non la fa scadere) ed esclusa dal conteggio, altrimenti il
// cliente risulterebbe in conflitto con se stesso.
// ============================================================================

interface RequestBody {
  cartItems?: StockGuardItem[];
  reservationToken?: string;
  context?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { cartItems, reservationToken, context } = (await request.json()) as RequestBody;

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ success: true });
    }

    const ctx = context || 'checkout-pre-payment';

    if (reservationToken) {
      await renewReservation(reservationToken, ctx);
    }

    const result = await assertStockAvailable({
      items: cartItems,
      context: ctx,
      excludeToken: reservationToken || '',
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          code: 'insufficient_stock',
          message: result.message,
          unavailable: result.unavailable,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: result.mode,
      wouldBlock: result.wouldBlock,
      degraded: result.degraded,
    });
  } catch (error) {
    // Non deve mai impedire di pagare.
    console.error('[stock/check] Errore, si prosegue:', error);
    return NextResponse.json({ success: true, degraded: true });
  }
}
