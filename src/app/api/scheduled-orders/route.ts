import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import api from '@/lib/woocommerce';

// Interfacce per tipizzare i dati
interface OrderMetaData {
  key: string;
  value: string | number | boolean | null;
  display_key?: string;
  display_value?: string;
}

interface WooOrder {
  id: number;
  parent_id?: number;
  number?: string;
  status: string;
  status_name?: string;
  date_created: string;
  total: string;
  currency_symbol: string;
  payment_url?: string;
  meta_data?: OrderMetaData[];
  [key: string]: unknown;
}

interface ScheduledOrder {
  id: number;
  parent_id: number;
  parent_order_number: string;
  date_created: string;
  status: string;
  status_name: string;
  total: string;
  formatted_total: string;
  payment_url: string;
  view_url: string;
}

// Chiave segreta per verificare i token JWT (stessa usata negli altri endpoint)
const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

export async function GET(request: NextRequest) {
  
  // Ottieni il parametro page dalla URL
  const url = new URL(request.url);
  const page = url.searchParams.get('page') || '1';
  
  
  // Ottieni il token dall'header Authorization
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('API: Token non fornito o formato non valido');
    return NextResponse.json({ error: 'Token non fornito o formato non valido' }, { status: 401 });
  }
  
  const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
  
  try {
    // Verifica il token
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    
    if (!decoded || !decoded.id) {
      console.error('API: Token decodificato non valido o mancante ID utente');
      return NextResponse.json({ error: 'Token non valido o ID utente mancante' }, { status: 401 });
    }
    
  
  try {
    // Recuperiamo gli ordini standard tramite WooCommerce API e filtriamo
    // quelli relativi a depositi/acconti nel nostro codice
    try {
      const ordersResponse = await api.get(`orders?customer=${decoded.id}&per_page=100&page=${page}&orderby=date&order=desc`);
      
      // Verifichiamo che data sia un array e gestiamo il tipo unknown
      const orders = Array.isArray(ordersResponse.data) ? ordersResponse.data : [];

      // Filtriamo TUTTI gli ordini e poi facciamo debug per capire quali sono pianificati
      // Non escludiamo nulla inizialmente per debugging
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const allPotentialScheduledOrders = orders
        .filter(() => {
          // Non filtriamo nulla per ora, prendiamo tutti gli ordini per debug
          return true;
        })
        .map((order: WooOrder) => {
          // Trasformiamo nel formato atteso
          return {
            id: order.id,
            parent_id: order.parent_id || 0,
            parent_order_number: order.meta_data?.find((m: OrderMetaData) => m.key === '_deposit_parent_order_number')?.value?.toString() || '',
            date_created: order.date_created,
            status: order.status,
            status_name: order.status_name || order.status,
            total: order.total,
            formatted_total: order.currency_symbol + order.total,
            payment_url: order.payment_url || '',
            view_url: `${process.env.NEXT_PUBLIC_WORDPRESS_URL}/my-account/view-order/${order.id}/`
          };
        });
      
      
      // Filtriamo solo gli ordini con stato scheduled-payment e pending-deposit
      // Questi sono gli ordini che rappresentano le rate da pagare
      const scheduledOrdersByStatus = orders.filter((order: WooOrder) => 
        order.status === 'scheduled-payment' || order.status === 'pending-deposit'
      );
      


      // Cerchiamo anche ordini con specifici flag
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const scheduledOrdersByMeta = orders.filter((order: WooOrder) => {
        if (!order.meta_data) return false;

        // Cerca tutti i possibili meta che potrebbero indicare un ordine pianificato
        return order.meta_data.some((meta: OrderMetaData) => {
          const key = meta.key?.toLowerCase() || '';
          const stringValue = String(meta.value || '').toLowerCase();
          
          return key.includes('deposit') || 
                 key.includes('schedule') || 
                 key.includes('payment') || 
                 key.includes('installment') ||
                 stringValue.includes('deposit') || 
                 stringValue.includes('schedule') || 
                 stringValue.includes('installment');
        });
      });
      
      
      // Restituiamo solo le rate da pagare filtrate
      
      // Funzione per convertire gli stati tecnici in etichette user-friendly
      const getStatusDisplayName = (status: string, originalStatusName?: string) => {
        switch (status) {
          case 'pending-deposit':
            return 'In attesa di acconto';
          case 'scheduled-payment':
            return 'Rata programmata';
          case 'completed':
            return 'Completato';
          case 'processing':
            return 'In elaborazione';
          case 'on-hold':
            return 'In attesa';
          default:
            return originalStatusName || status;
        }
      };

      // Trasformiamo gli ordini nel formato atteso
      const finalScheduledOrders = scheduledOrdersByStatus.map((order: WooOrder): ScheduledOrder => {
        return {
          id: order.id,
          parent_id: order.parent_id || 0,
          parent_order_number: order.meta_data?.find((m: OrderMetaData) => m.key === '_deposit_parent_order_number')?.value?.toString() || '',
          date_created: order.date_created,
          status: order.status,
          status_name: getStatusDisplayName(order.status, order.status_name),
          total: order.total,
          formatted_total: order.currency_symbol + order.total,
          payment_url: order.payment_url || '',
          view_url: `${process.env.NEXT_PUBLIC_WORDPRESS_URL}/my-account/view-order/${order.id}/`
        };
      });
      
      // Ordina le rate da pagare per data (più recenti prima)
      // Priorità: pending-deposit prima di scheduled-payment
      finalScheduledOrders.sort((a, b) => {
        // Se uno è pending-deposit e l'altro scheduled-payment, pending-deposit va prima
        if (a.status === 'pending-deposit' && b.status === 'scheduled-payment') return -1;
        if (a.status === 'scheduled-payment' && b.status === 'pending-deposit') return 1;
        // Altrimenti, ordina per data (più recenti prima)
        return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
      });

      return NextResponse.json(finalScheduledOrders);
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const ordersError = error instanceof Error ? error : new Error('Errore sconosciuto');
      // Continua con l'approccio 3 se il secondo fallisce
    }

    // APPROCCIO 3: Fetch diretto con JWT token al dreamshop namespace
    
    // Formatta l'URL correttamente per l'API WordPress
    let baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || '';
    baseUrl = baseUrl.replace(/\/$/, ''); // Rimuovi eventuali slash finali
    
    // Costruisci l'URL per l'endpoint personalizzato
    const timestamp = new Date().getTime();
    const apiUrl = `${baseUrl}/wp-json/dreamshop/v1/scheduled-orders?user_id=${decoded.id}&_=${timestamp}`;
    
    try {
      // Inviamo il token JWT sia nel parametro token che nell'header Authorization
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Errore chiamata diretta API WordPress: ${response.status}`, errorText);
        return NextResponse.json(
          { error: `Errore API: ${response.status}` }, 
          { status: response.status }
        );
      }
      
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        return NextResponse.json(data.data);
      } else if (Array.isArray(data)) {
        return NextResponse.json(data);
      } else {
        return NextResponse.json([]);
      }
    } catch (error: unknown) {
      const apiError = error instanceof Error ? error : new Error('Errore sconosciuto');
      console.error('Errore chiamata API diretta:', apiError.message);
      return NextResponse.json(
        { error: `Errore del server: ${apiError.message}` }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Errore nella gestione della richiesta:', error);
    return NextResponse.json(
      { error: 'Errore del server' }, 
      { status: 500 }
    );
  }
  } catch (error) {
    console.error('Errore nella verifica del token:', error);
    return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
  }
}
