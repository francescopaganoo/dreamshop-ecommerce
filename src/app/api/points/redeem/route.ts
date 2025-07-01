import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

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
    
    // Configurazioni di base per la richiesta
    const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://be.dreamshop18.com/';
    const baseUrl = wordpressUrl.endsWith('/') ? wordpressUrl : `${wordpressUrl}/`;
    const requestBody = {
      user_id: userId, // Aggiungiamo esplicitamente l'ID utente
      points: requestData.points,
      description: requestData.description || `Punti utilizzati per uno sconto`,
      order_id: orderId
    };
    
    console.log(`[POINTS API] Parametri richiesta:`, JSON.stringify(requestBody));
    
    // Utilizza il nuovo endpoint sicuro con chiave API
    try {
      console.log('[POINTS API] Chiamata al nuovo endpoint sicuro secure-redeem');
      
      // Chiave API condivisa con il plugin WordPress tramite variabile d'ambiente
      const apiKey = process.env.POINTS_API_KEY;
      
      if (!apiKey) {
        console.error('[POINTS API] Errore: POINTS_API_KEY non configurata nelle variabili d\'ambiente');
        return NextResponse.json({
          error: 'Errore di configurazione del server',
          success: false,
          message: 'Chiave API non configurata'
        }, { status: 500 });
      }
      
      // Chiamata all'endpoint sicuro
      const secureEndpointResponse = await fetch(`${baseUrl}wp-json/dreamshop-points/v1/points/secure-redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey, // Utilizziamo la chiave API invece del token JWT
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(requestBody)
      });
      
      // Log della risposta per debug
      const responseStatus = secureEndpointResponse.status;
      console.log(`[POINTS API] Risposta endpoint secure-redeem: status ${responseStatus}`);
      
      if (secureEndpointResponse.ok) {
        // Risposta di successo
        const responseData = await secureEndpointResponse.json();
        console.log('[POINTS API] Punti decurtati con successo:', JSON.stringify(responseData));
        
        return NextResponse.json({
          success: true,
          message: responseData.message || 'Punti decurtati con successo',
          points: responseData.points || responseData.new_balance,
          user_id: userId,
          order_id: orderId,
          points_redeemed: requestData.points
        });
      } else {
        // Risposta di errore
        let errorMessage = 'Errore sconosciuto';
        try {
          const errorResponse = await secureEndpointResponse.json();
          errorMessage = errorResponse.message || JSON.stringify(errorResponse);
          console.error(`[POINTS API] Errore dall'endpoint secure-redeem:`, errorMessage);
        } catch (e) {
          // Se non riusciamo a parsificare la risposta come JSON, prova con il testo
          try {
            const errorText = await secureEndpointResponse.text();
            errorMessage = errorText || `Errore HTTP ${responseStatus}`;
            console.error(`[POINTS API] Errore dall'endpoint secure-redeem (testo):`, errorText);
          } catch (textError) {
            console.error(`[POINTS API] Impossibile leggere la risposta di errore:`, textError);
          }
        }
        
        return NextResponse.json({
          error: 'Errore nella decurtazione dei punti',
          success: false,
          message: errorMessage,
          status: responseStatus
        }, { status: responseStatus || 500 });
      }
    } catch (error) {
      // Errore di rete o altro errore non gestito
      console.error('[POINTS API] Errore durante la chiamata all\'endpoint secure-redeem:', error);
      
      return NextResponse.json({
        error: 'Errore di connessione',
        success: false,
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      }, { status: 500 });
    }
  } catch (error: unknown) {
    // Log dettagliato dell'errore generale
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
