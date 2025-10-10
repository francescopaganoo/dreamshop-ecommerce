import { NextRequest, NextResponse } from 'next/server';
import { orderDataStore } from '../../../../lib/orderDataStore';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { orderData, pointsToRedeem, pointsDiscount } = data;

    // Genera un ID unico
    const dataId = orderDataStore.generateId();

    // Salva i dati
    orderDataStore.set(dataId, {
      orderData,
      pointsToRedeem: pointsToRedeem || 0,
      pointsDiscount: pointsDiscount || 0
    });

    return NextResponse.json({ dataId });

  } catch (error) {
    console.error('[STORE-ORDER-DATA] Errore:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataId = searchParams.get('dataId');

    if (!dataId) {
      return NextResponse.json({ error: 'Data ID mancante' }, { status: 400 });
    }

    const stored = orderDataStore.get(dataId);

    if (!stored) {
      return NextResponse.json({ error: 'Dati non trovati o scaduti' }, { status: 404 });
    }

    // Elimina i dati dopo il recupero (uso singolo)
    orderDataStore.delete(dataId);

    return NextResponse.json(stored);

  } catch (error) {
    console.error('[STORE-ORDER-DATA] Errore:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
