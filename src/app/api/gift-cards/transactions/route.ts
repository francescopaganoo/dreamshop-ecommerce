import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

/**
 * API per recuperare le transazioni gift card dell'utente
 * GET /api/gift-cards/transactions
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Ottieni il token di autenticazione dagli header
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authorization header mancante o non valido' }, { status: 401 });
  }
  
  // Estrai il token JWT
  const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
  
  try {
    // Decodifica il token JWT (stesso pattern degli altri endpoint)
    const jwtSecret = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';
    const decoded = jwt.verify(token, jwtSecret) as { id: number };
    
    const userId = decoded.id;
    
    // Ottieni parametri dalla query string
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    
    // Chiama l'endpoint WordPress del nostro plugin
    const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL!;
    const baseUrl = wordpressUrl.endsWith('/') ? wordpressUrl : `${wordpressUrl}/`;
    
    const response = await fetch(
      `${baseUrl}wp-json/gift-card/v1/transactions/${userId}?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Passiamo le credenziali WooCommerce per l'autenticazione nel plugin
          'Authorization': 'Basic ' + Buffer.from(
            `${process.env.NEXT_PUBLIC_WC_CONSUMER_KEY}:${process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET}`
          ).toString('base64')
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gift Card Transactions API: Errore dal plugin WordPress: ${response.status}`, errorText);
      
      // Restituisci una lista vuota invece di fallire
      return NextResponse.json({
        success: true,
        transactions: [],
        has_more: false
      });
    }
    
    const data = await response.json();
    
    // Restituisci i dati nel formato aspettato dal frontend
    return NextResponse.json({
      success: true,
      transactions: data.data?.transactions || [],
      has_more: data.data?.pagination?.has_more || false
    });
    
  } catch (error) {
    console.error('Gift Card Transactions API: Errore di autenticazione:', error);
    return NextResponse.json({ error: 'Errore di autenticazione' }, { status: 401 });
  }
}