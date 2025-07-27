import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Ottieni l'ID del prodotto dai parametri dell'URL - deve essere await in Next.js 14
    const resolvedParams = await params;
    const productId = resolvedParams.id;
    
    if (!productId) {
      return NextResponse.json(
        { success: false, message: 'ID prodotto mancante' },
        { status: 400 }
      );
    }
    
    // Verifica che l'URL di WordPress sia configurato
    if (!process.env.NEXT_PUBLIC_WORDPRESS_URL) {
      return NextResponse.json(
        { success: false, message: 'Configurazione server incompleta' },
        { status: 500 }
      );
    }
    
    // Utilizziamo l'API Store di WooCommerce che è pubblica e non richiede autenticazione
    const wpEndpoint = `${process.env.NEXT_PUBLIC_WORDPRESS_URL}/wp-json/wc/store/products/${productId}`;
    
    // Prepariamo gli header per la richiesta a WordPress
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Recupera token di autenticazione se disponibile (opzionale)
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Inviamo la richiesta a WordPress
    const response = await fetch(wpEndpoint, {
      method: 'GET',
      headers: headers,
    });
    
    if (!response.ok) {
      console.error(`Errore dal server WordPress: ${response.status}`);
      return NextResponse.json(
        { success: false, message: `Errore dal server WordPress: ${response.status}` },
        { status: response.status }
      );
    }
    
    // Processa la risposta
    const product = await response.json();
    
    // Restituisci i dati del prodotto
    return NextResponse.json({
      success: true,
      product
    });
  } catch (error) {
    console.error(`Errore nella API route products/[id]: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json(
      { success: false, message: `Errore server: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
