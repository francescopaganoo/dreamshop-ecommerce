import { NextRequest, NextResponse } from 'next/server';
import api from '@/lib/woocommerce';
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
    // Ottieni il parametro page dalla URL
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    
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
      
      
      try {
        // Otteniamo prima tutti gli ordini con paginazione (senza filtri di stato)
        const response = await api.get(`orders?customer=${decoded.id}&per_page=100&page=${page}&orderby=date&order=desc`);
        let orders = Array.isArray(response.data) ? response.data : [];
        
        
        // Debug: elenco stati ordini dalla prima chiamata
        const initialOrderStatuses = orders.map((order: WooOrder) => order.status);
        const initialUniqueStatuses = [...new Set(initialOrderStatuses)];
        
        // SEMPRE prova chiamate aggiuntive per assicurarsi di recuperare tutti i tipi di ordini
        // Questo perché WooCommerce potrebbe limitare certi tipi di ordini nella prima chiamata
          
          // Proviamo chiamate separate per ogni stato principale
          try {
            const statusesToFetch = ['completed', 'processing', 'on-hold', 'pending', 'partial-payment', 'cancelled'];
            
            for (const status of statusesToFetch) {
              const statusResponse = await api.get(`orders?customer=${decoded.id}&status=${status}&per_page=50&orderby=date&order=desc`);
              const statusOrders = Array.isArray(statusResponse.data) ? statusResponse.data : [];
              
              if (statusOrders.length > 0) {
                // Evita duplicati
                const newOrders = statusOrders.filter(newOrder => 
                  !orders.some(existingOrder => existingOrder.id === newOrder.id)
                );
                orders = [...orders, ...newOrders];
              }
            }
          } catch (error) {
          }
        
        // Se non troviamo ordini con il parametro customer, proviamo con customer_id
        if (!orders || !Array.isArray(orders) || orders.length === 0) {
          const response2 = await api.get(`orders?customer_id=${decoded.id}&per_page=100&orderby=date&order=desc`);
          orders = Array.isArray(response2.data) ? response2.data : [];
          
          // Se ancora non troviamo ordini e abbiamo un'email, proviamo a filtrare per email
          if ((!orders || !Array.isArray(orders) || orders.length === 0) && decoded.email) {
            
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
                orders = ordersByEmail;
              }
            }
          }
        }
        
        // Se non abbiamo trovato ordini, restituisci un array vuoto
        if (!orders || !Array.isArray(orders)) {
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
        
        
        // Debug: elenco stati ordini per capire cosa arriva da WooCommerce
        const orderStatuses = filteredOrders.map(order => order.status);
        const uniqueStatuses = [...new Set(orderStatuses)];
        
        // Debug: conteggio per ogni tipo di stato
        const statusCounts = orderStatuses.reduce((acc, status) => {
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        // Restituisci TUTTI gli ordini filtrati senza escludere nessuno stato
        return NextResponse.json(filteredOrders);
      } catch (error: unknown) {
        const err = error as { response?: { status?: number } };
        
        // Verifica se l'errore è dovuto a un problema di autenticazione con WooCommerce
        if (err.response && typeof err.response === 'object' && 'status' in err.response && err.response.status === 401) {
          return NextResponse.json({ error: 'Errore di autenticazione con WooCommerce' }, { status: 502 });
        }
        
        return NextResponse.json({ error: 'Errore nel recupero degli ordini' }, { status: 500 });
      }
      
    } catch (jwtError) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
  } catch (error) {
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
