import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

/**
 * API per riscattare una gift card
 * POST /api/gift-cards/redeem
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Ottieni il token di autenticazione dagli header
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Gift Card Redeem API: Authorization header mancante o non valido');
    return NextResponse.json({ error: 'Authorization header mancante o non valido' }, { status: 401 });
  }

  // Estrai il token JWT
  const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token

  try {
    // Decodifica il token JWT (stesso pattern degli altri endpoint)
    const jwtSecret = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';
    const decoded = jwt.verify(token, jwtSecret) as { id: number };

    const userId = decoded.id;

    // Ottieni i dati dal body della richiesta
    const body = await request.json();
    const { gift_card_code, user_id } = body;

    // Verifica che i dati siano presenti
    if (!gift_card_code || !user_id) {
      return NextResponse.json({
        success: false,
        message: 'Codice gift card e user ID sono richiesti'
      }, { status: 400 });
    }

    // Verifica che l'utente possa riscattare per se stesso
    if (userId !== user_id) {
      return NextResponse.json({
        success: false,
        message: 'Non puoi riscattare gift card per altri utenti'
      }, { status: 403 });
    }

    console.log(`Gift Card Redeem API: Riscatto per utente ${userId}, codice: ${gift_card_code}`);

    // Chiama l'endpoint WordPress del nostro plugin
    const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL!;
    const baseUrl = wordpressUrl.endsWith('/') ? wordpressUrl : `${wordpressUrl}/`;

    const response = await fetch(`${baseUrl}wp-json/gift-card/v1/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Passiamo le credenziali WooCommerce per l'autenticazione nel plugin
        'Authorization': 'Basic ' + Buffer.from(
          `${process.env.NEXT_PUBLIC_WC_CONSUMER_KEY}:${process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET}`
        ).toString('base64')
      },
      body: JSON.stringify({
        gift_card_code,
        user_id
      })
    });

    // Gestisci sia risposte di successo che di errore come JSON
    let data;
    try {
      data = await response.json();
    } catch {
      console.error(`Gift Card Redeem API: Impossibile parsare risposta JSON dal plugin WordPress: ${response.status}`);
      return NextResponse.json({
        success: false,
        message: 'Errore del server nel riscatto della gift card'
      }, { status: 500 });
    }

    if (!response.ok) {
      console.error(`Gift Card Redeem API: Errore dal plugin WordPress: ${response.status}`, data);

      // Se il plugin WordPress restituisce un messaggio di errore, usalo
      const errorMessage = data.message || data.data?.message || 'Errore nel riscatto della gift card';

      return NextResponse.json({
        success: false,
        message: errorMessage
      }, { status: response.status });
    }

    console.log('Gift Card Redeem API: Riscatto completato con successo:', data);

    // Restituisci i dati nel formato aspettato dal frontend
    if (data.success) {
      return NextResponse.json({
        success: true,
        data: {
          message: data.data.message,
          amount: data.data.amount,
          formatted_amount: data.data.formatted_amount,
          new_balance: data.data.new_balance,
          formatted_new_balance: data.data.formatted_new_balance
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: data.message || 'Errore nel riscatto della gift card'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Gift Card Redeem API: Errore:', error);

    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: 'Token JWT non valido' }, { status: 401 });
    }

    return NextResponse.json({
      success: false,
      message: 'Errore interno del server'
    }, { status: 500 });
  }
}