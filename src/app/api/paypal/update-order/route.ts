import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { orderId, paypalOrderId, paypalDetails } = data;
    
    if (!orderId || !paypalOrderId) {
      return NextResponse.json({ 
        error: 'Dati mancanti. Sono richiesti orderId e paypalOrderId' 
      }, { status: 400 });
    }
    
    console.log(`Aggiornamento ordine ${orderId} con pagamento PayPal completato, ID transazione: ${paypalOrderId}`);
    
    try {
      // Estrai i dettagli della transazione PayPal
      const transactionId = paypalDetails?.id || paypalOrderId;
      
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
            value: transactionId
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
      
      // Definiamo un'interfaccia per l'ordine WooCommerce
      interface WooOrder {
        id: number;
        status?: string;
      }
      
      const updatedOrder = response.data as WooOrder;
      
      if (!updatedOrder) {
        throw new Error('Risposta non valida dall\'aggiornamento dell\'ordine');
      }
      
      console.log(`Ordine ${orderId} aggiornato con successo a stato: ${updatedOrder.status || 'processing'}`);
      
      return NextResponse.json({
        success: true,
        order: {
          id: updatedOrder.id,
          status: updatedOrder.status || 'processing'
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
