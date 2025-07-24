import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';
import jwt from 'jsonwebtoken';

// Chiave segreta per verificare i token JWT (in produzione, usare una variabile d'ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

// Definizione dell'interfaccia per gli ordini WooCommerce
interface WooOrder {
  id: number;
  customer_id: number;
  status: string;
  billing?: {
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  shipping?: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  total?: string;
  date_created?: string;
  number?: string;
  currency_symbol?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Ottieni il token dall'header Authorization
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('API: Token non fornito o formato non valido');
      return NextResponse.json({ error: 'Token non fornito' }, { status: 401 });
    }
    
    const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
    
    try {
      // Verifica il token
      const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      
      if (!decoded || !decoded.id) {
        console.error('API: Token decodificato non valido o mancante ID utente');
        return NextResponse.json({ error: 'Token non valido o ID utente mancante' }, { status: 401 });
      }
      
      console.log(`API: Recupero ordini per utente ID: ${decoded.id}`);
      
      try {
        // Otteniamo prima gli ordini standard e poi eventualmente quelli scheduled-payment
        const response = await api.get(`orders?customer=${decoded.id}&per_page=100&orderby=date&order=desc`);
        let orders = Array.isArray(response.data) ? response.data : [];
        
        // Controlliamo se abbiamo solo ordini scheduled-payment
        const initialOrderStatuses = orders.map((order: any) => order.status);
        const initialUniqueStatuses = [...new Set(initialOrderStatuses)];
        
        // Se abbiamo SOLO ordini scheduled-payment, proviamo a recuperare anche altri tipi
        // per assicurarci di mostrare tutti i tipi di ordini all'utente
        if (orders.length > 0 && initialUniqueStatuses.length === 1 && initialUniqueStatuses[0] === 'scheduled-payment') {
          // Proviamo un'altra chiamata per ottenere ordini non scheduled-payment
          try {
            const regularResponse = await api.get(`orders?customer=${decoded.id}&status=processing,on-hold,completed,pending,partial-payment&per_page=100&orderby=date&order=desc`);
            const regularOrders = Array.isArray(regularResponse.data) ? regularResponse.data : [];
            
            // Se troviamo ordini regolari, li aggiungiamo al risultato
            if (regularOrders.length > 0) {
              orders = [...regularOrders, ...orders];
            }
          } catch (regularError) {
            // Fallback silenzioso in caso di errore
          }
        }
        
        // Se non troviamo ordini con il parametro customer, proviamo con customer_id
        if (!orders || !Array.isArray(orders) || orders.length === 0) {
          console.log(`API: Nessun ordine trovato con parametro customer, provo con customer_id=${decoded.id}`);
          const response2 = await api.get(`orders?customer_id=${decoded.id}&per_page=100&orderby=date&order=desc`);
          orders = Array.isArray(response2.data) ? response2.data : [];
          
          // Se ancora non troviamo ordini e abbiamo un'email, proviamo a filtrare per email
          if ((!orders || !Array.isArray(orders) || orders.length === 0) && decoded.email) {
            console.log(`API: Nessun ordine trovato con customer_id, provo a cercare per email: ${decoded.email}`);
            
            // Recupera tutti gli ordini e filtra manualmente per email
            const allOrdersResponse = await api.get('orders?per_page=100');
            const allOrders = allOrdersResponse.data as WooOrder[];
            
            if (Array.isArray(allOrders) && allOrders.length > 0) {
              // Filtra gli ordini per email
              const ordersByEmail = allOrders.filter(order => 
                order.billing && 
                order.billing.email && 
                order.billing.email.toLowerCase() === decoded.email.toLowerCase()
              );
              
              if (ordersByEmail.length > 0) {
                console.log(`API: Trovati ${ordersByEmail.length} ordini con email ${decoded.email}`);
                orders = ordersByEmail;
              }
            }
          }
        }
        
        // Se non abbiamo trovato ordini, restituisci un array vuoto
        if (!orders || !Array.isArray(orders)) {
          console.log('API: Nessun ordine trovato o formato risposta non valido');
          return NextResponse.json([]);
        }
        
        // Filtro di sicurezza: assicuriamoci che vengano restituiti solo gli ordini dell'utente corrente
        // Questo è un controllo aggiuntivo per garantire che non vengano mostrati ordini di altri utenti
        const filteredOrders = orders.filter(order => {
          // Verifica per customer_id
          if (order.customer_id && order.customer_id === Number(decoded.id)) {
            return true;
          }
          
          // Verifica per email se customer_id non corrisponde
          if (decoded.email && order.billing && order.billing.email && 
              order.billing.email.toLowerCase() === decoded.email.toLowerCase()) {
            return true;
          }
          
          return false;
        });
        
        console.log(`API: Trovati ${filteredOrders.length} ordini per l'utente ${decoded.id}`);
        
        // Debug: elenco stati ordini per capire cosa arriva da WooCommerce
        const orderStatuses = filteredOrders.map(order => order.status);
        const uniqueStatuses = [...new Set(orderStatuses)];
        console.log('Stati degli ordini recuperati:', uniqueStatuses);
        
        // Debug: conteggio per ogni tipo di stato
        const statusCounts = orderStatuses.reduce((acc, status) => {
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log('Conteggio per stato:', statusCounts);
        
        // Restituisci TUTTI gli ordini filtrati senza escludere nessuno stato
        return NextResponse.json(filteredOrders);
      } catch (error: unknown) {
        const err = error as { response?: { status?: number } };
        console.error('API: Errore durante la chiamata a WooCommerce:', err);
        
        // Verifica se l'errore è dovuto a un problema di autenticazione con WooCommerce
        if (err.response && typeof err.response === 'object' && 'status' in err.response && err.response.status === 401) {
          return NextResponse.json({ error: 'Errore di autenticazione con WooCommerce' }, { status: 502 });
        }
        
        return NextResponse.json({ error: 'Errore nel recupero degli ordini' }, { status: 500 });
      }
      
    } catch (jwtError) {
      console.error('API: Errore durante la verifica del token JWT:', jwtError);
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
  } catch (error) {
    console.error('API: Errore generale durante il recupero degli ordini:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
