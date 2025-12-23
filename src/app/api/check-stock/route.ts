import { NextResponse } from 'next/server';
import api from '../../../lib/woocommerce';

// Interfacce per i dati
interface CartItem {
  product_id: number;
  variation_id?: number;
  name: string;
  quantity: number;
  price: string;
  meta_data?: Array<{
    key: string;
    value: string;
  }>;
}

interface ProductData {
  stock_status: string;
  manage_stock?: boolean;
  stock_quantity?: number;
  price?: string;
  name?: string;
  sold_individually?: boolean;
}

export async function POST(request: Request) {
  try {
    const { cartItems } = await request.json() as { cartItems: CartItem[] };
    
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Nessun prodotto da verificare' },
        { status: 400 }
      );
    }
    
    // Array per tenere traccia degli errori di disponibilità
    const stockIssues = [];
    
    // Verifica ogni prodotto nel carrello
    for (const item of cartItems) {
      try {
        // Verifica se è una variazione o un prodotto semplice
        const endpoint = item.variation_id 
          ? `products/${item.product_id}/variations/${item.variation_id}`
          : `products/${item.product_id}`;
        
        const { data } = await api.get(endpoint) as { data: ProductData };
        
        // Verifica se il prodotto è ancora disponibile
        if (data.stock_status !== 'instock') {
          stockIssues.push({
            id: item.product_id,
            variation_id: item.variation_id,
            name: item.name,
            issue: 'not_in_stock',
            message: `"${item.name}" non è più disponibile.`
          });
          continue;
        }

        // Verifica se il prodotto ha il limite "sold_individually" (1 pezzo per ordine)
        if (data.sold_individually && item.quantity > 1) {
          stockIssues.push({
            id: item.product_id,
            variation_id: item.variation_id,
            name: item.name,
            issue: 'sold_individually',
            available: 1,
            requested: item.quantity,
            message: `"${item.name}" può essere acquistato solo 1 pezzo per ordine.`
          });
        }

        // Verifica se la quantità richiesta è disponibile (solo se il prodotto gestisce lo stock)
        if (data.manage_stock && typeof data.stock_quantity === 'number') {
          if (data.stock_quantity < item.quantity) {
            stockIssues.push({
              id: item.product_id,
              variation_id: item.variation_id,
              name: item.name,
              issue: 'insufficient_quantity',
              available: data.stock_quantity,
              requested: item.quantity,
              message: `Solo ${data.stock_quantity} ${data.stock_quantity === 1 ? 'pezzo' : 'pezzi'} di "${item.name}" ${data.stock_quantity === 1 ? 'è' : 'sono'} disponibili.`
            });
          }
        }
        
        // Verifica se è una gift card con importo personalizzato
        const isCustomAmountGiftCard = item.meta_data?.some(meta =>
          meta.key === '_gift_card_custom_amount'
        );

        // Verifica se è un regalo automatico (auto gift)
        const isAutoGift = item.meta_data?.some(meta =>
          meta.key === '_is_auto_gift' && meta.value === 'yes'
        );

        // Verifica se il prezzo è cambiato (salta per gift card con importo personalizzato e regali automatici)
        if (!isCustomAmountGiftCard && !isAutoGift && data.price && parseFloat(data.price) > 0) {
          const currentPrice = parseFloat(data.price);
          const cartPrice = parseFloat(item.price);

          // Se il prezzo è cambiato di più del 1%, segnalalo come aggiornato automaticamente
          if (Math.abs(currentPrice - cartPrice) / cartPrice > 0.01) {
            stockIssues.push({
              id: item.product_id,
              variation_id: item.variation_id,
              name: item.name,
              issue: 'price_changed',
              old_price: cartPrice,
              new_price: currentPrice,
              fixed: true,
              message: `Il prezzo di "${item.name}" è stato aggiornato da €${cartPrice.toFixed(2)} a €${currentPrice.toFixed(2)}.`
            });
          }
        }
      } catch (error) {
        console.error(`Errore durante la verifica del prodotto ${item.product_id}:`, error);
        stockIssues.push({
          id: item.product_id,
          variation_id: item.variation_id,
          name: item.name,
          issue: 'api_error',
          message: `Non è stato possibile verificare la disponibilità di "${item.name}".`
        });
      }
    }
    
    // Restituisci il risultato
    return NextResponse.json({
      success: stockIssues.length === 0,
      stockIssues: stockIssues,
      message: stockIssues.length > 0 
        ? 'Alcuni prodotti nel carrello non sono più disponibili o hanno subito modifiche.' 
        : 'Tutti i prodotti sono disponibili.'
    });
  } catch (error) {
    console.error('Errore durante la verifica della disponibilità:', error);
    return NextResponse.json(
      { success: false, message: 'Errore durante la verifica della disponibilità' },
      { status: 500 }
    );
  }
}
