import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';

// Definiamo interfacce per i tipi
interface PointHistoryItem {
  id: number;
  date: string;
  points: number;
  type: string;
  description: string;
  order_id: number;
}

interface WooOrder {
  id: number;
  status: string;
  total: string;
  date_created: string;
  // Utilizziamo unknown per i campi dinamici che non sono esplicitamente tipizzati
  [key: string]: unknown | string | number; 
}

/**
 * API per recuperare i punti dell'utente
 * GET /api/points/user
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Ottieni il token di autenticazione dagli header
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('API: Authorization header mancante o non valido');
    return NextResponse.json({ error: 'Authorization header mancante o non valido' }, { status: 401 });
  }
  
  // Estrai il token JWT
  const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
  
  try {
    // Decodifica il token JWT
    const jwtSecret = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';
    const decoded = jwt.verify(token, jwtSecret) as { id: number };
    
    const userId = decoded.id;
    console.log(`API: Richiedo punti per utente ${userId}`);
    
    try {
      // Primo tentativo: usa l'endpoint nuovo che funziona correttamente
      console.log(`API: Tentativo con endpoint nuovo /dreamshop-points/v1/users/${userId}/points`);
      
      const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL!;
      const baseUrl = wordpressUrl.endsWith('/') ? wordpressUrl : `${wordpressUrl}/`;
      
      // Chiamata diretta all'endpoint che sappiamo funzionare
      const response = await fetch(`${baseUrl}wp-json/dreamshop-points/v1/users/${userId}/points`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Passiamo il token come cookie per completezza, anche se l'endpoint accetta l'ID utente direttamente
          'Cookie': `jwt=${token}`
        },
      });
      
      if (response.ok) {
        const pointsData = await response.json();
        console.log('API: Punti recuperati con successo dall\'endpoint nuovo', pointsData);
        
        return NextResponse.json({
          points: pointsData.points,
          pointsLabel: pointsData.pointsLabel,
          history: pointsData.history || []
        });
      } else {
        throw new Error(`Endpoint nuovo non disponibile: ${response.status}`);
      }
    } catch (apiError) {
      console.error('API: Errore con endpoint nuovo, tentativo con fallback:', apiError);
      
      // Fallback: usa la soluzione con WooCommerce API se l'endpoint personalizzato fallisce
      
      // Creiamo un nuovo client API WooCommerce 
      const api = new WooCommerceRestApi({
        url: process.env.NEXT_PUBLIC_WORDPRESS_URL!,
        consumerKey: process.env.NEXT_PUBLIC_WC_CONSUMER_KEY!,
        consumerSecret: process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET!,
        version: 'wc/v3',
        queryStringAuth: true 
      });
      
      console.log('API: Fallback - Recupero dati cliente e ordini da WooCommerce');
      
      // Recuperiamo solo le informazioni necessarie
      console.log('API: Preparazione recupero dati cliente');
      
      // Ottieni ordini cliente per simulare punti
      const ordersResponse = await api.get('orders', {
        customer: userId,
        per_page: 20
      });
      console.log('API: Ordini cliente recuperati');
      
      // Simula dati dei punti basati sugli ordini
      let totalPoints = 0;
      const history: PointHistoryItem[] = [];
      
      if (ordersResponse.data && Array.isArray(ordersResponse.data)) {
        ordersResponse.data.forEach((order: WooOrder) => {
          if (order.status === 'completed') {
            // Simula 1 punto ogni 10€ (come sembra fare il plugin)
            const orderTotal = parseFloat(order.total);
            const orderPoints = Math.floor(orderTotal / 10);
            totalPoints += orderPoints;
            
            // Cronologia
            history.push({
              id: order.id,
              date: order.date_created,
              points: orderPoints,
              type: 'earn',
              description: `Punti guadagnati per l'ordine #${order.id}`,
              order_id: order.id
            });
          }
        });
      }
      
      console.log(`API: Punti simulati calcolati: ${totalPoints}`);
      
      // Risposta formattata
      return NextResponse.json({
        points: totalPoints,
        pointsLabel: `${totalPoints} punti`,
        history: history,
        source: 'fallback' // Indica che i dati provengono dal fallback
      });
    }
  } catch (error) {
    console.error('API: Errore di autenticazione:', error);
    return NextResponse.json({ error: 'Errore di autenticazione' }, { status: 401 });
  }
}
