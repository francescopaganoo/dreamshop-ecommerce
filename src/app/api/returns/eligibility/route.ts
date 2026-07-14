import { NextRequest, NextResponse } from 'next/server';
import { callReturnsApi, requireUserId, ReturnsApiError } from '@/lib/returns-server';
import type { OrderEligibility } from '@/types/returns';

/**
 * Verifica se un ordine (e quali suoi articoli) può essere oggetto di recesso.
 * L'user_id passato a WordPress viene dal JWT verificato qui, mai dal client.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = requireUserId(request);

    const orderId = Number(new URL(request.url).searchParams.get('orderId'));
    if (!orderId || Number.isNaN(orderId)) {
      return NextResponse.json({ error: 'Parametro orderId mancante o non valido.' }, { status: 400 });
    }

    const eligibility = await callReturnsApi<OrderEligibility>(
      `/eligibility/${orderId}?user_id=${userId}`
    );

    return NextResponse.json(eligibility);
  } catch (error) {
    if (error instanceof ReturnsApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[returns] Errore in GET /api/returns/eligibility:', error);
    return NextResponse.json({ error: 'Errore interno del server.' }, { status: 500 });
  }
}
