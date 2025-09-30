import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

/**
 * API per generare un coupon gift card
 * POST /api/gift-cards/generate-coupon
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
    
    // Ottieni i dati dalla richiesta
    const body = await request.json();
    const { amount } = body;
    
    
    if (!amount || amount <= 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Importo non valido' 
      }, { status: 400 });
    }
    
    // Chiama l'endpoint WordPress del nostro plugin
    const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL!;
    const baseUrl = wordpressUrl.endsWith('/') ? wordpressUrl : `${wordpressUrl}/`;
    
    const response = await fetch(`${baseUrl}wp-json/gift-card/v1/generate-coupon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Passiamo le credenziali WooCommerce per l'autenticazione nel plugin
        'Authorization': 'Basic ' + Buffer.from(
          `${process.env.NEXT_PUBLIC_WC_CONSUMER_KEY}:${process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET}`
        ).toString('base64')
      },
      body: JSON.stringify({
        user_id: userId,
        amount: amount
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gift Card Generate Coupon API: Errore dal plugin WordPress: ${response.status}`, errorText);
      
      return NextResponse.json({
        success: false,
        message: `Errore nella generazione del coupon: ${response.status}`
      }, { status: response.status });
    }
    
    const data = await response.json();
    
    // Restituisci i dati nel formato aspettato dal frontend
    return NextResponse.json({
      success: true,
      coupon_code: data.data?.coupon_code || data.coupon_code,
      amount: data.data?.amount || data.amount,
      formatted_amount: data.data?.formatted_amount || data.formatted_amount,
      new_balance: data.data?.new_balance || data.new_balance,
      formatted_new_balance: data.data?.formatted_new_balance || data.formatted_new_balance
    });
    
  } catch (error) {
    console.error('Gift Card Generate Coupon API: Errore di autenticazione:', error);
    return NextResponse.json({ error: 'Errore di autenticazione' }, { status: 401 });
  }
}