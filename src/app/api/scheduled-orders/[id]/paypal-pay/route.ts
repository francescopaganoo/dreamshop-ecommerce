import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

// Chiave segreta per verificare i token JWT
const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

// Configurazione PayPal
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

export async function POST(request: NextRequest) {
  // Ottieni l'id dal percorso dell'URL invece di usare params
  const id = request.nextUrl.pathname.split('/').pop() || '';
  console.log('API scheduled-order PayPal payment - Richiesta di pagamento ricevuta per ID:', id);
  
  try {
    // Ottieni il token dall'header Authorization
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('API PayPal Payment: Token non fornito o formato non valido');
      return NextResponse.json({ error: 'Token non fornito o formato non valido' }, { status: 401 });
    }
    
    const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
    
    // Verifica il token JWT
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    
    if (!decoded || !decoded.id) {
      console.error('API PayPal Payment: Token JWT non valido');
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
    // Ottieni il corpo della richiesta che dovrebbe contenere l'importo
    const data = await request.json();
    console.log(`API PayPal Payment: Dati ricevuti:`, JSON.stringify(data, null, 2));
    
    // Estraiamo i dati necessari dalla richiesta
    const { amount } = data;
    
    if (!amount) {
      console.error('API PayPal Payment: Importo non fornito nella richiesta');
      return NextResponse.json({
        error: 'È necessario fornire l\'importo per creare un ordine PayPal'
      }, { status: 400 });
    }
    
    // Funzione per pulire l'importo da caratteri non numerici (eccetto il punto decimale)
    const cleanAmount = (amountStr: string): string => {
      // Rimuove tutti i caratteri non numerici e non punti
      // Per gestire sia valute con comma (,) che con punto (.)
      const cleaned = amountStr.replace(/[^0-9.,]/g, '').replace(',', '.');
      // Assicura che ci sia solo un punto decimale
      const parts = cleaned.split('.');
      if (parts.length > 2) {
        return parts[0] + '.' + parts.slice(1).join('');
      }
      return cleaned;
    };
    
    // Pulisce e parsa l'importo
    const cleanedAmount = cleanAmount(amount);
    console.log(`API PayPal Payment: Importo originale: ${amount}, pulito: ${cleanedAmount}`);
    
    // Assicuriamoci che l'importo sia una stringa valida con 2 decimali
    const parsedAmount = parseFloat(cleanedAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      console.error(`API PayPal Payment: Importo non valido ${amount} (pulito: ${cleanedAmount})`);
      return NextResponse.json({
        error: `Importo non valido: ${amount}`
      }, { status: 400 });
    }
    
    // Formatta l'importo con due decimali
    const formattedAmount = parsedAmount.toFixed(2);
    
    console.log(`API PayPal Payment: Creazione ordine PayPal per la rata ${id}, importo: ${formattedAmount}`);
    
    // Ottieni il dominio per i redirect URL
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    
    // Ottieni il token di accesso PayPal
    const tokenResponse = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`API PayPal Payment: Errore nell'autenticazione con PayPal: ${tokenResponse.status}`, errorText);
      return NextResponse.json({ 
        error: 'Errore nell\'autenticazione con PayPal'
      }, { status: 500 });
    }
    
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error('API PayPal Payment: Token PayPal non trovato nella risposta');
      return NextResponse.json({
        error: 'Errore nell\'autenticazione con PayPal'
      }, { status: 500 });
    }
    
    // Crea l'ordine PayPal
    const orderResponse = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'EUR',
            value: formattedAmount
          },
          description: `Pagamento rata pianificata #${id}`,
          custom_id: `scheduled_order_${id}_user_${decoded.id}`
        }],
        application_context: {
          brand_name: 'Dreamshop',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: `${origin}/account?tab=scheduled-orders&payment_success=true`,
          cancel_url: `${origin}/account?tab=scheduled-orders&canceled=true`
        }
      })
    });
    
    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      console.error('API PayPal Payment: Errore nella creazione dell\'ordine PayPal:', errorData);
      return NextResponse.json({
        error: 'Errore nella creazione dell\'ordine PayPal',
        details: errorData
      }, { status: orderResponse.status });
    }
    
    const order = await orderResponse.json();
    console.log('API PayPal Payment: Ordine PayPal creato con successo:', {
      id: order.id,
      status: order.status
    });
    
    // Restituisci l'ID dell'ordine PayPal
    return NextResponse.json({
      success: true,
      paypalOrderId: order.id,
      links: order.links
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Errore durante la creazione dell\'ordine PayPal';
    console.error('API PayPal Payment: Errore durante il processo di pagamento:', error);
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 });
  }
}
