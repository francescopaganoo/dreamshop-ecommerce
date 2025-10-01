import { NextRequest, NextResponse } from 'next/server';
import { updateOrder } from '../../../../lib/api';

// Extended order data type that includes the status field
type OrderUpdateData = {
  status?: string;
  set_paid?: boolean;
  transaction_id?: string;
};

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const { orderId, paymentIntentId } = data;
    
    if (!orderId || !paymentIntentId) {
      console.error('Dati mancanti:', { orderId, paymentIntentId });
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }
    
    // Aggiorna l'ordine in WooCommerce come pagato
    const orderData: OrderUpdateData = {
      status: 'processing',
      set_paid: true,
      transaction_id: paymentIntentId,
    };
    
    // Use type assertion to work around the missing status property in OrderData
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedOrder = await updateOrder(parseInt(orderId), orderData as any);
    
    
    return NextResponse.json({ 
      success: true,
      order: updatedOrder
    });
    
  } catch (error) {
    console.error('Errore durante l\'aggiornamento dell\'ordine:', error);
    return NextResponse.json({ 
      error: 'Si è verificato un errore durante l\'aggiornamento dell\'ordine' 
    }, { status: 500 });
  }
}
