import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import api from '@/lib/woocommerce';

/**
 * API per recuperare i punti dell'utente
 * GET /api/points/user
 */
export async function GET(request: NextRequest) {
  console.log('API: Richiesta punti utente ricevuta');
  
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
    console.log(`API: Richiedo punti per utente ${userId}`);
    
    try {
      // Usa l'API WooCommerce con autenticazione consumer key/secret
      const response = await api.get(`points/user/${userId}`);
      
      // Estrai i dati dalla risposta
      const data = response.data;
      console.log('API: Punti recuperati con successo');
      
      return NextResponse.json(data);
    } catch (wcError: any) {
      console.error('API: Errore nella risposta WooCommerce:', wcError.response?.data || wcError.message);
      return NextResponse.json(
        { error: `Errore nel recupero dei punti: ${wcError.response?.status || 500}` }, 
        { status: wcError.response?.status || 500 }
      );
    }
    
  } catch (error: unknown) {
    // Log dettagliato dell'errore
    console.error('API: Errore durante la richiesta dei punti:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
