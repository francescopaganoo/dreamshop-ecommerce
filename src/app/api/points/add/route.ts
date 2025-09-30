import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import api from '@/lib/woocommerce';

/**
 * API per aggiungere punti all'utente
 * POST /api/points/add
 */
export async function POST(request: NextRequest) {
  
  // Verifica l'autenticazione
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('API: Token non fornito');
    return NextResponse.json({ error: 'Token non fornito' }, { status: 401 });
  }
  
  const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
  
  try {
    // Decodifica il token per ottenere l'ID utente
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    
    if (!decoded || !decoded.id) {
      console.error('API: Token decodificato non valido o mancante ID utente');
      return NextResponse.json({ error: 'Token non valido o ID utente mancante' }, { status: 401 });
    }
    
    const userId = decoded.id;
    
    // Ottieni i dati dalla richiesta
    const requestData = await request.json();
    
    // Verifica che i dati necessari siano presenti
    if (!requestData.points || !requestData.order_id) {
      console.error('API: Dati mancanti nella richiesta');
      return NextResponse.json({ error: 'Dati mancanti: points e order_id sono obbligatori' }, { status: 400 });
    }
    
    
    try {
      // Usa l'API WooCommerce con autenticazione consumer key/secret
      const response = await api.post('points/add', {
        user_id: userId,
        points: requestData.points,
        description: requestData.description || `Punti guadagnati per l'ordine #${requestData.order_id}`,
        order_id: requestData.order_id
      });
      
      // Estrai i dati dalla risposta
      const responseData = response.data;
      
      return NextResponse.json(responseData);
    } catch (wcError: unknown) {
      // Tipizzazione dell'errore per accedere alle proprietà in modo sicuro
      const error = wcError as { response?: { data?: unknown; status?: number }; message?: string };
      return NextResponse.json(
        { error: `Errore nell'aggiunta dei punti: ${error.response?.status || 500}` }, 
        { status: error.response?.status || 500 }
      );
    }

  } catch {
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
