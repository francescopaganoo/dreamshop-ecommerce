import { NextRequest, NextResponse } from 'next/server';
import { callReturnsApi, clientIp, requireUserId, ReturnsApiError } from '@/lib/returns-server';
import type { Withdrawal, WithdrawalRequestItem } from '@/types/returns';

/**
 * Elenco dei recessi/resi dell'utente autenticato.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = requireUserId(request);

    const data = await callReturnsApi<{ withdrawals: Withdrawal[] }>(
      `/withdrawals?user_id=${userId}`
    );

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ReturnsApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[returns] Errore in GET /api/returns:', error);
    return NextResponse.json({ error: 'Errore interno del server.' }, { status: 500 });
  }
}

/**
 * Trasmette la dichiarazione di recesso.
 *
 * Da qui in poi il recesso è esercitato: WordPress registra il timestamp e invia la ricevuta
 * su supporto durevole. Nessuna approvazione precede questo passaggio, per legge.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = requireUserId(request);
    const body = await request.json();

    const orderId = Number(body?.orderId);
    const items = body?.items as WithdrawalRequestItem[] | undefined;

    if (!orderId || Number.isNaN(orderId)) {
      return NextResponse.json({ error: 'Ordine non valido.' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Seleziona almeno un articolo da restituire.' }, { status: 400 });
    }

    const invalid = items.some(
      (item) => !Number(item?.line_item_id) || !Number(item?.quantity) || Number(item.quantity) < 1
    );
    if (invalid) {
      return NextResponse.json({ error: 'Selezione degli articoli non valida.' }, { status: 400 });
    }

    const data = await callReturnsApi<{ success: boolean; withdrawal: Withdrawal }>('/withdrawals', {
      method: 'POST',
      forwardedFor: clientIp(request),
      body: {
        user_id: userId,
        order_id: orderId,
        items: items.map((item) => ({
          line_item_id: Number(item.line_item_id),
          quantity: Number(item.quantity),
        })),
        reason: typeof body?.reason === 'string' ? body.reason : '',
        reason_note: typeof body?.reasonNote === 'string' ? body.reasonNote : '',
      },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof ReturnsApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[returns] Errore in POST /api/returns:', error);
    return NextResponse.json({ error: 'Errore interno del server.' }, { status: 500 });
  }
}
