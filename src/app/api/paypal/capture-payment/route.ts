import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';
import fetch from 'node-fetch';

// Configurazione PayPal
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'AQp06Lsyjs71OUx7Ji3F2TrMPqqGR9jVMRo61sd3Z5s8OZhyG6HDIBdf9tsj_o5fJeQDXCGU52FDeM33';
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
    
    console.log(`Cattura del pagamento PayPal per l'ordine ${orderId}, PayPal Order ID: ${paypalOrderId}`);
    
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
      
      console.log(`Pagamento PayPal catturato con successo: ${captureData.id}, Status: ${captureData.status}`);
      
      // Aggiorna l'ordine in WooCommerce come pagato
      const response = await api.put(`orders/${orderId}`, {
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
          }
        ]
      });
      
      const updatedOrder = response.data;
      
      if (!updatedOrder) {
        throw new Error('Risposta non valida dall\'aggiornamento dell\'ordine');
      }
      
      // Definiamo un'interfaccia per l'ordine WooCommerce
      interface WooOrder {
        id: number;
        status?: string;
      }
      
      const wooOrder = updatedOrder as WooOrder;
      
      console.log(`Ordine ${orderId} aggiornato con successo a stato: ${wooOrder.status || 'sconosciuto'}`);
      
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
