import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { productId, quantity, userId, enableDeposit = 'no' } = data;
    
    console.log('PayPal Express: Dati ricevuti:', { productId, quantity, userId, enableDeposit });
    
    if (!productId || !quantity) {
      console.error('PayPal Express: Dati prodotto mancanti');
      return NextResponse.json({ error: 'Dati prodotto mancanti' }, { status: 400 });
    }
    
    // Recupera i dettagli del prodotto
    console.log(`PayPal Express: Recupero prodotto ${productId}...`);
    try {
      const productResponse = await api.get(`products/${productId}`);
      const product = productResponse.data;
      
      if (!product) {
        console.error('PayPal Express: Prodotto non trovato');
        return NextResponse.json({ error: 'Prodotto non trovato' }, { status: 404 });
      }
      
      console.log('PayPal Express: Prodotto recuperato:', product.name);
      
      // Calcola il prezzo
      const unitPrice = parseFloat(product.sale_price || product.price || '0');
      const totalAmount = (unitPrice * quantity).toFixed(2);
      
      console.log(`PayPal Express: Prezzo unitario ${unitPrice}, totale ${totalAmount}`);
      
      // Prepara i line items
      const lineItems = [
        {
          product_id: productId,
          quantity: quantity,
          ...(enableDeposit === 'yes' && {
            meta_data: [
              { key: '_wc_deposit_option', value: 'yes' },
              { key: '_wc_deposit_amount', value: '40' },
              { key: '_wc_deposit_type', value: 'percent' }
            ]
          })
        }
      ];
      
      // Crea i dati dell'ordine per WooCommerce
      const orderData = {
        payment_method: 'paypal',
        payment_method_title: 'PayPal Express Checkout',
        set_paid: false,
        status: 'pending',
        customer_id: userId || 0,
        billing: {
          first_name: 'PayPal',
          last_name: 'User',
          email: 'paypal@example.com',
          phone: '',
          address_1: 'Via PayPal 1',
          address_2: '',
          city: 'Roma',
          state: 'RM',
          postcode: '00100',
          country: 'IT'
        },
        shipping: {
          first_name: 'PayPal',
          last_name: 'User',
          address_1: 'Via PayPal 1',
          address_2: '',
          city: 'Roma',
          state: 'RM',
          postcode: '00100',
          country: 'IT'
        },
        line_items: lineItems,
        shipping_lines: [
          {
            method_id: 'flat_rate',
            method_title: 'Spedizione standard',
            total: '0.00'
          }
        ]
      };
      
      console.log('PayPal Express: Creazione ordine WooCommerce...');
      
      // Crea l'ordine in WooCommerce
      const orderResponse = await api.post('orders', orderData);
      const order = orderResponse.data;
      
      if (!order || typeof order !== 'object' || !('id' in order)) {
        throw new Error('Risposta non valida dalla creazione dell\'ordine');
      }
      
      console.log(`PayPal Express: Ordine creato con successo ID ${order.id}`);
      
      return NextResponse.json({
        orderId: order.id,
        total: totalAmount,
        success: true
      });
      
    } catch (productError) {
      console.error('PayPal Express: Errore recupero prodotto:', productError);
      return NextResponse.json({ 
        error: 'Errore durante il recupero del prodotto',
        details: productError 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('PayPal Express: Errore generale:', error);
    return NextResponse.json({ 
      error: 'Errore interno del server',
      details: error 
    }, { status: 500 });
  }
}