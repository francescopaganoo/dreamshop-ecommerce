import { getAuthToken } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Parsifica il corpo della richiesta
  const body = await request.json().catch(() => ({}));
  const { paymentPlanId } = body;

  // Ottieni il token di autenticazione se disponibile
  const token = await getAuthToken();

  // ========================================================================
  // VALIDAZIONE DEPOSITI - Gli ordini a rate richiedono autenticazione
  // Se c'è un paymentPlanId, significa che l'utente sta cercando di fare
  // un checkout con deposito/rate, quindi DEVE essere autenticato
  // ========================================================================
  if (paymentPlanId && !token) {
    console.error(`[deposit-checkout] Checkout deposito bloccato: paymentPlanId=${paymentPlanId}, token=null`);
    return NextResponse.json({
      success: false,
      error: 'Gli ordini a rate richiedono un account. Accedi o registrati per continuare con il pagamento rateale.',
      errorCode: 'DEPOSIT_REQUIRES_AUTH'
    }, { status: 403 });
  }
  // ========================================================================

  try {
    // Verifica che l'URL di WordPress sia configurato
    if (!process.env.NEXT_PUBLIC_WORDPRESS_URL) {
      console.error('NEXT_PUBLIC_WORDPRESS_URL non configurato nel file .env');
      return NextResponse.json(
        { success: false, message: 'Configurazione server incompleta' },
        { status: 500 }
      );
    }
    
    const wpEndpoint = `${process.env.NEXT_PUBLIC_WORDPRESS_URL}/wp-json/dreamshop/v1/cart/deposit-checkout`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Aggiungi il token all'header solo se è disponibile
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    
    // Prepariamo il corpo della richiesta con l'ID del piano di pagamento
    const requestBody = {
      paymentPlanId // Inviamo l'ID del piano di pagamento al backend
    };
    
    const response = await fetch(wpEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });
    

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Errore API WordPress: ${response.status}`, errorText);
      return NextResponse.json(
        { success: false, message: `Errore dal server WordPress: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Errore durante il recupero dell\'URL di checkout:', error);
    return NextResponse.json(
      { success: false, message: 'Errore durante il recupero dell\'URL di checkout' },
      { status: 500 }
    );
  }
}
