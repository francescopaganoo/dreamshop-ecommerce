/**
 * DreamShop Auto Gifts - Frontend Integration
 *
 * Questo modulo gestisce la comunicazione con il plugin WordPress
 * per i prodotti regalo automatici nel carrello.
 */

import { Product } from './api';

// URL base del WordPress
const WORDPRESS_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';

/**
 * Interfaccia per un prodotto regalo
 */
export interface GiftProduct {
  id: number;
  product_id: number;
  name: string;
  slug: string;
  quantity: number;
  original_price: number;
  price: number; // Sempre 0 per i regali
  price_display: string;
  formatted_price: {
    type: string;
    original: string | null;
    current: string;
    html: string;
  };
  image: {
    src: string;
    alt: string;
  };
  is_gift: boolean;
  gift_rule_id: number;
  gift_rule_name: string;
  sku: string;
  stock_status: string;
  permalink: string;
}

/**
 * Interfaccia per la risposta dell'API check-gifts
 */
export interface CheckGiftsResponse {
  success: boolean;
  gifts: GiftProduct[];
  rules_evaluated: number;
  cart_total: number;
  message?: string;
}

/**
 * Interfaccia per un item del carrello (semplificata per l'API)
 */
export interface CartItemForGifts {
  product_id: number;
  id?: number;
  quantity: number;
  name?: string;
  categories?: Array<{ id: number; slug?: string }>;
}

/**
 * Verifica quali prodotti regalo devono essere aggiunti al carrello
 *
 * @param cartItems - Array degli item nel carrello
 * @param cartTotal - Totale del carrello
 * @param userId - ID utente (opzionale)
 * @returns Promise con i prodotti regalo da aggiungere
 */
export async function checkAutoGifts(
  cartItems: CartItemForGifts[],
  cartTotal: number,
  userId?: number
): Promise<CheckGiftsResponse> {
  try {
    const response = await fetch(`${WORDPRESS_URL}/wp-json/dreamshop-auto-gifts/v1/check-gifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cart_items: cartItems,
        cart_total: cartTotal,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Errore nel controllo dei regali automatici:', error);
    return {
      success: false,
      gifts: [],
      rules_evaluated: 0,
      cart_total: cartTotal,
      message: 'Errore nel controllo dei regali automatici',
    };
  }
}

/**
 * Converte un GiftProduct in un Product compatibile con il CartContext
 */
export function giftProductToProduct(gift: GiftProduct): Product {
  return {
    id: gift.product_id,
    name: gift.name,
    slug: gift.slug,
    permalink: gift.permalink,
    price: '0', // I regali sono sempre gratuiti
    regular_price: gift.original_price.toString(),
    sale_price: '0',
    stock_status: gift.stock_status,
    stock_quantity: undefined,
    manage_stock: false,
    short_description: '',
    description: '',
    images: [{ id: gift.product_id, ...gift.image }],
    categories: [],
    type: 'simple',
    meta_data: [
      {
        key: '_is_auto_gift',
        value: 'yes',
      },
      {
        key: '_gift_rule_id',
        value: gift.gift_rule_id.toString(),
      },
      {
        key: '_gift_rule_name',
        value: gift.gift_rule_name,
      },
      {
        key: '_gift_price_display',
        value: gift.price_display,
      },
      {
        key: '_gift_original_price',
        value: gift.original_price.toString(),
      },
      {
        key: '_gift_formatted_price_html',
        value: gift.formatted_price.html,
      },
    ],
  };
}

/**
 * Verifica se un CartItem è un regalo automatico
 */
export function isAutoGift(item: { product: Product }): boolean {
  if (!item.product.meta_data) return false;

  const isGiftMeta = item.product.meta_data.find(
    (meta) => meta.key === '_is_auto_gift' && meta.value === 'yes'
  );

  return !!isGiftMeta;
}

/**
 * Ottiene le informazioni sul prezzo formattato di un regalo
 */
export function getGiftPriceDisplay(item: { product: Product }): {
  type: string;
  html: string;
  originalPrice: number;
} | null {
  if (!isAutoGift(item)) return null;

  const displayType = item.product.meta_data?.find((m) => m.key === '_gift_price_display')?.value || 'free_only';
  const html = item.product.meta_data?.find((m) => m.key === '_gift_formatted_price_html')?.value || 'Gratis';
  const originalPrice = parseFloat(
    item.product.meta_data?.find((m) => m.key === '_gift_original_price')?.value || '0'
  );

  return {
    type: displayType,
    html,
    originalPrice,
  };
}

/**
 * Ottiene il nome della regola che ha generato il regalo
 */
export function getGiftRuleName(item: { product: Product }): string | null {
  if (!isAutoGift(item)) return null;

  return item.product.meta_data?.find((m) => m.key === '_gift_rule_name')?.value || null;
}

/**
 * Storage key per i regali nel localStorage
 */
const AUTO_GIFTS_STORAGE_KEY = 'dreamshop_auto_gifts';

/**
 * Salva i regali correnti nel localStorage
 */
export function saveAutoGiftsToStorage(gifts: GiftProduct[]): void {
  try {
    localStorage.setItem(AUTO_GIFTS_STORAGE_KEY, JSON.stringify(gifts));
  } catch (error) {
    console.error('Errore nel salvare i regali:', error);
  }
}

/**
 * Carica i regali dal localStorage
 */
export function loadAutoGiftsFromStorage(): GiftProduct[] {
  try {
    const stored = localStorage.getItem(AUTO_GIFTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Errore nel caricare i regali:', error);
  }
  return [];
}

/**
 * Rimuove i regali dal localStorage
 */
export function clearAutoGiftsStorage(): void {
  try {
    localStorage.removeItem(AUTO_GIFTS_STORAGE_KEY);
  } catch (error) {
    console.error('Errore nel rimuovere i regali:', error);
  }
}
