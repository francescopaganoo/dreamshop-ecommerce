import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const {
      paypalOrderId,
      productId,
      quantity,
      userId,
      enableDeposit = 'no',
      billingData,
      paypalOrderDetails,
      shippingMethod
    } = data;
    


    // Calcola la commissione PayPal del 3.5% + €0.35 e estrae la spedizione
    const getPurchaseUnitAmount = () => {
      if (paypalOrderDetails?.purchase_units?.[0]?.amount?.value) {
        return parseFloat(paypalOrderDetails.purchase_units[0].amount.value);
      }
      return 0;
    };

    const totalAmountPaid = getPurchaseUnitAmount();

    // Il totale pagato include: subtotale prodotto + spedizione + commissione PayPal
    // Formula: totale = (subtotale + spedizione) * 1.035 + 0.35
    // Quindi: subtotale + spedizione = (totale - 0.35) / 1.035
    const subtotalWithShipping = (totalAmountPaid - 0.35) / 1.035;
    const paypalFee = totalAmountPaid - subtotalWithShipping;

    // Usa il metodo di spedizione passato dal frontend (calcolato in base alla classe di spedizione)
    const shippingCost = shippingMethod?.cost || 7.00;



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
    
    // Crea l'ordine WooCommerce con i dati reali di PayPal
    const orderData = {
      payment_method: 'paypal',
      payment_method_title: 'PayPal Express Checkout',
      set_paid: true, // L'ordine è già pagato tramite PayPal
      status: 'processing', // Stato processing perché già pagato
      customer_id: userId || 0,
      billing: {
        first_name: billingData.first_name || 'PayPal',
        last_name: billingData.last_name || 'User',
        email: billingData.email || '',
        phone: '',
        address_1: billingData.address_1 || '',
        address_2: billingData.address_2 || '',
        city: billingData.city || '',
        state: billingData.state || '',
        postcode: billingData.postcode || '',
        country: billingData.country || 'IT'
      },
      shipping: {
        first_name: billingData.first_name || 'PayPal',
        last_name: billingData.last_name || 'User',
        address_1: billingData.address_1 || '',
        address_2: billingData.address_2 || '',
        city: billingData.city || '',
        state: billingData.state || '',
        postcode: billingData.postcode || '',
        country: billingData.country || 'IT'
      },
      line_items: lineItems,
      shipping_lines: [
        {
          method_id: shippingMethod?.id || 'flat_rate',
          method_title: shippingMethod?.title || 'Spedizione standard',
          total: shippingCost.toFixed(2)
        }
      ],
      fee_lines: [
        {
          name: 'Commissione PayPal (3.5% + €0.35)',
          total: paypalFee.toFixed(2),
          tax_status: 'none'
        }
      ],
      meta_data: [
        {
          key: '_paypal_transaction_id',
          value: paypalOrderId
        },
        {
          key: '_paypal_express_checkout',
          value: 'yes'
        }
      ]
    };
    
    
    // Crea l'ordine in WooCommerce
    const orderResponse = await api.post('orders', orderData);
    const order = orderResponse.data;
    
    if (!order || typeof order !== 'object' || !('id' in order)) {
      throw new Error('Risposta non valida dalla creazione dell\'ordine');
    }
    
    
    return NextResponse.json({
      order_id: order.id,
      success: true
    });
    
  } catch (error) {
    console.error('PayPal Express Complete: Errore:', error);
    return NextResponse.json({ 
      error: 'Errore durante il completamento dell\'ordine',
      details: error 
    }, { status: 500 });
  }
}