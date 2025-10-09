import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { orderData, paypalOrderId, paypalTransactionId } = data;

    if (!orderData || !paypalOrderId) {
      return NextResponse.json({
        error: 'Dati mancanti. Sono richiesti orderData e paypalOrderId'
      }, { status: 400 });
    }

    const userId = orderData.customer_id || 0;

    // Prepara i dati dell'ordine WooCommerce con status "processing" e set_paid true
    const orderDataToSend = {
      ...orderData,
      customer_id: userId,
      payment_method: 'paypal',
      payment_method_title: 'PayPal',
      set_paid: true, // L'ordine è già pagato
      status: 'processing', // Lo stato è processing perché il pagamento è completato
      meta_data: [
        {
          key: '_paypal_order_id',
          value: paypalOrderId
        },
        {
          key: '_paypal_transaction_id',
          value: paypalTransactionId || paypalOrderId
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
          key: '_dreamshop_points_assigned',
          value: 'yes'
        }
      ]
    };



    // Crea l'ordine in WooCommerce
    try {
      const response = await api.post('orders', orderDataToSend);

      const order = response.data;

      if (!order || typeof order !== 'object' || !('id' in order)) {
        throw new Error('Risposta non valida dalla creazione dell\'ordine');
      }

      interface WooOrder {
        id: number;
        total?: string;
        status?: string;
      }

      const wooOrder = order as WooOrder;


      // Aggiungi una nota all'ordine WooCommerce con il riferimento PayPal
      try {
        await api.post(`orders/${wooOrder.id}/notes`, {
          note: `Ordine pagato tramite PayPal. ID transazione PayPal: ${paypalOrderId}`,
          customer_note: false
        });
      } catch (noteError) {
        console.error('Errore nell\'aggiunta della nota all\'ordine:', noteError);
        // Non blocchiamo il flusso se la nota fallisce
      }

      return NextResponse.json({
        success: true,
        orderId: wooOrder.id,
        status: wooOrder.status || 'processing'
      });

    } catch (wooError) {
      console.error('Errore durante la creazione dell\'ordine in WooCommerce:', wooError);
      return NextResponse.json({
        error: 'Errore durante la creazione dell\'ordine',
        details: wooError
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Errore nella richiesta:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
