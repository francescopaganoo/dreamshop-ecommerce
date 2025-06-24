import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import api from '@/lib/woocommerce';

/**
 * API per decurtare punti dall'utente
 * POST /api/points/redeem
 */
export async function POST(request: NextRequest) {
  console.log('[POINTS API] Richiesta decurtazione punti ricevuta');
  
  // Verifica l'autenticazione
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[POINTS API] Token non fornito');
    return NextResponse.json({ error: 'Token non fornito', success: false }, { status: 401 });
  }
  
  const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
  
  try {
    // Decodifica il token per ottenere l'ID utente
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    
    if (!decoded || !decoded.id) {
      console.error('[POINTS API] Token decodificato non valido o mancante ID utente');
      return NextResponse.json({ error: 'Token non valido o ID utente mancante', success: false }, { status: 401 });
    }
    
    const userId = decoded.id;
    console.log(`[POINTS API] Utente autenticato: ${userId}`);
    
    // Ottieni i dati dalla richiesta
    let requestData;
    try {
      requestData = await request.json();
      console.log('[POINTS API] Dati richiesta:', JSON.stringify(requestData));
    } catch (parseError) {
      console.error('[POINTS API] Errore nel parsing del JSON della richiesta:', parseError);
      return NextResponse.json({ error: 'Formato richiesta non valido', success: false }, { status: 400 });
    }
    
    // Verifica che i dati necessari siano presenti
    if (!requestData.points || requestData.points <= 0) {
      console.error(`[POINTS API] Punti non validi: ${requestData.points}`);
      return NextResponse.json({ 
        error: 'Dati mancanti o non validi: points deve essere un numero positivo', 
        success: false 
      }, { status: 400 });
    }
    
    // Verifica order_id
    const orderId = requestData.order_id || 0;
    console.log(`[POINTS API] Decurto ${requestData.points} punti per utente ${userId}, ordine #${orderId}`);
    
    try {
      // Usa l'API WooCommerce con autenticazione consumer key/secret
      console.log('[POINTS API] Chiamata a WooCommerce API points/redeem');
      const response = await api.post('points/redeem', {
        user_id: userId,
        points: requestData.points,
        description: requestData.description || `Punti utilizzati per uno sconto`,
        order_id: orderId
      });
      
      // Estrai i dati dalla risposta
      const responseData = response.data;
      console.log('[POINTS API] Punti decurtati con successo:', JSON.stringify(responseData));
      
      // Assicurati che la risposta includa il flag success
      // Crea un nuovo oggetto con i dati della risposta e il flag success
      const responseWithSuccess = {
        success: true,
        // Aggiungi altri campi dalla risposta se disponibili
        message: typeof responseData === 'object' ? (responseData as any).message || 'Punti decurtati con successo' : 'Punti decurtati con successo',
        points: typeof responseData === 'object' ? (responseData as any).points : undefined,
        user_id: userId,
        order_id: orderId,
        points_redeemed: requestData.points
      };
      
      return NextResponse.json(responseWithSuccess);
    } catch (wcError: unknown) {
      // Tipizzazione dell'errore per accedere alle proprietà in modo sicuro
      const error = wcError as { response?: { data?: unknown; status?: number }; message?: string };
      console.error('[POINTS API] Errore nella risposta WooCommerce:', error.response?.data || error.message);
      
      // Log dettagliato dell'errore
      if (error.response?.data) {
        console.error('[POINTS API] Dettagli errore WooCommerce:', JSON.stringify(error.response.data));
      }
      
      return NextResponse.json(
        { 
          error: `Errore nella decurtazione dei punti: ${error.response?.status || 500}`,
          success: false,
          details: error.response?.data || error.message
        }, 
        { status: error.response?.status || 500 }
      );
    }
    
  } catch (error: unknown) {
    // Log dettagliato dell'errore
    const err = error as Error;
    console.error('[POINTS API] Errore durante la decurtazione dei punti:', err.message);
    console.error('[POINTS API] Stack trace:', err.stack);
    return NextResponse.json({ 
      error: 'Errore interno del server', 
      success: false,
      message: err.message
    }, { status: 500 });
  }
}
