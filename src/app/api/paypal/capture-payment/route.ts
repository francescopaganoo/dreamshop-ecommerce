import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';
import fetch from 'node-fetch';

// Configurazione PayPal
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { orderId, paypalOrderId } = data;
    
    if (!orderId || !paypalOrderId) {
      return NextResponse.json({ 
        error: 'Dati mancanti. Sono richiesti orderId e paypalOrderId' 
      }, { status: 400 });
    }
    
    
    // Definiamo un'interfaccia per i dettagli dell'ordine WooCommerce
    interface WooOrderDetails {
      id: number;
      customer_id?: number;
      status?: string;
      meta_data?: Array<{key: string; value: string}>;
    }
    
    // Per debug: recuperiamo i dettagli dell'ordine prima di aggiornarlo
    try {
      const orderDetailsResponse = await api.get(`orders/${orderId}`);
      const orderDetails = orderDetailsResponse.data as WooOrderDetails;
      console.log(`PayPal Capture: Dettagli ordine ${orderId} prima dell'aggiornamento:`, 
                  JSON.stringify({
                    id: orderDetails.id,
                    customer_id: orderDetails.customer_id,
                    status: orderDetails.status,
                    meta_data: orderDetails.meta_data
                  }, null, 2));
    } catch (orderError) {
      console.error(`Impossibile recuperare i dettagli dell'ordine ${orderId}:`, orderError);
      // Continuiamo comunque con il flusso principale
    }
    
    try {
      // Ottieni un token di accesso PayPal
      const tokenResponse = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
      });
      
      const tokenData = await tokenResponse.json() as { access_token?: string };
      
      if (!tokenData.access_token) {
        console.error('Errore nell\'ottenere il token PayPal:', tokenData);
        return NextResponse.json({ error: 'Errore nell\'autenticazione con PayPal' }, { status: 500 });
      }
      
      // Cattura il pagamento PayPal
      const captureResponse = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${paypalOrderId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });
      
      const captureData = await captureResponse.json() as { id?: string, status?: string };
      
      if (!captureData.id || captureData.status !== 'COMPLETED') {
        console.error('Errore nella cattura del pagamento PayPal:', captureData);
        return NextResponse.json({ error: 'Errore nella cattura del pagamento PayPal' }, { status: 500 });
      }
      
      
      // Prepariamo i dati per l'aggiornamento dell'ordine
      const orderUpdateData = {
        status: 'processing', // Cambia lo stato dell'ordine a "processing"
        set_paid: true, // Imposta l'ordine come pagato
        meta_data: [
          {
            key: '_paypal_order_id',
            value: paypalOrderId
          },
          {
            key: '_paypal_transaction_id',
            value: captureData.id
          },
          {
            key: '_payment_method',
            value: 'paypal'
          },
          {
            key: '_payment_method_title',
            value: 'PayPal'
          },
          {
            // Questo flag previene l'assegnazione duplicata dei punti
            key: '_dreamshop_points_assigned',
            value: 'yes'
          }
        ]
      };
      
      console.log(`PayPal Capture: Aggiorno l'ordine ${orderId} con i seguenti dati:`, 
                  JSON.stringify(orderUpdateData, null, 2));
                  
      // Aggiorna l'ordine in WooCommerce come pagato
      const response = await api.put(`orders/${orderId}`, orderUpdateData);
      
      const updatedOrder = response.data as WooOrderDetails;
      
      if (!updatedOrder) {
        throw new Error('Risposta non valida dall\'aggiornamento dell\'ordine');
      }
      
      // Log dettagliato dell'ordine aggiornato
      console.log(`PayPal Capture: Dettagli ordine ${orderId} DOPO l'aggiornamento:`, 
                  JSON.stringify({
                    id: updatedOrder.id,
                    customer_id: updatedOrder.customer_id,
                    status: updatedOrder.status,
                    meta_data: updatedOrder.meta_data?.filter(m => 
                      ['_dreamshop_points_assigned', '_paypal_order_id'].includes(m.key))
                  }, null, 2));
      
      // Definiamo un'interfaccia per l'ordine WooCommerce
      interface WooOrder {
        id: number;
        status?: string;
      }
      
      const wooOrder = updatedOrder as WooOrder;
      
      
      return NextResponse.json({
        success: true,
        order: {
          id: wooOrder.id,
          status: wooOrder.status || 'processing'
        }
      });
      
    } catch (wooError) {
      console.error('Errore durante l\'aggiornamento dell\'ordine in WooCommerce:', wooError);
      return NextResponse.json({ 
        error: 'Errore durante l\'aggiornamento dell\'ordine', 
        details: wooError 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Errore nella richiesta:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
