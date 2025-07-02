import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import api from '@/lib/woocommerce';

// Chiave segreta per verificare i token JWT (stessa usata negli altri endpoint)
const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

// Credenziali WordPress per autenticazione non-JWT
const WP_USERNAME = process.env.WP_USERNAME || 'admin';
const WP_PASSWORD = process.env.WP_PASSWORD || '';
const WP_NONCE = process.env.WP_NONCE || '';

export async function GET(request: NextRequest) {
  console.log('API scheduled-orders - Richiesta ricevuta');
  console.log('Headers ricevuti:', JSON.stringify(Object.fromEntries(request.headers.entries())));
  
  // Ottieni il token dall'header Authorization
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('API: Token non fornito o formato non valido');
    return NextResponse.json({ error: 'Token non fornito o formato non valido' }, { status: 401 });
  }
  
  const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
  console.log('Token estratto:', token.substring(0, 15) + '...');
  
  try {
    // Verifica il token
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    console.log('Token decodificato:', JSON.stringify(decoded));
    
    if (!decoded || !decoded.id) {
      console.error('API: Token decodificato non valido o mancante ID utente');
      return NextResponse.json({ error: 'Token non valido o ID utente mancante' }, { status: 401 });
    }
    
    console.log(`API: Recupero ordini pianificati per utente ID: ${decoded.id}`);
  
  try {
    // Recuperiamo gli ordini standard tramite WooCommerce API e filtriamo
    // quelli relativi a depositi/acconti nel nostro codice
    console.log('Recupero ordini standard e applicazione filtri');
    try {
      console.log(`Recupero ordini standard per utente ID: ${decoded.id}`);
      const ordersResponse = await api.get(`orders?customer=${decoded.id}&per_page=100&orderby=date&order=desc`);
      
      // Verifichiamo che data sia un array e gestiamo il tipo unknown
      const orders = Array.isArray(ordersResponse.data) ? ordersResponse.data : [];
      console.log(`Recuperati ${orders.length} ordini standard`);
      
      // Log completo dei meta_data per diagnostica
      console.log('Meta data dei primi ordini per analisi:');
      orders.slice(0, 3).forEach((order: any, index: number) => {
        if (order.meta_data) {
          console.log(`Ordine ${index+1} (${order.id}):`, order.meta_data.map((m: any) => ({ key: m.key, value: m.value })));
        }
      });

      // Filtriamo TUTTI gli ordini e poi facciamo debug per capire quali sono pianificati
      // Non escludiamo nulla inizialmente per debugging
      const allPotentialScheduledOrders = orders
        .filter((order: any) => {
          // Non filtriamo nulla per ora, prendiamo tutti gli ordini per debug
          return true;
        })
        .map((order: any) => {
          // Trasformiamo nel formato atteso
          return {
            id: order.id,
            parent_id: order.parent_id || 0,
            parent_order_number: order.meta_data?.find((m: any) => m.key === '_deposit_parent_order_number')?.value || '',
            date_created: order.date_created,
            status: order.status,
            status_name: order.status_name || order.status,
            total: order.total,
            formatted_total: order.currency_symbol + order.total,
            payment_url: order.payment_url || '',
            view_url: `${process.env.NEXT_PUBLIC_WORDPRESS_URL}/my-account/view-order/${order.id}/`
          };
        });
      
      console.log(`Tutti gli ordini potenziali: ${allPotentialScheduledOrders.length}`);
      
      // Filtriamo gli ordini con stato scheduled-payment e wc-pending-deposit (acconti in attesa)
      const scheduledOrdersByStatus = orders.filter((order: any) => {
        // Include scheduled-payment (rate future) e wc-pending-deposit (acconti da pagare)
        return order.status === 'scheduled-payment' || order.status === 'wc-pending-deposit' || order.status === 'pending-deposit';
      });
      
      console.log(`Ordini scheduled-payment: ${orders.filter(o => o.status === 'scheduled-payment').length}`);
      console.log(`Ordini wc-pending-deposit: ${orders.filter(o => o.status === 'wc-pending-deposit' || o.status === 'pending-deposit').length}`);
      
      console.log(`Ordini con stati rilevanti: ${scheduledOrdersByStatus.length}`);
      
      // Cerchiamo anche ordini con specifici flag
      const scheduledOrdersByMeta = orders.filter((order: any) => {
        if (!order.meta_data) return false;
        
        // Cerca tutti i possibili meta che potrebbero indicare un ordine pianificato
        return order.meta_data.some((meta: any) => {
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
      
      console.log(`Ordini con meta rilevanti: ${scheduledOrdersByMeta.length}`);
      
      // NON uniamo più tutti i risultati - usiamo SOLO gli ordini con scheduled-payment
      // Questo è il filtro più preciso e ci assicura di mostrare solo le rate future
      console.log(`Totale ordini pianificati con stato scheduled-payment: ${scheduledOrdersByStatus.length}`);
      
      // Trasformiamo gli ordini nel formato atteso
      const finalScheduledOrders = scheduledOrdersByStatus.map((order: any) => {
        return {
          id: order.id,
          parent_id: order.parent_id || 0,
          parent_order_number: order.meta_data?.find((m: any) => m.key === '_deposit_parent_order_number')?.value || '',
          date_created: order.date_created,
          status: order.status,
          status_name: order.status_name || order.status,
          total: order.total,
          formatted_total: order.currency_symbol + order.total,
          payment_url: order.payment_url || '',
          view_url: `${process.env.NEXT_PUBLIC_WORDPRESS_URL}/my-account/view-order/${order.id}/`
        };
      });
      
      console.log(`Ordini pianificati filtrati e formattati: ${finalScheduledOrders.length}`);
      return NextResponse.json(finalScheduledOrders);
    } catch (ordersError: any) {
      console.log('Errore recupero ordini standard:', ordersError.message);
      // Continua con l'approccio 3 se il secondo fallisce
    }

    // APPROCCIO 3: Fetch diretto con JWT token al dreamshop namespace
    console.log('APPROCCIO 3: Fetch diretto con JWT al dreamshop namespace');
    
    // Formatta l'URL correttamente per l'API WordPress
    let baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || '';
    baseUrl = baseUrl.replace(/\/$/, ''); // Rimuovi eventuali slash finali
    
    // Costruisci l'URL per l'endpoint personalizzato
    const timestamp = new Date().getTime();
    const apiUrl = `${baseUrl}/wp-json/dreamshop/v1/scheduled-orders?user_id=${decoded.id}&_=${timestamp}`;
    console.log('Chiamata API diretta con JWT:', apiUrl);
    
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
      console.log('Risposta API WordPress ricevuta:', data ? 'dati presenti' : 'dati mancanti');
      
      if (data.success && Array.isArray(data.data)) {
        return NextResponse.json(data.data);
      } else if (Array.isArray(data)) {
        return NextResponse.json(data);
      } else {
        return NextResponse.json([]);
      }
    } catch (apiError: any) {
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
