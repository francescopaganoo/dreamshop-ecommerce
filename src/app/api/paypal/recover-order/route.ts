import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';
import { orderDataStore } from '../../../../lib/orderDataStore';

// Configurazione PayPal
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API_URL = process.env.NODE_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

/**
 * Endpoint per recuperare ordini PayPal non completati
 * Usato quando il browser si chiude dopo il pagamento ma prima della creazione dell'ordine
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { paypalOrderId, dataId } = data;

    if (!paypalOrderId || !dataId) {
      return NextResponse.json({
        error: 'Dati mancanti. Sono richiesti paypalOrderId e dataId'
      }, { status: 400 });
    }

    console.log('[PAYPAL-RECOVER] Tentativo di recovery per:', { paypalOrderId, dataId });

    // 1. Verifica se esiste già un ordine con questo paypalOrderId
    try {
      const recentOrders = await api.get('orders', {
        per_page: 50,
        orderby: 'date',
        order: 'desc'
      });

      if (recentOrders.data && Array.isArray(recentOrders.data)) {
        interface WooOrderMeta {
          id: number;
          key: string;
          value: string;
        }
        interface WooOrderCheck {
          id: number;
          status: string;
          meta_data: WooOrderMeta[];
        }

        const existingOrder = (recentOrders.data as WooOrderCheck[]).find((order: WooOrderCheck) =>
          order.meta_data?.some((meta: WooOrderMeta) =>
            meta.key === '_paypal_order_id' && meta.value === paypalOrderId
          )
        );

        if (existingOrder) {
          console.log('[PAYPAL-RECOVER] Ordine già esistente:', existingOrder.id);

          // Cancella i dati temporanei
          await orderDataStore.delete(dataId);

          return NextResponse.json({
            success: true,
            orderId: existingOrder.id,
            status: existingOrder.status,
            alreadyExists: true,
            recovered: false
          });
        }
      }
    } catch (checkError) {
      console.error('[PAYPAL-RECOVER] Errore nel controllo ordine esistente:', checkError);
    }

    // 2. Verifica il pagamento su PayPal
    let paidAmount = 0;
    try {
      // Ottieni token di accesso PayPal
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
        return NextResponse.json({
          error: 'Errore nell\'autenticazione con PayPal'
        }, { status: 500 });
      }

      // Recupera i dettagli dell'ordine PayPal
      const orderResponse = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${paypalOrderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      if (!orderResponse.ok) {
        return NextResponse.json({
          error: 'Ordine PayPal non trovato',
          canRecover: false
        }, { status: 404 });
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

      // Verifica che il pagamento sia completato
      if (paypalOrder.status !== 'COMPLETED') {
        return NextResponse.json({
          error: 'Pagamento PayPal non completato',
          paypalStatus: paypalOrder.status,
          canRecover: false
        }, { status: 400 });
      }

      paidAmount = parseFloat(paypalOrder.purchase_units[0].amount.value);
      console.log('[PAYPAL-RECOVER] Pagamento verificato, importo:', paidAmount);

    } catch (paypalError) {
      console.error('[PAYPAL-RECOVER] Errore verifica PayPal:', paypalError);
      return NextResponse.json({
        error: 'Errore durante la verifica del pagamento PayPal'
      }, { status: 500 });
    }

    // 3. Recupera i dati dell'ordine da MySQL
    const storedData = await orderDataStore.get(dataId);

    if (!storedData) {
      return NextResponse.json({
        error: 'Dati ordine non trovati o scaduti',
        canRecover: false
      }, { status: 404 });
    }

    const { orderData, pointsToRedeem } = storedData;
    const typedOrderData = orderData as Record<string, unknown>;
    const userId = (typedOrderData.customer_id as number) || 0;

    // 4. Crea l'ordine in WooCommerce
    const orderDataToSend = {
      ...typedOrderData,
      customer_id: userId,
      payment_method: 'paypal',
      payment_method_title: `PayPal (${paypalOrderId})`,
      set_paid: true,
      status: 'processing',
      meta_data: [
        ...((typedOrderData.meta_data as Array<{key: string; value: string}>) || []),
        {
          key: '_paypal_order_id',
          value: paypalOrderId
        },
        {
          key: '_paypal_transaction_id',
          value: paypalOrderId
        },
        {
          key: '_payment_method',
          value: 'paypal'
        },
        {
          key: '_dreamshop_points_assigned',
          value: 'yes'
        },
        {
          key: '_paypal_data_id',
          value: dataId
        },
        {
          key: '_order_recovered',
          value: 'yes'
        }
      ],
      // NOTA: Lo sconto punti è già incluso nelle fee_lines di orderData dal checkout
      fee_lines: (typedOrderData.fee_lines as Array<{name: string; total: string; tax_class?: string; tax_status?: string}>) || []
    };

    try {
      const response = await api.post('orders', orderDataToSend);
      const order = response.data;

      if (!order || typeof order !== 'object' || !('id' in order)) {
        throw new Error('Risposta non valida dalla creazione dell\'ordine');
      }

      interface WooOrder {
        id: number;
        status?: string;
      }

      const wooOrder = order as WooOrder;

      // Aggiungi nota sull'ordine recuperato
      try {
        await api.post(`orders/${wooOrder.id}/notes`, {
          note: `Ordine recuperato automaticamente. Pagamento PayPal: ${paypalOrderId}. Il browser si era chiuso prima del completamento.`,
          customer_note: false
        });
      } catch (noteError) {
        console.error('[PAYPAL-RECOVER] Errore aggiunta nota:', noteError);
      }

      // Cancella i dati temporanei
      await orderDataStore.delete(dataId);

      console.log('[PAYPAL-RECOVER] ✅ Ordine recuperato con successo:', wooOrder.id);

      return NextResponse.json({
        success: true,
        orderId: wooOrder.id,
        status: wooOrder.status || 'processing',
        pointsToRedeem: pointsToRedeem || 0,
        recovered: true
      });

    } catch (wooError) {
      console.error('[PAYPAL-RECOVER] Errore creazione ordine WooCommerce:', wooError);
      return NextResponse.json({
        error: 'Errore durante la creazione dell\'ordine',
        details: wooError
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[PAYPAL-RECOVER] Errore generale:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
