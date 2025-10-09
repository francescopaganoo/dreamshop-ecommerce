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
      depositAmount,
      depositType,
      paymentPlanId,
      billingData,
      paypalOrderDetails,
      shippingMethod,
      variationId,
      variationAttributes
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

    // Se il metodo di spedizione è presente e ha un costo, usa quello
    // Altrimenti la spedizione è €0 (es. prodotti con spedizione gratuita inclusa)
    const shippingCost = shippingMethod?.cost ?? 0;

    // Calcola il prezzo del prodotto sottraendo spedizione e fee dal totale pagato
    // In questo modo: prezzo_prodotto + spedizione + fee = totale_pagato
    const productSubtotal = subtotalWithShipping - shippingCost;


    // Log per debug
    console.log('[PayPal Express] Creating order with:', {
      productId,
      variationId,
      quantity,
      enableDeposit,
      depositAmount,
      depositType,
      paymentPlanId,
      productSubtotal: productSubtotal.toFixed(2)
    });

    // Prepara i line items con il prezzo custom
    const lineItems = [
      {
        product_id: productId,
        quantity: quantity,
        subtotal: productSubtotal.toFixed(2),
        total: productSubtotal.toFixed(2),
        // IMPORTANTE: Aggiungi variation_id se presente
        ...(variationId && variationId > 0 && { variation_id: variationId }),
        meta_data: [
          // Aggiungi attributi della variazione se presenti
          ...(variationAttributes && Array.isArray(variationAttributes)
            ? variationAttributes.map((attr: { name: string; option: string }) => ({
                key: attr.name,
                value: attr.option
              }))
            : []
          ),
          // Aggiungi metadati dell'acconto se abilitato
          ...(enableDeposit === 'yes' ? [
            { key: '_wc_convert_to_deposit', value: 'yes' },
            { key: '_wc_deposit_type', value: depositType || 'percent' },
            { key: '_wc_deposit_amount', value: depositAmount || '40' },
            ...(paymentPlanId ? [
              { key: '_wc_payment_plan', value: paymentPlanId },
              { key: '_deposit_payment_plan', value: paymentPlanId }
            ] : [])
          ] : [])
        ]
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
        },
        {
          key: '_paypal_amount_paid',
          value: totalAmountPaid.toFixed(2)
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