import { getAuthToken } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Parsifica il corpo della richiesta
  const body = await request.json().catch(() => ({}));
  const { productId, deposit_option, paymentPlanId } = body;
  
  // Log SUPER dettagliato dei dati ricevuti per debug
  console.log('===================== DEBUG CHECKOUT DEPOSIT =====================');
  console.log('BODY COMPLETO RICEVUTO:', JSON.stringify(body, null, 2));
  console.log('Dati ricevuti dalla chiamata frontend:');
  console.log('- Prodotto ID:', productId);
  console.log('- Opzione acconto:', deposit_option);
  console.log('- Piano di pagamento ID:', paymentPlanId);
  console.log('- Tipo piano di pagamento:', typeof paymentPlanId);
  console.log('- Piano di pagamento valido:', paymentPlanId ? 'SÌ' : 'NO');
  console.log('- Valore effettivo del paymentPlanId:', String(paymentPlanId));
  console.log('- paymentPlanId è null?', paymentPlanId === null);
  console.log('- paymentPlanId è undefined?', paymentPlanId === undefined);
  console.log('==============================================================');
  
  // Ottieni il token di autenticazione se disponibile (ora opzionale)
  const token = await getAuthToken();
  
  // Rimosso controllo di autenticazione obbligatorio per permettere checkout anche agli utenti guest

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
    console.log('Endpoint WordPress:', wpEndpoint);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Aggiungi il token all'header solo se è disponibile
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.log('Invio richiesta checkout a WordPress');
    
    // Prepariamo il corpo della richiesta con l'ID del piano di pagamento
    const requestBody = {
      paymentPlanId // Inviamo l'ID del piano di pagamento al backend
    };
    
    const response = await fetch(wpEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });
    
    console.log('Risposta ricevuta da WordPress - Status:', response.status);

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
