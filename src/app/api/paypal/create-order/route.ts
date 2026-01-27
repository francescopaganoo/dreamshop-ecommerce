import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';
import { validateDepositEligibility, hasDepositInLineItems } from '../../../../lib/deposits';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { orderData } = data;
    
    if (!orderData) {
      return NextResponse.json({ error: 'Dati dell\'ordine mancanti' }, { status: 400 });
    }
    

    const userId = orderData.customer_id || 0;

    // ========================================================================
    // VALIDAZIONE DEPOSITI - Gli ordini a rate richiedono autenticazione
    // ========================================================================
    const hasAnyDeposit = hasDepositInLineItems(orderData.line_items || []);
    const depositValidation = validateDepositEligibility({
      userId,
      hasDeposit: hasAnyDeposit,
      context: 'paypal-create-order'
    });

    if (!depositValidation.isValid) {
      console.error(`[paypal-create-order] Ordine a rate bloccato: userId=${userId}, hasDeposit=${hasAnyDeposit}`);
      return NextResponse.json({
        error: depositValidation.error,
        errorCode: depositValidation.errorCode
      }, { status: 403 });
    }
    // ========================================================================

    // Assicurati che customer_id non sia perso o sovrascritto
    const orderDataToSend = {
      ...orderData,
      // Preserviamo esplicitamente il customer_id
      customer_id: userId,
      // Impostiamo il metodo di pagamento a PayPal
      payment_method: 'paypal',
      payment_method_title: 'PayPal',
      set_paid: false, // Verrà impostato a true dopo la conferma del pagamento
      status: 'pending' // Lo stato iniziale è pending
    };
    
    
    // Crea l'ordine in WooCommerce
    try {
      const response = await api.post('orders', orderDataToSend);
      
      const order = response.data;
      
      if (!order || typeof order !== 'object' || !('id' in order)) {
        throw new Error('Risposta non valida dalla creazione dell\'ordine');
      }
      
      
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
      return NextResponse.json({ 
        error: 'Errore durante la creazione dell\'ordine', 
        details: wooError 
      }, { status: 500 });
    }

  } catch {
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
