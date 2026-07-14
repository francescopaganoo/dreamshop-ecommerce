import { NextRequest, NextResponse } from 'next/server';
import { callReturnsApi, requireUserId, ReturnsApiError } from '@/lib/returns-server';
import type { Withdrawal } from '@/types/returns';

/**
 * Dettaglio di una pratica di recesso, con la cronologia degli stati del reso.
 * WordPress restituisce 404 se la pratica non appartiene all'utente.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = requireUserId(request);

    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'Parametro id mancante o non valido.' }, { status: 400 });
    }

    const withdrawal = await callReturnsApi<Withdrawal>(`/withdrawals/${id}?user_id=${userId}`);

    return NextResponse.json(withdrawal);
  } catch (error) {
    if (error instanceof ReturnsApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[returns] Errore in GET /api/returns/detail:', error);
    return NextResponse.json({ error: 'Errore interno del server.' }, { status: 500 });
  }
}
