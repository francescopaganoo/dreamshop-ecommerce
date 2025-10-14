import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';

// Configurazione PayPal
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API_URL = process.env.NODE_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { orderData, paypalOrderId, paypalTransactionId, expectedTotal } = data;

    if (!orderData || !paypalOrderId) {
      return NextResponse.json({
        error: 'Dati mancanti. Sono richiesti orderData e paypalOrderId'
      }, { status: 400 });
    }

    if (typeof expectedTotal !== 'number' || expectedTotal <= 0) {
      return NextResponse.json({
        error: 'expectedTotal mancante o non valido'
      }, { status: 400 });
    }

    // SICUREZZA: Verifica il pagamento su PayPal prima di creare l'ordine
    try {
      console.log('[PAYPAL-VERIFY] Verifica ordine PayPal:', paypalOrderId);

      // 1. Ottieni token di accesso PayPal
      const tokenResponse = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
      });

      const tokenData = await tokenResponse.json() as { access_token?: string };

      if (!tokenData.access_token) {
        console.error('[PAYPAL-VERIFY] Errore nell\'ottenere il token PayPal:', tokenData);
        return NextResponse.json({
          error: 'Errore nell\'autenticazione con PayPal'
        }, { status: 500 });
      }

      // 2. Recupera i dettagli dell'ordine PayPal
      const orderResponse = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${paypalOrderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      if (!orderResponse.ok) {
        console.error('[PAYPAL-VERIFY] Errore nel recupero ordine PayPal:', orderResponse.status);
        return NextResponse.json({
          error: 'Ordine PayPal non trovato o non valido'
        }, { status: 400 });
      }

      const paypalOrder = await orderResponse.json() as {
        id: string;
        status: string;
        purchase_units: Array<{
          amount: {
            currency_code: string;
            value: string;
          };
        }>;
      };

      // 3. Verifica che l'ordine sia stato completato (captured)
      if (paypalOrder.status !== 'COMPLETED') {
        console.error('[PAYPAL-VERIFY] Ordine PayPal non completato. Status:', paypalOrder.status);
        return NextResponse.json({
          error: 'Pagamento PayPal non completato',
          details: `Lo stato dell'ordine è "${paypalOrder.status}" invece di "COMPLETED"`
        }, { status: 400 });
      }

      // 4. Verifica che l'importo pagato su PayPal corrisponda al totale dell'ordine
      const paidAmount = parseFloat(paypalOrder.purchase_units[0].amount.value);

      // 5. Confronta importo pagato con totale atteso
      // Tolleranza di 0.01€ per arrotondamenti
      const tolerance = 0.01;
      if (Math.abs(paidAmount - expectedTotal) > tolerance) {
        console.error('[PAYPAL-VERIFY] Importo non corrispondente:', {
          expected: expectedTotal,
          paid: paidAmount,
          difference: Math.abs(paidAmount - expectedTotal)
        });
        return NextResponse.json({
          error: 'Importo pagato non corrisponde all\'ordine',
          details: `Importo atteso: €${expectedTotal.toFixed(2)}, Pagato: €${paidAmount.toFixed(2)}`
        }, { status: 400 });
      }

      console.log('[PAYPAL-VERIFY] ✅ Verifica completata con successo:', {
        paypalOrderId,
        status: paypalOrder.status,
        amount: paidAmount
      });

    } catch (verificationError) {
      console.error('[PAYPAL-VERIFY] Errore durante la verifica:', verificationError);
      return NextResponse.json({
        error: 'Errore durante la verifica del pagamento PayPal',
        details: verificationError instanceof Error ? verificationError.message : 'Errore sconosciuto'
      }, { status: 500 });
    }

    const userId = orderData.customer_id || 0;

    // Prepara i dati dell'ordine WooCommerce con status "processing" e set_paid true
    const transactionId = paypalTransactionId || paypalOrderId;
    const orderDataToSend = {
      ...orderData,
      customer_id: userId,
      payment_method: 'paypal',
      payment_method_title: `PayPal (${transactionId})`,
      set_paid: true, // L'ordine è già pagato
      status: 'processing', // Lo stato è processing perché il pagamento è completato
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
          value: `PayPal (${transactionId})`
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
          note: `Ordine pagato tramite PayPal. ID transazione PayPal: ${transactionId}`,
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
