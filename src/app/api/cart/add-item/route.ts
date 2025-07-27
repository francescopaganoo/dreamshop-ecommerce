import { getAuthToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Estrai i dati dalla richiesta
    const cartItemData = await request.json();
    
    console.log('Ricevuta richiesta di aggiunta al carrello:', cartItemData);
    
    if (!cartItemData.id) {
      return NextResponse.json(
        { success: false, message: 'ID prodotto mancante' },
        { status: 400 }
      );
    }
    
    // Verifica che l'URL di WordPress sia configurato
    if (!process.env.NEXT_PUBLIC_WORDPRESS_URL) {
      console.error('NEXT_PUBLIC_WORDPRESS_URL non configurato nel file .env');
      return NextResponse.json(
        { success: false, message: 'Configurazione server incompleta' },
        { status: 500 }
      );
    }
    
    // Endpoint standard di WooCommerce per aggiungere prodotti al carrello
    const wpEndpoint = `${process.env.NEXT_PUBLIC_WORDPRESS_URL}/wp-json/wc/store/cart/add-item`;
    console.log('Endpoint WooCommerce Store API:', wpEndpoint);
    
    // Prepariamo gli header per la richiesta a WordPress
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Recupera token di autenticazione se disponibile (opzionale)
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('Token di autenticazione aggiunto all\'header');
    }
    
    // Tentiamo di recuperare i cookie dalla richiesta originale
    const requestCookies = request.headers.get('cookie');
    if (requestCookies) {
      headers['Cookie'] = requestCookies;
      console.log('Cookie recuperati dalla richiesta originale');
    }
    
    // Interfaccia per i metadati
    interface MetaData {
      key: string;
      value: string;
    }
    
    // Salva eventuali metadati per il post-processing
    const hasDepositMeta = cartItemData.meta_data?.some((meta: MetaData) => 
      meta.key === '_wc_convert_to_deposit' && meta.value === 'yes'
    );
    
    console.log('Prodotto con acconto:', hasDepositMeta ? 'Sì' : 'No');
    
    // Invia la richiesta a WooCommerce
    const response = await fetch(wpEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(cartItemData),
      credentials: 'include' // Per includere i cookie nella richiesta
    });
    
    console.log('Risposta da WooCommerce - Status:', response.status);
    
    // Gestione della risposta
    if (!response.ok) {
      let errorMessage = `Errore dal server WordPress: ${response.status}`;
      try {
        const errorText = await response.text();
        console.error('Errore dal server WordPress:', response.status, errorText);
        errorMessage = `Errore dal server WordPress: ${response.status} - ${errorText}`;
      } catch {
        console.error('Errore nel leggere la risposta di errore');
      }
      
      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: response.status }
      );
    }
    
    // Processa la risposta di successo
    try {
      const responseData = await response.json();
      console.log('Risposta da WooCommerce:', responseData);
      
      // Qui potremmo avviare il processo di conversione in acconto se necessario,
      // ma è meglio farlo al checkout
      
      // Recupera i cookie dalla risposta WordPress per la sessione
      const wpCookies = response.headers.get('set-cookie');
      
      // Restituisci una risposta al frontend
      const nextResponse = NextResponse.json({
        success: true,
        message: hasDepositMeta ? 'Prodotto con acconto aggiunto al carrello' : 'Prodotto aggiunto al carrello',
        ...responseData
      });
      
      // Se ci sono cookie nella risposta, inoltrarli al client
      if (wpCookies) {
        nextResponse.headers.set('set-cookie', wpCookies);
      }
      
      return nextResponse;
    } catch (e) {
      console.error('Errore nel processare la risposta JSON:', e);
      return NextResponse.json(
        { success: false, message: 'Errore nel processare la risposta' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Errore nell\'API route add-item:', error);
    return NextResponse.json(
      { success: false, message: `Errore server: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
