import { NextRequest, NextResponse } from 'next/server';
import { verify, sign } from 'jsonwebtoken';
import api from '@/lib/woocommerce'; // Importa l'istanza API WooCommerce configurata
import { AxiosError } from 'axios';
import { cookies } from 'next/headers';
import Stripe from 'stripe';

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

// Interfaccia per l'ordine WooCommerce
interface WooCommerceOrder {
  id: number;
  status: string;
  meta_data?: Array<{
    key: string;
    value: string;
  }>;
  [key: string]: unknown;
}

const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

// Durata del token in secondi (24 ore invece di default 1 ora)
const TOKEN_EXPIRY = 86400;

// Inizializza Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
});

// Tipizzazione corretta per Next.js 14+ route handler
export async function POST(request: NextRequest) {
  // Ottieni l'id dal percorso dell'URL invece di usare params
  const pathSegments = request.nextUrl.pathname.split('/');
  // L'ID è il segmento prima di 'complete-payment'
  const id = pathSegments[pathSegments.indexOf('complete-payment') - 1] || '';
  
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
        console.error('API Complete Payment: Token non fornito né negli header né nei cookie');
        return NextResponse.json({ error: 'Token non fornito o formato non valido' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Errore nel recupero del token' }, { status: 401 });
    }
  }
  
  try {
    // Verifica il token JWT per ottenere l'ID utente
    const decoded = verify(token, JWT_SECRET) as JwtPayload;
    
    if (!decoded || !decoded.id) {
      console.error('API Complete Payment: Token JWT non valido', decoded);
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
    // Log del timestamp di scadenza per debug
    if (decoded.exp) {
      const expDate = new Date(decoded.exp * 1000);
      const nowDate = new Date();
      const timeRemaining = Math.floor((expDate.getTime() - nowDate.getTime()) / 1000 / 60); // minuti rimanenti
      
      
      // Se il token sta per scadere (meno di 30 minuti), genera un nuovo token per le chiamate successive
      if (timeRemaining < 30) {
        
        // Aggiornamento non bloccante del token nei cookie
        const newToken = sign({ id: decoded.id, email: decoded.email }, JWT_SECRET, {
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
          console.error('API Complete Payment: Errore nell\'impostazione del nuovo token nei cookie', cookieError);
          // Non interrompiamo l'esecuzione per questo errore
        }
      }
    }
    


    // Ottieni i dati dal corpo della richiesta
    const { paymentIntentId, paymentMethod } = await request.json();

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'ID transazione mancante' }, { status: 400 });
    }

    if (!paymentMethod || !['stripe', 'paypal'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Metodo di pagamento non valido' }, { status: 400 });
    }

    // SICUREZZA: Verifica che il pagamento sia effettivamente completato prima di aggiornare l'ordine
    try {
      if (paymentMethod === 'stripe') {
        // Verifica il Payment Intent su Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // Verifica che il pagamento sia confermato
        if (paymentIntent.status !== 'succeeded') {
          console.error(`API Complete Payment: Pagamento Stripe non confermato. Status: ${paymentIntent.status}`);
          return NextResponse.json({
            error: 'Pagamento non confermato',
            details: `Lo stato del pagamento è "${paymentIntent.status}" invece di "succeeded"`
          }, { status: 400 });
        }

        // Verifica che il Payment Intent sia per questo ordine specifico
        if (paymentIntent.metadata.order_id !== id) {
          console.error(`API Complete Payment: Payment Intent non corrisponde all'ordine. PI order_id: ${paymentIntent.metadata.order_id}, Expected: ${id}`);
          return NextResponse.json({
            error: 'Payment Intent non valido per questo ordine',
            details: 'L\'ID ordine nel Payment Intent non corrisponde'
          }, { status: 400 });
        }

        // Verifica che l'utente sia il proprietario dell'ordine
        if (paymentIntent.metadata.user_id !== decoded.id.toString()) {
          console.error(`API Complete Payment: Payment Intent appartiene a un altro utente. PI user_id: ${paymentIntent.metadata.user_id}, Expected: ${decoded.id}`);
          return NextResponse.json({
            error: 'Non autorizzato',
            details: 'Il Payment Intent appartiene a un altro utente'
          }, { status: 403 });
        }

        // NUOVO: Verifica che il webhook abbia già processato il pagamento
        // Questo è il controllo principale: il webhook è la fonte di verità
        if (paymentIntent.metadata.webhook_processed === 'true') {
          console.log(`API Complete Payment: Webhook già processato per Payment Intent ${paymentIntentId}`);
          // Il webhook ha già aggiornato l'ordine, restituiamo successo
          return NextResponse.json({
            success: true,
            message: 'Pagamento già processato dal webhook',
            webhook_processed: true
          });
        }

        // Se arriviamo qui, il pagamento è valido ma il webhook non ha ancora processato
        // Questo può succedere in caso di race condition o ritardo del webhook
        console.warn(`API Complete Payment: Pagamento valido ma webhook non ancora processato per PI ${paymentIntentId}`);
        // Procediamo comunque ma logghiamo per monitoraggio

      } else if (paymentMethod === 'paypal') {
        // Per PayPal, per ora logghiamo solo l'ID transazione
        console.warn('API Complete Payment: PayPal non implementato, saltare verifica webhook');
      }
    } catch (verificationError: unknown) {
      const error = verificationError as Error;
      console.error('API Complete Payment: Errore durante la verifica del pagamento:', error.message);
      return NextResponse.json({
        error: 'Errore durante la verifica del pagamento',
        details: error.message
      }, { status: 500 });
    }

    // Verifica che questo Payment Intent non sia già stato utilizzato per completare un ordine
    try {
      // Recupera l'ordine per verificare se ha già un transaction_id
      const orderResponse = await api.get(`orders/${id}`);
      const order = orderResponse.data as WooCommerceOrder;

      // Cerca il meta _transaction_id esistente
      const existingTransactionId = order.meta_data?.find(
        (meta: { key: string; value: string }) => meta.key === '_transaction_id'
      )?.value;

      // Verifica se il webhook ha già aggiornato l'ordine
      const webhookUpdated = order.meta_data?.find(
        (meta: { key: string; value: string }) => meta.key === '_webhook_updated'
      )?.value;

      if (webhookUpdated === 'true') {
        console.log(`API Complete Payment: Ordine già aggiornato dal webhook. Order: ${id}`);
        return NextResponse.json({
          success: true,
          message: 'Ordine già aggiornato dal webhook',
          webhook_processed: true,
          order: order
        });
      }

      if (existingTransactionId && existingTransactionId === paymentIntentId) {
        console.warn(`API Complete Payment: Payment Intent già utilizzato per questo ordine. PI: ${paymentIntentId}, Order: ${id}`);
        // Questo ordine è già stato pagato con questo Payment Intent - è un retry
        return NextResponse.json({
          success: true,
          message: 'Ordine già completato con questo Payment Intent',
          order: order
        });
      } else if (existingTransactionId && existingTransactionId !== paymentIntentId) {
        console.error(`API Complete Payment: L'ordine ha già un transaction_id diverso. Existing: ${existingTransactionId}, New: ${paymentIntentId}`);
        return NextResponse.json({
          error: 'Ordine già pagato con una transazione diversa',
          details: 'Questo ordine risulta già pagato'
        }, { status: 400 });
      }
    } catch (checkError: unknown) {
      // Se non riusciamo a verificare, è un errore critico
      console.error('API Complete Payment: Errore critico nella verifica transaction_id:', checkError);
      return NextResponse.json({
        error: 'Impossibile verificare lo stato dell\'ordine',
        details: 'Errore nel recupero dei dati dell\'ordine'
      }, { status: 500 });
    }

    try {
      // Utilizziamo l'API standard di WooCommerce ma con i parametri corretti
      // per aggiornare lo stato del pagamento pianificato

      // Aggiorniamo prima i metadati dell'ordine per segnalare che è stato pagato
      const metaData = {
        meta_data: [
          {
            key: '_wc_deposits_payment_completed',
            value: 'yes'
          },
          {
            key: '_transaction_id',
            value: paymentIntentId
          },
          {
            key: '_payment_method',
            value: paymentMethod
          },
          {
            key: '_payment_method_title',
            value: paymentMethod === 'stripe' ? 'Carta di Credito/Debito (Stripe)' : 'PayPal'
          }
        ]
      };

      // Primo aggiornamento: aggiunge i metadati
      await api.put(`orders/${id}`, metaData);

      // Secondo aggiornamento: cambia lo stato e il payment_method a livello di ordine
      // Nota: alcuni stati potrebbero richiedere permessi speciali nell'API WooCommerce
      const statusUpdate = {
        status: 'processing',
        payment_method: paymentMethod,
        payment_method_title: paymentMethod === 'stripe' ? 'Carta di Credito/Debito (Stripe)' : 'PayPal'
      };

      // Aggiorna lo stato dell'ordine
      const response = await api.put(`orders/${id}`, statusUpdate);

      return NextResponse.json({
        success: true,
        message: 'Pagamento completato e notificato con successo',
        order: response.data,
        payment_method: paymentMethod
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
