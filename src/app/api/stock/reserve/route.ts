import { NextRequest, NextResponse } from 'next/server';
import { reserveStock, type StockGuardItem } from '@/lib/stock-guard';

// ============================================================================
// PRENOTAZIONE DISPONIBILITÀ - chiamata dal carrello al "Procedi all'acquisto"
// ============================================================================
//
// Fa da proxy verso il plugin WordPress, che è l'unico a conoscere la chiave API.
// Il token restituito accompagna il cliente per tutto il checkout e viene
// consumato alla creazione dell'ordine.
//
// Se il plugin è in modalità "solo log" la risposta è sempre 200: `wouldBlock`
// segnala cosa sarebbe stato bloccato, ma il cliente prosegue normalmente.
// ============================================================================

interface RequestBody {
  sessionId?: string;
  cartItems?: StockGuardItem[];
  context?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, cartItems, context } = (await request.json()) as RequestBody;

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ success: false, message: 'Nessun prodotto da prenotare' }, { status: 400 });
    }

    const result = await reserveStock({
      sessionId: sessionId || '',
      items: cartItems,
      context: context || 'cart-checkout',
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
      token: result.token,
      expiresAt: result.expiresAt,
      mode: result.mode,
      wouldBlock: result.wouldBlock,
      unavailable: result.unavailable,
      degraded: result.degraded,
    });
  } catch (error) {
    // Un errore qui non deve impedire di procedere all'acquisto.
    console.error('[stock/reserve] Errore, si prosegue senza prenotazione:', error);
    return NextResponse.json({ success: true, degraded: true });
  }
}
