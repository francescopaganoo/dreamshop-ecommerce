import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// Chiave segreta per verificare i token JWT (stessa usata negli altri endpoint)
const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

export async function GET(request: NextRequest) {
  // Ottieni l'id dal percorso dell'URL invece di usare params
  const orderId = request.nextUrl.pathname.split('/').pop() || '';
  
  if (!orderId) {
    return NextResponse.json({ error: 'ID ordine non fornito' }, { status: 400 });
  }
  
  // Ottieni il token dall'header Authorization
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('API: Token non fornito o formato non valido');
    return NextResponse.json({ error: 'Token non fornito o formato non valido' }, { status: 401 });
  }
  
  const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
  
  try {
    // Verifica il token
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    
    if (!decoded || !decoded.id) {
      console.error('API: Token decodificato non valido o mancante ID utente');
      return NextResponse.json({ error: 'Token non valido o ID utente mancante' }, { status: 401 });
    }
    
    
    try {
      // Formatta l'URL correttamente per l'API WordPress
      let baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || '';
      baseUrl = baseUrl.replace(/\/$/, ''); // Rimuovi eventuali slash finali
      
      // Costruiamo l'URL per l'endpoint personalizzato
      const apiUrl = `${baseUrl}/wp-json/dreamshop/v1/scheduled-orders/${orderId}?user_id=${decoded.id}`;

      
      // Chiamiamo direttamente l'endpoint con fetch
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Errore chiamata diretta API WordPress: ${response.status}`, errorText);
        return NextResponse.json(
          { error: `Errore API: ${response.status}` }, 
          { status: response.status }
        );
      }
      
      const data = await response.json();
      return NextResponse.json(data);
    } catch (error: unknown) {
      const apiError = error instanceof Error ? error : new Error('Errore sconosciuto');
      console.error('Errore chiamata API diretta:', apiError.message);
      return NextResponse.json(
        { error: `Errore del server: ${apiError.message}` }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Errore nella verifica del token:', error);
    return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
  }
}