import { NextRequest, NextResponse } from 'next/server';
import { createOrder } from '../../../lib/api';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { orderData } = data;
    
    if (!orderData) {
      return NextResponse.json({ error: 'Dati dell\'ordine mancanti' }, { status: 400 });
    }
    
    // Formatta i dati dell'ordine per l'API WooCommerce
    const customerInfo = {
      first_name: orderData.firstName,
      last_name: orderData.lastName,
      address_1: orderData.address1,
      address_2: orderData.address2,
      city: orderData.city,
      state: orderData.state,
      postcode: orderData.postcode,
      country: orderData.country,
      email: orderData.email,
      phone: orderData.phone
    };
    
    // Recupera i dati del carrello dalla sessione o dal localStorage
    // Nota: questa è una soluzione temporanea, in produzione dovresti passare i dati del carrello
    // direttamente dal client o utilizzare un database/sessione
    // Define interface for cart item structure
    interface CartItem {
      product: {
        id: number;
      };
      quantity: number;
    }
    
    const cartItems = JSON.parse(orderData.cartItems || '[]') as CartItem[];
    
    const line_items = cartItems.map((item: CartItem) => ({
      product_id: item.product.id,
      quantity: item.quantity
    }));
    
    const wooOrderData = {
      payment_method: orderData.paymentMethod,
      payment_method_title: 'PayPal',
      set_paid: true,
      transaction_id: orderData.transactionId || '',
      customer_note: orderData.notes,
      billing: customerInfo,
      shipping: customerInfo,
      line_items: line_items.length > 0 ? line_items : []
    };
    
    // Define interface for order response
    interface OrderResponse {
      id: number;
      number: string;
      status: string;
    }
    
    // Crea l'ordine in WooCommerce
    const order = await createOrder(wooOrderData) as OrderResponse;
    
    if (order && order.id) {
      // Reindirizza alla pagina di conferma dell'ordine
      return NextResponse.json({ 
        success: true, 
        orderId: order.id,
        redirectUrl: `/checkout/success?order_id=${order.id}`
      });
    } else {
      throw new Error('Errore nella creazione dell\'ordine');
    }
    
  } catch (error) {
    console.error('Errore nella creazione dell\'ordine:', error);
    return NextResponse.json({ 
      error: 'Si è verificato un errore durante la creazione dell\'ordine' 
    }, { status: 500 });
  }
}
