import { NextRequest, NextResponse } from 'next/server';
import { commitReservation } from '@/lib/stock-guard';

// ============================================================================
// CONSUMO DELLA PRENOTAZIONE
// ============================================================================
//
// Da chiamare quando l'ordine WooCommerce esiste: da quel momento è WooCommerce
// a tenere il conto del magazzino e la prenotazione non serve più.
//
// Non blocca e non fallisce mai in modo visibile: l'ordine a questo punto è già
// stato creato, segnalare un errore qui non aiuterebbe nessuno.
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { token, orderId, context } = (await request.json()) as {
      token?: string;
      orderId?: number;
      context?: string;
    };

    if (token && orderId) {
      await commitReservation(token, Number(orderId), context || 'checkout-order-created');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[stock/commit] Errore:', error);
    return NextResponse.json({ success: true });
  }
}
