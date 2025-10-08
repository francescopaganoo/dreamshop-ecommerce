import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { orderData, paymentIntentId } = data;

    if (!orderData || !paymentIntentId) {
      return NextResponse.json({
        error: 'Dati mancanti. Sono richiesti orderData e paymentIntentId'
      }, { status: 400 });
    }

    const userId = orderData.customer_id || 0;

    // Prepara i dati dell'ordine WooCommerce con status "processing" e set_paid true
    const orderDataToSend = {
      ...orderData,
      customer_id: userId,
      payment_method: 'stripe',
      payment_method_title: 'Carta di Credito (Stripe)',
      set_paid: true, // L'ordine è già pagato
      status: 'processing', // Lo stato è processing perché il pagamento è completato
      transaction_id: paymentIntentId,
      meta_data: [
        ...(orderData.meta_data || []),
        {
          key: '_stripe_payment_intent_id',
          value: paymentIntentId
        }
      ]
    };

    console.log('Creazione ordine WooCommerce dopo pagamento Stripe:', {
      customer_id: userId,
      payment_intent_id: paymentIntentId,
      status: 'processing',
      set_paid: true
    });

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

      console.log(`Ordine WooCommerce ${wooOrder.id} creato con successo dopo pagamento Stripe ${paymentIntentId}`);

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
