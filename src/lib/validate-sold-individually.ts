import api from './woocommerce';

// ============================================================================
// VALIDAZIONE "SOLD INDIVIDUALLY" - FUNZIONE CENTRALIZZATA
// ============================================================================
//
// REGOLA DI BUSINESS: I prodotti WooCommerce con il flag "sold_individually"
// ("Limita gli acquisti a 1 elemento per ordine") non possono comparire in un
// ordine con quantità > 1.
//
// Questa validazione DEVE essere chiamata da tutti gli endpoint che creano
// un ordine PRIMA che venga effettuato il pagamento, per impedire il bypass
// del check lato client (es. manipolazione di localStorage o chiamate dirette
// agli endpoint).
//
// DESIGN:
// - Fetch singola per prodotto (come /api/check-stock).
// - Errori di rete sul singolo prodotto NON bloccano l'ordine (stesso
//   comportamento di check-stock: si preferisce non introdurre regressioni se
//   WC è lento). La difesa è "best effort" ma copre la stragrande maggioranza
//   dei casi reali.
// - Regali automatici e gift card con importo custom vengono saltati (coerente
//   con check-stock).
// ============================================================================

export interface SoldIndividuallyViolation {
  product_id: number;
  variation_id?: number;
  quantity: number;
  name?: string;
}

export interface SoldIndividuallyValidationResult {
  valid: boolean;
  violations: SoldIndividuallyViolation[];
}

export interface NormalizedItem {
  product_id: number;
  variation_id?: number;
  quantity: number;
  meta_data?: Array<{ key: string; value: string }>;
}

function isAutoGift(item: NormalizedItem): boolean {
  return !!item.meta_data?.some(m => m.key === '_is_auto_gift' && m.value === 'yes');
}

function isCustomAmountGiftCard(item: NormalizedItem): boolean {
  return !!item.meta_data?.some(m => m.key === '_gift_card_custom_amount');
}

/**
 * Valida che nessun item con quantity > 1 abbia il flag sold_individually.
 *
 * @param items - Array di line items normalizzati (product_id, quantity, etc.)
 * @param context - Stringa identificativa per il logging (es. 'create-order', 'paypal')
 */
export async function validateSoldIndividually(
  items: NormalizedItem[],
  context: string = 'unknown'
): Promise<SoldIndividuallyValidationResult> {
  if (!items || items.length === 0) {
    return { valid: true, violations: [] };
  }

  const violations: SoldIndividuallyViolation[] = [];

  for (const item of items) {
    // Salta items con quantity <= 1: non possono violare il vincolo
    if (!item.quantity || item.quantity <= 1) continue;

    // Salta flussi speciali coerentemente con /api/check-stock
    if (isAutoGift(item) || isCustomAmountGiftCard(item)) continue;

    try {
      const endpoint = item.variation_id
        ? `products/${item.product_id}/variations/${item.variation_id}`
        : `products/${item.product_id}`;

      const { data } = await api.get(endpoint) as {
        data: { sold_individually?: boolean; name?: string };
      };

      if (data?.sold_individually === true) {
        violations.push({
          product_id: item.product_id,
          variation_id: item.variation_id,
          quantity: item.quantity,
          name: data.name
        });
      }
    } catch (error) {
      // Errori di fetch non bloccano l'ordine: stesso comportamento di check-stock
      console.warn(
        `[sold-individually][${context}] Fetch fallita per product ${item.product_id}, skip:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Costruisce il messaggio utente per un set di violazioni.
 */
export function buildSoldIndividuallyErrorMessage(
  violations: SoldIndividuallyViolation[]
): string {
  if (violations.length === 1) {
    const v = violations[0];
    return `"${v.name ?? 'Un prodotto nel carrello'}" può essere acquistato solo 1 pezzo per ordine.`;
  }
  const names = violations.map(v => `"${v.name ?? `prodotto #${v.product_id}`}"`).join(', ');
  return `I seguenti prodotti possono essere acquistati solo 1 pezzo per ordine: ${names}.`;
}
