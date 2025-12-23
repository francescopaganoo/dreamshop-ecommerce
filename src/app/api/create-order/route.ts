import { NextRequest, NextResponse } from 'next/server';
import { createOrder } from '@/lib/api';

// Helper function per verificare se un prodotto è un regalo automatico
function isAutoGiftProduct(product: { meta_data?: Array<{key: string, value: string}> }): boolean {
  if (!product.meta_data) return false;
  return product.meta_data.some(meta => meta.key === '_is_auto_gift' && meta.value === 'yes');
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { orderData } = data;
    
    if (!orderData) {
      return NextResponse.json({ error: 'Dati dell\'ordine mancanti' }, { status: 400 });
    }
    
    // Recupera l'ID utente dall'oggetto orderData, se presente
    const userId = orderData.customer_id || 0;

    
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
        _wc_convert_to_deposit?: string;
        _wc_deposit_type?: string;
        _wc_deposit_amount?: string;
        meta_data?: Array<{key: string, value: string}>;
      };
      quantity: number;
    }
    
    const cartItems = JSON.parse(orderData.cartItems || '[]') as CartItem[];
    
    const line_items = cartItems.map((item: CartItem) => {
      // Definizione dell'interfaccia per lineItem
      interface LineItem {
        product_id: number;
        quantity: number;
        meta_data?: Array<{key: string; value: string}>;
        subtotal?: string;
        total?: string;
      }

      // Oggetto base dell'articolo
      const lineItem: LineItem = {
        product_id: item.product.id,
        quantity: item.quantity
      };

      // Controlla se il prodotto ha i metadati di acconto
      if (item.product._wc_convert_to_deposit === 'yes') {
        // Aggiungi i metadati dell'acconto all'articolo
        lineItem.meta_data = [
          {
            key: '_wc_convert_to_deposit',
            value: 'yes'
          },
          {
            key: '_wc_deposit_type',
            value: item.product._wc_deposit_type || 'percent'
          },
          {
            key: '_wc_deposit_amount',
            value: item.product._wc_deposit_amount || '40'
          }
        ];
      }

      // Gestisci i regali automatici: imposta il prezzo a 0
      if (isAutoGiftProduct(item.product)) {
        // Imposta subtotal e total a 0 per forzare il prezzo gratuito
        lineItem.subtotal = '0';
        lineItem.total = '0';

        // Assicurati che meta_data sia un array
        if (!lineItem.meta_data) lineItem.meta_data = [];

        // Aggiungi i metadati del regalo automatico
        lineItem.meta_data.push({ key: '_is_auto_gift', value: 'yes' });

        // Aggiungi i metadati dal prodotto se presenti
        if (item.product.meta_data) {
          const giftRuleId = item.product.meta_data.find(m => m.key === '_gift_rule_id');
          const giftRuleName = item.product.meta_data.find(m => m.key === '_gift_rule_name');
          if (giftRuleId) {
            lineItem.meta_data.push({ key: '_gift_rule_id', value: String(giftRuleId.value) });
          }
          if (giftRuleName) {
            lineItem.meta_data.push({ key: '_gift_rule_name', value: String(giftRuleName.value) });
          }
        }
      }

      return lineItem;
    });
    
    
    // Prepara il titolo del metodo di pagamento corretto
    const paymentMethodTitle = orderData.paymentMethod === 'cod' ? 'Contrassegno' : 
                               orderData.paymentMethod === 'bacs' ? 'Bonifico Bancario' : 'PayPal';
    
    const wooOrderData = {
      // Preserviamo esplicitamente il customer_id
      customer_id: userId,
      payment_method: orderData.paymentMethod,
      payment_method_title: paymentMethodTitle,
      // Per contrassegno e bonifico, l'ordine è in stato 'on-hold' o 'pending'
      // ma imponiamo comunque il flag per prevenire doppia assegnazione punti
      set_paid: orderData.paymentMethod === 'cod' ? false : 
                orderData.paymentMethod === 'bacs' ? false : true,
      status: orderData.paymentMethod === 'cod' ? 'on-hold' : 
              orderData.paymentMethod === 'bacs' ? 'on-hold' : 'processing',
      transaction_id: orderData.transactionId || '',
      customer_note: orderData.notes,
      billing: customerInfo,
      shipping: customerInfo,
      line_items: line_items.length > 0 ? line_items : [],
      // Aggiungiamo metadati per calcolo punti e prevenire duplicazione
      meta_data: [
        {
          // Questo flag previene l'assegnazione duplicata dei punti
          key: '_dreamshop_points_assigned',
          value: 'yes'
        },
      ]
    };
    
    
    // L'ordine viene restituito direttamente dalla funzione createOrder
    
    // Crea l'ordine in WooCommerce
    const order = await createOrder(wooOrderData);
    
    // Verifica che l'ordine sia stato creato correttamente
    if (order && typeof order === 'object' && 'id' in order) {
      // Log dettagliato dell'ordine creato
      console.log(`Standard checkout: Ordine ${order.id} creato con successo. Dettagli:`, 
                  JSON.stringify({
                    id: order.id,
                    customer_id: order.customer_id || 'non impostato',
                    status: order.status,
                    payment_method: order.payment_method,
                    meta_data: Array.isArray(order.meta_data) ? 
                      order.meta_data.filter(m => m.key === '_dreamshop_points_assigned') : []
                  }, null, 2));
      
      // Reindirizza alla pagina di conferma dell'ordine
      return NextResponse.json({ 
        success: true, 
        orderId: order.id,
        redirectUrl: `/checkout/success?order_id=${order.id}`
      });
    } else {
      console.error('Errore nella creazione dell\'ordine: risposta non valida da WooCommerce', order);
      throw new Error('Errore nella creazione dell\'ordine');
    }
    
  } catch (error) {
    console.error('Errore nella creazione dell\'ordine:', error);
    return NextResponse.json({ 
      error: 'Si è verificato un errore durante la creazione dell\'ordine' 
    }, { status: 500 });
  }
}
