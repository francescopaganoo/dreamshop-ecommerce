import { NextRequest, NextResponse } from 'next/server';
import { verify, sign } from 'jsonwebtoken';
import api from '@/lib/woocommerce'; // Importa l'istanza API WooCommerce configurata
import { AxiosError } from 'axios';
import { cookies } from 'next/headers';

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

// Durata del token in secondi (24 ore invece di default 1 ora)
const TOKEN_EXPIRY = 86400;

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
    const { paymentIntentId } = await request.json();
    
    if (!paymentIntentId) {
      return NextResponse.json({ error: 'ID transazione mancante' }, { status: 400 });
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
          }
        ]
      };
      
      // Primo aggiornamento: aggiunge i metadati
      await api.put(`orders/${id}`, metaData);
      
      // Secondo aggiornamento: cambia lo stato
      // Nota: alcuni stati potrebbero richiedere permessi speciali nell'API WooCommerce
      // Proviamo sia con 'completed' che con 'processing' se il primo fallisce
      const statusUpdate = {
        status: 'processing'
      };
      
      // Aggiorna lo stato dell'ordine
      const response = await api.put(`orders/${id}`, statusUpdate);
      
      
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
