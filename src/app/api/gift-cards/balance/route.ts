import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

/**
 * API per recuperare il saldo gift card dell'utente
 * GET /api/gift-cards/balance
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Ottieni il token di autenticazione dagli header
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Gift Card API: Authorization header mancante o non valido');
    return NextResponse.json({ error: 'Authorization header mancante o non valido' }, { status: 401 });
  }
  
  // Estrai il token JWT
  const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
  
  try {
    // Decodifica il token JWT (stesso pattern degli altri endpoint)
    const jwtSecret = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';
    const decoded = jwt.verify(token, jwtSecret) as { id: number };
    
    const userId = decoded.id;
    console.log(`Gift Card API: Richiedo saldo per utente ${userId}`);
    
    // Chiama l'endpoint WordPress del nostro plugin
    const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL!;
    const baseUrl = wordpressUrl.endsWith('/') ? wordpressUrl : `${wordpressUrl}/`;
    
    const response = await fetch(`${baseUrl}wp-json/gift-card/v1/balance/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Passiamo le credenziali WooCommerce per l'autenticazione nel plugin
        'Authorization': 'Basic ' + Buffer.from(
          `${process.env.NEXT_PUBLIC_WC_CONSUMER_KEY}:${process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET}`
        ).toString('base64')
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gift Card API: Errore dal plugin WordPress: ${response.status}`, errorText);
      
      // Restituisci un saldo vuoto invece di fallire
      return NextResponse.json({
        success: true,
        user_id: userId,
        balance: 0,
        formatted_balance: '€0,00'
      });
    }
    
    const data = await response.json();
    console.log('Gift Card API: Saldo recuperato con successo:', data);
    
    // Restituisci i dati nel formato aspettato dal frontend
    return NextResponse.json({
      success: true,
      user_id: userId,
      balance: data.data?.balance || 0,
      formatted_balance: data.data?.formatted_balance || '€0,00'
    });
    
  } catch (error) {
    console.error('Gift Card API: Errore di autenticazione:', error);
    return NextResponse.json({ error: 'Errore di autenticazione' }, { status: 401 });
  }
}