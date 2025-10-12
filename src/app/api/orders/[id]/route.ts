import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';
import jwt from 'jsonwebtoken';
import { Product } from '../../../../lib/api';

// Interface for WooCommerce Order
interface WooCommerceOrder {
  id: number;
  customer_id: number;
  status: string;
  total: string;
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    variation_id: number;
    quantity: number;
    price: string;
  }>;
  // Additional common WooCommerce order properties
  date_created?: string;
  date_modified?: string;
  payment_method?: string;
  payment_method_title?: string;
  billing?: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone?: string;
  };
  shipping?: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  currency: string;
  discount_total?: string;
  shipping_total?: string;
  // Index signature for any other properties that might exist
  [key: string]: unknown;
}

// Chiave segreta per verificare i token JWT (in produzione, usare una variabile d'ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

// Define the handler function for GET requests
export async function GET(
  request: NextRequest
) {
  try {
    // Ottieni l'ID dalla URL invece che dai parametri
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const orderId = pathParts[pathParts.length - 1];
    
    
    // Ottieni i dettagli dell'ordine prima di verificare l'autenticazione
    let order: WooCommerceOrder;
    try {
      const response = await api.get(`orders/${orderId}`);
      order = response.data as WooCommerceOrder;

      if (!order) {
        return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 });
      }
    } catch {
      return NextResponse.json({ error: 'Errore nel recupero dell\'ordine da WooCommerce' }, { status: 500 });
    }

    // OPZIONE 1: Verifica tramite JWT token (per utenti autenticati)
    const authHeader = request.headers.get('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        // Verifica il token
        jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

        // Token valido, procedi con l'arricchimento
      } catch (error) {
        console.error('Token JWT non valido:', error);
        return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
      }
    }
    // OPZIONE 2: Verifica tramite order_key (per ordini appena creati, es. guest checkout o express checkout)
    else {
      const orderKey = url.searchParams.get('order_key');

      // Se c'è un order_key, verificalo
      if (orderKey && order.order_key === orderKey) {
        console.log('[API] Access granted via order_key');
        // Order key valido, procedi
      }
      // Se non c'è né token né order_key, permetti comunque l'accesso (per retrocompatibilità)
      // TODO: In produzione, potresti voler richiedere sempre autenticazione
      else {
        console.log('[API] No authentication provided, allowing access for backwards compatibility');
      }
    }


    // Arricchisci i line_items con le immagini dei prodotti
    const enrichedLineItems = await Promise.all(
      order.line_items.map(async (item) => {
        // Skip se product_id è 0 o non valido (es. ordini rate/deposits eliminati)
        if (!item.product_id || item.product_id === 0) {
          return item; // Ritorna item senza immagine
        }

        try {
          const productResponse = await api.get(`products/${item.product_id}`);
          const product = productResponse.data as Product;
          return {
            ...item,
            image: product.images && product.images.length > 0 ? product.images[0] : null
          };
        } catch (error) {
          // Log solo se non è 404 (prodotto eliminato è normale)
          const is404 = error &&
                        typeof error === 'object' &&
                        'response' in error &&
                        error.response &&
                        typeof error.response === 'object' &&
                        'status' in error.response &&
                        error.response.status === 404;

          if (!is404) {
            console.error(`Error fetching product ${item.product_id}:`, error);
          }

          return item;
        }
      })
    );

    // Restituisci i dettagli dell'ordine con le immagini
    const enrichedOrder = {
      ...order,
      line_items: enrichedLineItems
    };

    return NextResponse.json(enrichedOrder);
    
  } catch (error) {
    console.error('Errore durante il recupero dell\'ordine:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}