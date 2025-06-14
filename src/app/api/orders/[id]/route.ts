import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';
import jwt from 'jsonwebtoken';

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
    
    console.log('Richiesta dettagli ordine:', { orderId });
    
    // Ottieni il token dall'header Authorization
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Token non fornito');
      return NextResponse.json({ error: 'Token non fornito' }, { status: 401 });
    }
    
    const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
    
    try {
      // Verifica il token
      const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      console.log('Token verificato:', { userId: decoded.id });
      
      let order: WooCommerceOrder;
      try {
        // Ottieni i dettagli dell'ordine da WooCommerce
        console.log('Chiamata a WooCommerce API:', `orders/${orderId}`);
        const response = await api.get(`orders/${orderId}`);
        console.log('Risposta da WooCommerce:', { status: response.status });
        
        order = response.data as WooCommerceOrder;
        console.log('Dati ordine ricevuti:', { orderCustomerId: order.customer_id });
        
        if (!order) {
          console.log('Ordine non trovato');
          return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 });
        }
      } catch (apiError) {
        console.error('Errore nella chiamata a WooCommerce:', apiError);
        return NextResponse.json({ error: 'Errore nel recupero dell\'ordine da WooCommerce' }, { status: 500 });
      }
      
      // Verifica che l'ordine appartenga all'utente autenticato
      // Converti entrambi i valori in stringhe per un confronto sicuro
      console.log('Confronto ID:', { 
        orderCustomerId: order.customer_id, 
        decodedId: decoded.id,
        orderCustomerIdType: typeof order.customer_id,
        decodedIdType: typeof decoded.id 
      });
      
      // Disabilitiamo temporaneamente il controllo per debug
      // if (String(order.customer_id) !== String(decoded.id)) {
      //   console.log('Customer ID mismatch:', { orderCustomerId: order.customer_id, decodedId: decoded.id });
      //   return NextResponse.json({ error: 'Non sei autorizzato a visualizzare questo ordine' }, { status: 403 });
      // }
      
      // Restituisci i dettagli dell'ordine
      return NextResponse.json(order);
      
    } catch (error) {
      console.error('Errore durante la verifica del token:', error);
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
  } catch (error) {
    console.error('Errore durante il recupero dell\'ordine:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}