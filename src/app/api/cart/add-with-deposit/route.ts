import { getAuthToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { product_id, enable_deposit, quantity, variation_id, payment_plan_id } = await request.json();
    
    console.log('Ricevuta richiesta di aggiunta al carrello con acconto:', {
      product_id, 
      enable_deposit, 
      quantity, 
      variation_id,
      payment_plan_id
    });
    
    if (!product_id) {
      return NextResponse.json(
        { success: false, message: 'ID prodotto mancante' },
        { status: 400 }
      );
    }
    
    // Converti quantità in numero se necessario
    const qty = typeof quantity === 'string' ? parseInt(quantity, 10) : quantity || 1;
    
    // Verifica validità variation_id (opzionale)
    const variationId = variation_id ? parseInt(String(variation_id), 10) : 0;
    
    // Recupera token di autenticazione se disponibile, ma non obbligatorio
    const token = await getAuthToken();
    console.log('Token di autenticazione disponibile:', !!token);
    
    // Verifica che l'URL di WordPress sia configurato
    if (!process.env.NEXT_PUBLIC_WORDPRESS_URL) {
      console.error('NEXT_PUBLIC_WORDPRESS_URL non configurato nel file .env');
      return NextResponse.json(
        { success: false, message: 'Configurazione server incompleta' },
        { status: 500 }
      );
    }
    
    // Utilizziamo l'endpoint personalizzato che abbiamo implementato nel plugin WordPress
    const wpEndpoint = `${process.env.NEXT_PUBLIC_WORDPRESS_URL}/wp-json/dreamshop/v1/cart/add-with-deposit`;
    console.log('Endpoint WordPress:', wpEndpoint);
    
    // Prepara i dati per l'endpoint personalizzato
    const requestData = {
      product_id: product_id,
      enable_deposit: enable_deposit,
      quantity: qty,
      variation_id: variationId,
      payment_plan_id: payment_plan_id // Aggiunto ID del piano di pagamento
    };
    
    console.log('Invio richiesta all\'endpoint personalizzato:', requestData);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Aggiungi il token all'header solo se è disponibile
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('Token aggiunto all\'header Authorization');
    } else {
      console.log('Token non disponibile, richiesta non autenticata');
    }
    
    const response = await fetch(wpEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestData)
    });
    
    console.log('Risposta dall\'endpoint personalizzato - Status:', response.status);
    
    if (!response.ok) {
      let errorMessage = `Errore dal server WordPress: ${response.status}`;
      try {
        const errorText = await response.text();
        console.error('Errore dal server WordPress:', response.status, errorText);
        errorMessage = `Errore dal server WordPress: ${response.status} - ${errorText}`;
      } catch (e) {
        console.error('Errore nel leggere la risposta di errore');
      }
      
      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Convertiamo la risposta di WooCommerce Store API nel formato atteso dal frontend
    return NextResponse.json({
      success: true,
      message: 'Prodotto aggiunto al carrello con successo',
      cart_item_key: data.id || '',
      cart_count: data.items_count || 0,
      cart_total: data.totals?.total || '0',
      checkout_url: `${process.env.NEXT_PUBLIC_WORDPRESS_URL}/checkout`
    });

  } catch (error) {
    console.error('Errore interno:', error);
    return NextResponse.json(
      { success: false, message: `Errore interno: ${error instanceof Error ? error.message : 'Errore sconosciuto'}` },
      { status: 500 }
    );
  }
}
