import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import api from '@/lib/woocommerce'; // Importa l'istanza API WooCommerce configurata
import { AxiosError } from 'axios';

// Interfaccia per il payload JWT decodificato
interface JwtPayload {
  id: number;
  email?: string;
  iat?: number;
  exp?: number;
}

// Interfaccia per la risposta di errore di WooCommerce
interface WooCommerceErrorResponse {
  code?: string;
  message?: string;
  data?: {
    status?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

// Tipizzazione corretta per Next.js 14+ route handler
export async function POST(request: NextRequest) {
  // Ottieni l'id dal percorso dell'URL invece di usare params
  const id = request.nextUrl.pathname.split('/').pop() || '';
  console.log('API Complete Payment - Notifica completamento pagamento per rata ID:', id);
  
  // Ottieni il token dall'header Authorization
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('API Complete Payment: Token non fornito o formato non valido');
    return NextResponse.json({ error: 'Token non fornito o formato non valido' }, { status: 401 });
  }
  
  const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
  
  try {
    // Verifica il token JWT per ottenere l'ID utente
    const decoded = verify(token, JWT_SECRET) as JwtPayload;
    
    if (!decoded || !decoded.id) {
      console.error('API Complete Payment: Token JWT non valido', decoded);
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
    const userId = decoded.id;
    
    // Ottieni i dati dal corpo della richiesta
    const { paymentIntentId, paymentMethod } = await request.json();
    
    if (!paymentIntentId) {
      return NextResponse.json({ error: 'ID transazione mancante' }, { status: 400 });
    }
    
    console.log(`API Complete Payment: Completamento pagamento per utente ID ${userId}, ordine ${id}, metodo: ${paymentMethod}, transaction ID: ${paymentIntentId}`);
    
    try {
      // Prepara i dati da inviare a WooCommerce
      const orderData = {
        status: 'processing',
        set_paid: true,
        transaction_id: paymentIntentId,
        payment_method: paymentMethod || 'stripe',
        payment_method_title: paymentMethod === 'paypal' ? 'PayPal' : 'Carta di Credito (Stripe)'
      };

      console.log('API Complete Payment: Aggiornamento ordine WooCommerce con dati:', orderData);
      
      // Utilizza direttamente l'API WooCommerce con autenticazione OAuth (consumer key/secret)
      // Questo è lo stesso approccio usato per gli ordini normali che funziona
      const response = await api.put(`orders/${id}`, orderData);
      
      console.log('API Complete Payment: Risposta aggiornamento WooCommerce:', response.data);
      
      return NextResponse.json({
        success: true,
        message: 'Pagamento completato e notificato con successo',
        order: response.data
      });
      
    } catch (error: unknown) {
      // Cast dell'errore a AxiosError per accedere alle proprietà tipizzate
      const apiError = error as AxiosError<WooCommerceErrorResponse>;
      
      // Log dettagliato dell'errore per debug
      console.error('API Complete Payment: Errore durante la notifica a WooCommerce:', {
        message: apiError.message,
        response: apiError.response?.data,
        status: apiError.response?.status
      });
      
      return NextResponse.json({ 
        error: apiError.message || 'Errore durante la notifica del pagamento completato',
        details: apiError.response?.data
      }, { status: apiError.response?.status || 500 });
    }
    
  } catch (jwtError) {
    console.error('API Complete Payment: Errore nella verifica del token JWT:', jwtError);
    return NextResponse.json({ error: 'Token non valido o scaduto' }, { status: 401 });
  }
}
