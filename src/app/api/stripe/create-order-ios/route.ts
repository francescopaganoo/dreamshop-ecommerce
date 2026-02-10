import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { validateDepositEligibility, hasDepositInLineItems } from '../../../../lib/deposits';
import { orderDataStore } from '../../../../lib/orderDataStore';

// Interfacce per i tipi degli elementi
interface MetaData {
  key: string;
  value: string;
}

interface LineItemInput {
  product_id?: number;
  id?: number;
  quantity: number;
  variation_id?: number;
  meta_data?: MetaData[];
}

// Inizializza Stripe con la chiave segreta
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY non è configurata nelle variabili d\'ambiente');
}

const stripe = new Stripe(stripeSecretKey || '');

export async function POST(request: NextRequest) {
  try {
    if (!stripeSecretKey) {
      console.error('Impossibile procedere: STRIPE_SECRET_KEY mancante');
      return NextResponse.json({ error: 'Configurazione Stripe mancante' }, { status: 500 });
    }

    const origin = request.nextUrl.origin;
    const data = await request.json();

    // Log specifico per i line_items e i loro metadati
    if (data.line_items) {
      data.line_items.forEach((item: LineItemInput, index: number) => {
        console.log(`[iOS] Item ${index}:`, {
          product_id: item.product_id || item.id,
          quantity: item.quantity,
          variation_id: item.variation_id,
          hasDepositMeta: item.meta_data && item.meta_data.some((meta: MetaData) => meta.key === '_wc_convert_to_deposit')
        });
      });
    }

    const {
      paymentMethodId,
      amount,
      customerInfo,
      line_items,
      shipping,
      notes,
      directCustomerId = 0,
      isAuthenticated = false,
      pointsToRedeem = 0,
      couponCode = ''
    } = data;

    let userId = 0;
    if (directCustomerId && directCustomerId > 0) {
      userId = directCustomerId;
      console.log('[iOS] Usando directCustomerId:', userId, '- isAuthenticated:', isAuthenticated);
    } else {
      console.log('[iOS] Nessun ID utente valido fornito, ordine sarà come guest');
    }

    if (!paymentMethodId || !amount || !customerInfo || !line_items) {
      console.error('[iOS] Dati mancanti per l\'ordine');
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    // ========================================================================
    // VALIDAZIONE DEPOSITI - Gli ordini a rate richiedono autenticazione
    // ========================================================================
    const hasAnyDeposit = hasDepositInLineItems(line_items);
    const depositValidation = validateDepositEligibility({
      userId,
      hasDeposit: hasAnyDeposit,
      context: 'create-order-ios'
    });

    if (!depositValidation.isValid) {
      console.error(`[iOS] Ordine a rate bloccato: userId=${userId}, hasDeposit=${hasAnyDeposit}`);
      return NextResponse.json({
        error: depositValidation.error,
        errorCode: depositValidation.errorCode
      }, { status: 403 });
    }
    // ========================================================================

    // Helper per verificare se un item è un regalo automatico
    const isAutoGiftItem = (item: LineItemInput): boolean => {
      if (!item.meta_data) return false;
      return item.meta_data.some(meta => meta.key === '_is_auto_gift' && meta.value === 'yes');
    };

    // Prepara i line_items con i metadati necessari
    const processedLineItems = line_items.map((item: LineItemInput) => {
      const filteredMetaData = item.meta_data
        ? item.meta_data
            .filter((meta: MetaData) => {
              return meta.key.startsWith('_wc_') ||
                     meta.key.includes('deposit') ||
                     meta.key.includes('payment_plan') ||
                     meta.key === '_is_auto_gift' ||
                     meta.key === '_gift_rule_id' ||
                     meta.key === '_gift_rule_name';
            })
            .map((meta: MetaData) => ({
              key: meta.key,
              value: meta.value
            }))
        : [];

      const processedItem: {
        product_id: number | undefined;
        quantity: number;
        variation_id?: number;
        subtotal?: string;
        total?: string;
        meta_data: MetaData[];
      } = {
        product_id: item.product_id || item.id,
        quantity: item.quantity,
        variation_id: item.variation_id || undefined,
        meta_data: filteredMetaData
      };

      if (isAutoGiftItem(item)) {
        processedItem.subtotal = '0';
        processedItem.total = '0';
      }

      return processedItem;
    });

    // Log per verificare che i metadati degli acconti siano stati preservati
    processedLineItems.forEach((item: { product_id?: number; quantity: number; variation_id?: number; meta_data?: MetaData[] }, index: number) => {
      const hasDepositMeta = item.meta_data && item.meta_data.some((meta: MetaData) => meta.key === '_wc_convert_to_deposit');
      if (hasDepositMeta) {
        console.log(`[iOS] ACCONTO RILEVATO nell'item ${index} (product_id: ${item.product_id}):`, {
          meta_data: item.meta_data?.filter((meta: MetaData) => meta.key.includes('deposit') || meta.key.includes('_wc_')) || []
        });
      }
    });

    // Prepara i dati dell'ordine (NON lo creiamo ancora - lo fara il webhook)
    const orderData = {
      payment_method: 'stripe',
      payment_method_title: 'Carta di credito',
      customer_id: userId || 0,
      customer_note: notes || '',
      billing: customerInfo,
      shipping: customerInfo,
      line_items: processedLineItems,
      shipping_lines: [
        {
          method_id: 'flat_rate',
          method_title: 'Spedizione standard',
          total: String(shipping)
        }
      ],
      coupon_lines: couponCode ? [{ code: couponCode }] : [],
      meta_data: [
        { key: 'is_ios_checkout', value: 'true' },
        { key: '_dreamshop_points_assigned', value: 'yes' }
      ]
    };

    console.log('[iOS] Dettagli ordine preparati:', {
      customer_id: userId,
      email: customerInfo.email,
      items_count: processedLineItems.length,
      has_deposit: hasAnyDeposit
    });

    // STEP 1: Salva i dati dell'ordine nello store temporaneo
    // L'ordine WooCommerce verra creato SOLO dal webhook dopo payment_intent.succeeded
    const dataId = orderDataStore.generateId();
    const saved = await orderDataStore.set(dataId, {
      orderData,
      pointsToRedeem: pointsToRedeem > 0 ? pointsToRedeem : 0,
      pointsDiscount: 0
    });

    if (!saved) {
      console.error('[iOS] Errore nel salvataggio dei dati dell\'ordine nello store');
      return NextResponse.json({ error: 'Errore nel salvataggio dei dati dell\'ordine' }, { status: 500 });
    }

    console.log(`[iOS] Step 1: Dati ordine salvati nello store con ID: ${dataId}`);

    // STEP 2: Crea e conferma il PaymentIntent in un unico step
    // Il webhook creera l'ordine WooCommerce dopo il successo del pagamento
    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'eur',
        payment_method: paymentMethodId,
        payment_method_types: ['card'],
        confirm: true,
        return_url: `${origin}/checkout/success`,
        metadata: {
          order_data_id: dataId,
          payment_source: 'ios_app',
          customer_email: customerInfo.email,
          customer_id: userId.toString(),
          is_ios_checkout: 'true',
          enable_deposit: hasAnyDeposit ? 'yes' : 'no'
        }
      });

      console.log(`[iOS] Step 2: PaymentIntent ${paymentIntent.id} creato con status: ${paymentIntent.status}`);

      // Associa il payment_intent_id ai dati nello store per il polling
      await orderDataStore.setPaymentIntentId(dataId, paymentIntent.id);

    } catch (paymentError) {
      console.error('[iOS] Step 2 FALLITO: Errore pagamento:', paymentError);

      // Pagamento fallito: elimina i dati dallo store (nessun ordine da cancellare!)
      try {
        await orderDataStore.delete(dataId);
        console.log(`[iOS] Dati ordine ${dataId} eliminati per fallimento pagamento`);
      } catch (deleteError) {
        console.error(`[iOS] Errore eliminazione dati ${dataId}:`, deleteError);
      }

      throw paymentError;
    }

    // STEP 3: Gestisci la risposta del PaymentIntent
    // L'ordine WooCommerce verra creato SOLO dal webhook (payment_intent.succeeded)
    if (paymentIntent.status === 'succeeded') {
      console.log(`[iOS] Step 3: Pagamento riuscito, il webhook creera l'ordine WooCommerce`);

      return NextResponse.json({
        success: true,
        paymentIntentId: paymentIntent.id,
        paymentStatus: paymentIntent.status,
        requires_action: false
      });
    }

    if (paymentIntent.status === 'requires_action') {
      console.log(`[iOS] Step 3: Pagamento richiede 3DS, nessun ordine creato ancora`);

      // Restituisci il client_secret per completare il 3DS lato frontend
      // NESSUN ordine WooCommerce creato = nessuno stock scalato, nessuna email inviata
      return NextResponse.json({
        success: true,
        requires_action: true,
        payment_intent_client_secret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        paymentStatus: paymentIntent.status
      });
    }

    // Status inatteso (processing, requires_payment_method, etc.)
    console.error(`[iOS] Step 3: Status inatteso: ${paymentIntent.status}`);

    // Elimina i dati dallo store
    try {
      await orderDataStore.delete(dataId);
    } catch (deleteError) {
      console.error(`[iOS] Errore eliminazione dati ${dataId}:`, deleteError);
    }

    return NextResponse.json({
      error: `Pagamento non riuscito: ${paymentIntent.status}`
    }, { status: 400 });

  } catch (error: unknown) {
    console.error('[iOS] Errore durante la creazione dell\'ordine:', error);

    if (error instanceof Stripe.errors.StripeCardError) {
      return NextResponse.json({
        error: error.message || 'La carta è stata rifiutata.'
      }, { status: 400 });
    } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return NextResponse.json({
        error: 'Configurazione di pagamento non valida. Contatta l\'assistenza.'
      }, { status: 400 });
    } else {
      return NextResponse.json({
        error: 'Si è verificato un errore durante la creazione dell\'ordine'
      }, { status: 500 });
    }
  }
}
