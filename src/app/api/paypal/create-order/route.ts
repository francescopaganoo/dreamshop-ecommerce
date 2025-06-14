import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { orderData } = data;
    
    if (!orderData) {
      return NextResponse.json({ error: 'Dati dell\'ordine mancanti' }, { status: 400 });
    }
    
    console.log('Creazione ordine WooCommerce con PayPal:', orderData);
    
    // Crea l'ordine in WooCommerce
    try {
      const response = await api.post('orders', {
        ...orderData,
        // Impostiamo il metodo di pagamento a PayPal
        payment_method: 'paypal',
        payment_method_title: 'PayPal',
        set_paid: false, // Verrà impostato a true dopo la conferma del pagamento
        status: 'pending' // Lo stato iniziale è pending
      });
      
      const order = response.data;
      
      if (!order || typeof order !== 'object' || !('id' in order)) {
        throw new Error('Risposta non valida dalla creazione dell\'ordine');
      }
      
      console.log(`Ordine WooCommerce creato con successo: ID ${order.id}`);
      
      // Definiamo un'interfaccia per l'ordine WooCommerce
      interface WooOrder {
        id: number;
        total?: string;
        status?: string;
      }
      
      const wooOrder = order as WooOrder;
      const total = wooOrder.total || '0';
      
      // Invece di creare un ordine PayPal dal server, restituisci l'ID dell'ordine WooCommerce
      // e lascia che il client crei l'ordine PayPal utilizzando l'SDK PayPal
      return NextResponse.json({
        orderId: wooOrder.id,
        total: total,
        success: true
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
