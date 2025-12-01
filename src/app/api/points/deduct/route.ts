import { NextRequest, NextResponse } from 'next/server';

/**
 * API per decrementare solo i punti dell'utente (senza generare coupon)
 * Usato quando lo sconto è già applicato nelle fee_lines dell'ordine
 * POST /api/points/deduct
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const data = await request.json();
    const { userId, points, orderId, description } = data;

    // Validazione parametri
    if (!userId || userId <= 0) {
      return NextResponse.json({
        success: false,
        error: 'userId è obbligatorio e deve essere un numero positivo'
      }, { status: 400 });
    }

    if (!points || points <= 0) {
      return NextResponse.json({
        success: false,
        error: 'points è obbligatorio e deve essere un numero positivo'
      }, { status: 400 });
    }

    // Configurazione
    const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL!;
    const baseUrl = wordpressUrl.endsWith('/') ? wordpressUrl : `${wordpressUrl}/`;
    const apiKey = process.env.POINTS_API_KEY;

    if (!apiKey) {
      console.error('[DEDUCT POINTS] POINTS_API_KEY non configurata');
      return NextResponse.json({
        success: false,
        error: 'Configurazione server mancante'
      }, { status: 500 });
    }

    // Chiamata all'endpoint WordPress
    const response = await fetch(`${baseUrl}wp-json/dreamshop-points/v1/points/deduct-only`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        user_id: userId,
        points: points,
        order_id: orderId || 0,
        description: description || `Punti utilizzati per sconto ordine #${orderId || 'N/A'}`
      })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log(`[DEDUCT POINTS] Successo: userId=${userId}, points=${points}, orderId=${orderId}, newBalance=${result.new_balance}`);
      return NextResponse.json({
        success: true,
        message: result.message,
        userId: result.user_id,
        pointsDeducted: result.points_deducted,
        newBalance: result.new_balance,
        orderId: result.order_id
      });
    } else {
      console.error('[DEDUCT POINTS] Errore:', result);
      return NextResponse.json({
        success: false,
        error: result.message || 'Errore nel decremento dei punti'
      }, { status: response.status || 400 });
    }

  } catch (error) {
    console.error('[DEDUCT POINTS] Eccezione:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 });
  }
}
