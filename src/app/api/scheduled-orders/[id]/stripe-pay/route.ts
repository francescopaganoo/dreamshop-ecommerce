import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { cookies } from 'next/headers';

// Interfaccia per il payload JWT decodificato
interface JwtPayload {
  id: number;
  email?: string;
  iat?: number;
  exp?: number;
}

// Interfaccia per un ordine pianificato
interface ScheduledOrder {
  id: number;
  order_id: number;
  date_created?: string;
  payment_date: string;
  amount: string;
  status: string;
  total: string; // Importo totale dell'ordine
  [key: string]: unknown | string | number | undefined; // Per altre proprietà che potrebbero essere presenti
}

// Chiave segreta per verificare i token JWT
const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

// Durata del token in secondi (24 ore invece di default 1 ora)
const TOKEN_EXPIRY = 86400;

// Inizializza Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
});

export async function POST(request: NextRequest) {
  // Ottieni l'id dal percorso dell'URL invece di usare params
  const pathSegments = request.nextUrl.pathname.split('/');
  // L'ID è il segmento prima di 'stripe-pay'
  const id = pathSegments[pathSegments.indexOf('stripe-pay') - 1] || '';
  
  // Ottieni il token dall'header Authorization o dai cookie come fallback
  const authHeader = request.headers.get('Authorization');
  let token;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
  } else {
    try {
      // In Next.js 14, cookies() restituisce una Promise
      const cookieStore = await cookies();
      token = cookieStore.get('auth_token')?.value;
      
      if (!token) {
        console.error('API Stripe Payment: Token non fornito né negli header né nei cookie');
        return NextResponse.json({ error: 'Token non fornito o formato non valido' }, { status: 401 });
      }
    } catch (cookieError) {
      console.error('API Stripe Payment: Errore nel recupero del token dai cookie', cookieError);
      return NextResponse.json({ error: 'Errore nel recupero del token' }, { status: 401 });
    }
  }
  
  try {
    // Verifica il token JWT
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    
    if (!decoded || !decoded.id) {
      console.error('API Stripe Payment: Token JWT non valido', decoded);
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
    // Log del timestamp di scadenza per debug
    if (decoded.exp) {
      const expDate = new Date(decoded.exp * 1000);
      const nowDate = new Date();
      const timeRemaining = Math.floor((expDate.getTime() - nowDate.getTime()) / 1000 / 60); // minuti rimanenti
      
      
      // Se il token sta per scadere (meno di 30 minuti), genera un nuovo token per le chiamate successive
      // Questo non influenza la richiesta corrente ma aiuta per le future
      if (timeRemaining < 30) {
        
        // Aggiornamento non bloccante del token nei cookie
        const newToken = jwt.sign({ id: decoded.id, email: decoded.email }, JWT_SECRET, {
          expiresIn: TOKEN_EXPIRY
        });
        
        try {
          // In Next.js 14, cookies() restituisce una Promise
          const cookieStore = await cookies();
          cookieStore.set({
            name: 'auth_token',
            value: newToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: TOKEN_EXPIRY,
            path: '/'
          });
        } catch (cookieError) {
          // Log dell'errore ma continua con l'esecuzione
          console.error('API Stripe Payment: Errore nell\'impostazione del nuovo token nei cookie', cookieError);
          // Non interrompiamo l'esecuzione per questo errore
        }
      }
    }
    
    
    try {
      // Ottiene i dettagli della rata pianificata
      const origin = request.headers.get('origin') || 'http://localhost:3000';
      const scheduledOrdersResponse = await fetch(`${origin}/api/scheduled-orders?user_id=${decoded.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!scheduledOrdersResponse.ok) {
        throw new Error(`Errore nel recupero delle rate pianificate: ${scheduledOrdersResponse.status}`);
      }
      
      const scheduledOrders = await scheduledOrdersResponse.json() as ScheduledOrder[];
      const scheduledOrder = scheduledOrders.find(order => order.id.toString() === id);
      
      if (!scheduledOrder) {
        throw new Error(`Rata pianificata con ID ${id} non trovata`);
      }
      
      
      // Converti l'importo in centesimi per Stripe
      const amount = Math.round(parseFloat(scheduledOrder.total) * 100);
      
      // Crea un nuovo PaymentIntent per questo pagamento
      const idempotencyKey = `scheduled_order_${id}_user_${decoded.id}_${Date.now()}`;
      
      // Crea un nuovo Payment Intent con Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'eur',
        metadata: {
          order_id: id,
          user_id: decoded.id.toString(),
          type: 'scheduled_payment'
        },
        description: `Pagamento rata pianificata #${id} per ordine #${scheduledOrder.parent_order_number}`,
        payment_method_types: ['card'],
        receipt_email: decoded.email || undefined
      }, {
        idempotencyKey
      });
      
      
      return NextResponse.json({
        success: true,
        clientSecret: paymentIntent.client_secret
      });
      
    } catch (error: unknown) {
      const apiError = error instanceof Error ? error : new Error('Errore sconosciuto');
      console.error('API Stripe Payment: Errore durante la creazione del Payment Intent:', apiError.message);
      return NextResponse.json({ 
        error: apiError.message || 'Errore durante la creazione del Payment Intent' 
      }, { status: 500 });
    }
    
  } catch (jwtError) {
    console.error('API Stripe Payment: Errore nella verifica del token JWT:', jwtError);
    return NextResponse.json({ error: 'Token non valido o scaduto' }, { status: 401 });
  }
}
