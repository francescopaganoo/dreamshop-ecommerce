import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';

// Chiave segreta per verificare i token JWT
const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

// Inizializza Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  console.log('API scheduled-order Stripe payment - Richiesta di pagamento ricevuta per ID:', params.id);
  
  // Ottieni il token dall'header Authorization
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('API Stripe Payment: Token non fornito o formato non valido');
    return NextResponse.json({ error: 'Token non fornito o formato non valido' }, { status: 401 });
  }
  
  const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
  
  try {
    // Verifica il token JWT
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (!decoded || !decoded.id) {
      console.error('API Stripe Payment: Token JWT non valido', decoded);
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
    console.log(`API Stripe Payment: Processando pagamento per utente ID ${decoded.id}, ordine ${params.id}`);
    
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
      
      const scheduledOrders = await scheduledOrdersResponse.json();
      const scheduledOrder = scheduledOrders.find((order: any) => order.id.toString() === params.id);
      
      if (!scheduledOrder) {
        throw new Error(`Rata pianificata con ID ${params.id} non trovata`);
      }
      
      console.log('API Stripe Payment: Dettagli rata pianificata:', JSON.stringify(scheduledOrder, null, 2));
      
      // Converti l'importo in centesimi per Stripe
      const amount = Math.round(parseFloat(scheduledOrder.total) * 100);
      
      // Crea un nuovo PaymentIntent per questo pagamento
      const idempotencyKey = `scheduled_order_${params.id}_user_${decoded.id}_${Date.now()}`;
      console.log(`API Stripe Payment: Usando idempotency key: ${idempotencyKey}`);
      
      // Crea un nuovo Payment Intent con Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'eur',
        metadata: {
          order_id: params.id,
          user_id: decoded.id.toString(),
          type: 'scheduled_payment'
        },
        description: `Pagamento rata pianificata #${params.id} per ordine #${scheduledOrder.parent_order_number}`,
        payment_method_types: ['card'],
        receipt_email: decoded.email || undefined
      }, {
        idempotencyKey
      });
      
      console.log(`API Stripe Payment: Payment Intent creato con ID ${paymentIntent.id}`);
      
      return NextResponse.json({
        success: true,
        clientSecret: paymentIntent.client_secret
      });
      
    } catch (apiError: any) {
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
