// ============================================================================
// STOCK GUARD - PRENOTAZIONE ATOMICA DELLA DISPONIBILITÀ
// ============================================================================
//
// PROBLEMA CHE RISOLVE
// /api/check-stock legge la disponibilità ma non impegna nulla. Fra quel
// controllo (pulsante "Procedi all'acquisto") e la creazione dell'ordine
// passano minuti: compilazione dati, redirect a Klarna/PayPal, capture. In quella
// finestra un altro cliente può portare via l'ultimo pezzo e nessuno se ne accorge,
// perché nessun endpoint di creazione ordine ricontrolla il magazzino.
//
// COME FUNZIONA
// Il plugin WordPress "DreamShop Stock Guard" tiene le prenotazioni in una tabella
// separata e calcola   disponibile = stock_reale − prenotazioni_attive.
// Lo stock di WooCommerce non viene mai toccato: continua a scalare solo alla
// creazione dell'ordine, esattamente come prima.
//
// DUE LIVELLI DI DIFESA
// 1. reserveStock()      - impegna i pezzi al "Procedi all'acquisto" e li tiene
//                          fino alla creazione dell'ordine. Chiude anche la gara
//                          fra due richieste simultanee.
// 2. assertStockAvailable() - controllo di sola lettura da chiamare in ogni
//                          endpoint che apre un pagamento o crea un ordine.
//                          Rete di sicurezza per i flussi senza token
//                          (PayPal Express, webhook, recuperi).
//
// REGOLA DI SICUREZZA
// Si blocca SOLO su una risposta 409 esplicita del plugin. Qualsiasi altro
// problema (WordPress irraggiungibile, chiave errata, timeout, plugin
// disattivato) lascia passare l'ordine e viene solo loggato: la protezione del
// magazzino non deve mai poter fermare il checkout.
//
// MODALITÀ LOG
// Finché nel plugin è attiva la modalità "solo log", il server risponde sempre
// 200 segnalando in `wouldBlock` cosa avrebbe bloccato. Il frontend prosegue
// normalmente e gli eventi restano consultabili in WordPress.
// ============================================================================

const WORDPRESS_URL = (process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://be.dreamshop18.com').replace(/\/+$/, '');
const API_KEY = process.env.DREAMSHOP_STOCK_API_KEY || '';
const BASE_URL = `${WORDPRESS_URL}/wp-json/dreamshop-stock/v1`;

// Il guard non deve mai far attendere il checkout più di qualche secondo.
const REQUEST_TIMEOUT_MS = 5000;

export interface StockGuardItem {
  product_id: number;
  variation_id?: number;
  quantity: number;
  meta_data?: Array<{ key: string; value: string | number | boolean }>;
}

export interface StockGuardUnavailable {
  product_id: number;
  variation_id: number;
  name: string;
  quantity: number;
  stock: number | null;
  reserved: number;
  available: number | null;
  reason: string;
}

export interface StockGuardResult {
  /** false solo quando il plugin ha risposto 409 in modalità blocco. */
  ok: boolean;
  /** Token della prenotazione, presente solo dopo reserveStock. */
  token?: string;
  expiresAt?: string;
  mode: 'log' | 'block' | 'unknown';
  /** In modalità log: cosa sarebbe stato bloccato. */
  wouldBlock: boolean;
  unavailable: StockGuardUnavailable[];
  /** true quando non è stato possibile interpellare il plugin: si è lasciato passare. */
  degraded: boolean;
  message?: string;
}

interface PluginResponse {
  success?: boolean;
  code?: string;
  mode?: string;
  token?: string;
  expires_at?: string;
  would_block?: boolean;
  unavailable?: Array<{
    product_id: number;
    variation_id: number;
    name: string;
    quantity: number;
    stock: number | null;
    reserved: number;
    available: number | null;
    reason: string;
  }>;
  order_id?: number;
}

function degraded(message: string): StockGuardResult {
  return { ok: true, mode: 'unknown', wouldBlock: false, unavailable: [], degraded: true, message };
}

/**
 * Regali automatici e gift card con importo personalizzato non hanno un magazzino
 * da impegnare. Stessa esclusione applicata da /api/check-stock.
 */
function isSkippableItem(item: StockGuardItem): boolean {
  if (!item.meta_data) return false;
  return item.meta_data.some(
    m => m.key === '_gift_card_custom_amount' || (m.key === '_is_auto_gift' && String(m.value) === 'yes')
  );
}

function normalizeItems(items: StockGuardItem[]): Array<{ product_id: number; variation_id: number; quantity: number }> {
  return (items || [])
    .filter(item => item && Number(item.product_id) > 0 && !isSkippableItem(item))
    .map(item => ({
      product_id: Number(item.product_id),
      variation_id: Number(item.variation_id || 0),
      quantity: Math.max(1, Number(item.quantity) || 1),
    }));
}

async function callPlugin(
  path: string,
  body: Record<string, unknown>,
  context: string
): Promise<{ status: number; data: PluginResponse } | null> {
  if (!API_KEY) {
    console.warn(`[stock-guard][${context}] DREAMSHOP_STOCK_API_KEY non configurata: controllo saltato.`);
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dreamshop-Api-Key': API_KEY,
      },
      body: JSON.stringify({ ...body, context }),
      cache: 'no-store',
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as PluginResponse;
    return { status: response.status, data };
  } catch (error) {
    console.warn(
      `[stock-guard][${context}] Chiamata a ${path} fallita, si prosegue senza blocco:`,
      error instanceof Error ? error.message : error
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function toResult(status: number, data: PluginResponse): StockGuardResult {
  const mode = data.mode === 'block' ? 'block' : data.mode === 'log' ? 'log' : 'unknown';
  const unavailable = (data.unavailable || []) as StockGuardUnavailable[];

  // 409 con codice esplicito: è l'unico caso in cui si blocca davvero.
  if (status === 409 && data.code === 'insufficient_stock') {
    return { ok: false, mode, wouldBlock: true, unavailable, degraded: false, message: buildStockErrorMessage(unavailable) };
  }

  if (status >= 200 && status < 300) {
    return {
      ok: true,
      token: data.token,
      expiresAt: data.expires_at,
      mode,
      wouldBlock: !!data.would_block,
      unavailable,
      degraded: false,
    };
  }

  // 401, 404, 423, 5xx: il guard non è in grado di decidere, si lascia passare.
  return degraded(`Risposta inattesa dal plugin (HTTP ${status}${data.code ? `, ${data.code}` : ''})`);
}

/**
 * Impegna i pezzi per un carrello. Da chiamare al "Procedi all'acquisto" e nei
 * flussi express prima di aprire il pagamento.
 */
export async function reserveStock(params: {
  sessionId: string;
  items: StockGuardItem[];
  context: string;
  ttlMinutes?: number;
}): Promise<StockGuardResult> {
  const items = normalizeItems(params.items);
  if (items.length === 0) {
    return { ok: true, mode: 'unknown', wouldBlock: false, unavailable: [], degraded: false };
  }

  const response = await callPlugin(
    '/reserve',
    { session_id: params.sessionId, items, ttl_minutes: params.ttlMinutes || 0 },
    params.context
  );

  if (!response) return degraded('Plugin non raggiungibile');
  return toResult(response.status, response.data);
}

/**
 * Prolunga una prenotazione riverificando la disponibilità.
 * Da chiamare all'apertura del pagamento, così un checkout lento non scade.
 */
export async function renewReservation(token: string, context: string): Promise<StockGuardResult> {
  if (!token) return degraded('Nessun token di prenotazione');

  const response = await callPlugin(`/reserve/${encodeURIComponent(token)}/renew`, {}, context);
  if (!response) return degraded('Plugin non raggiungibile');

  // Una prenotazione scaduta o sconosciuta non è un motivo per bloccare:
  // il controllo di disponibilità viene comunque rifatto da assertStockAvailable.
  if (response.status === 404) return degraded('Prenotazione non trovata');

  return toResult(response.status, response.data);
}

/**
 * Consuma la prenotazione dopo che l'ordine WooCommerce è stato creato.
 * Non fallisce mai in modo bloccante: a questo punto l'ordine esiste già.
 */
export async function commitReservation(token: string, orderId: number, context: string): Promise<void> {
  if (!token || !orderId) return;

  const response = await callPlugin(
    `/reserve/${encodeURIComponent(token)}/commit`,
    { order_id: orderId },
    context
  );

  if (!response) return;

  if (response.status !== 200) {
    console.warn(
      `[stock-guard][${context}] Commit prenotazione ${token} per ordine ${orderId}: HTTP ${response.status} (${response.data.code || 'senza codice'})`
    );
  }
}

/** Rilascia una prenotazione, per esempio quando il pagamento viene annullato. */
export async function releaseReservation(token: string, context: string): Promise<void> {
  if (!token) return;
  await callPlugin(`/reserve/${encodeURIComponent(token)}/release`, {}, context);
}

/**
 * Controllo di sola lettura della disponibilità, senza creare prenotazioni.
 *
 * È la rete di sicurezza da mettere in ogni endpoint che apre un pagamento o
 * crea un ordine: non richiede un token e da sola sarebbe bastata a fermare
 * entrambe le vendite in eccesso registrate su questo store, arrivate circa un
 * minuto dopo l'esaurimento del pezzo.
 *
 * @param excludeToken Token della prenotazione del cliente stesso, per non farlo
 *                     risultare in conflitto con la propria prenotazione.
 */
export async function assertStockAvailable(params: {
  items: StockGuardItem[];
  context: string;
  excludeToken?: string;
  excludeSession?: string;
}): Promise<StockGuardResult> {
  const items = normalizeItems(params.items);
  if (items.length === 0) {
    return { ok: true, mode: 'unknown', wouldBlock: false, unavailable: [], degraded: false };
  }

  const response = await callPlugin(
    '/availability',
    {
      items,
      exclude_token: params.excludeToken || '',
      exclude_session: params.excludeSession || '',
    },
    params.context
  );

  if (!response) return degraded('Plugin non raggiungibile');
  return toResult(response.status, response.data);
}

/** Messaggio utente per un elenco di articoli non disponibili. */
export function buildStockErrorMessage(unavailable: StockGuardUnavailable[]): string {
  if (!unavailable || unavailable.length === 0) {
    return 'Alcuni prodotti nel carrello non sono più disponibili.';
  }

  if (unavailable.length === 1) {
    const item = unavailable[0];
    const name = item.name || 'Un prodotto nel carrello';

    if (item.available !== null && item.available > 0) {
      return `Di "${name}" ${item.available === 1 ? 'è rimasto solo 1 pezzo' : `sono rimasti solo ${item.available} pezzi`}.`;
    }
    return `"${name}" non è più disponibile.`;
  }

  const names = unavailable.map(item => `"${item.name || `prodotto #${item.product_id}`}"`).join(', ');
  return `Questi prodotti non sono più disponibili nella quantità richiesta: ${names}.`;
}

// ============================================================================
// UTILITÀ PER I DATI ORDINE
// ============================================================================
//
// Il token viaggia dentro `meta_data` dell'orderData con la chiave
// `_dsg_reservation_token`: così arriva senza plumbing aggiuntivo fino al webhook
// Stripe (che rilegge l'orderData dal temp-order store) e finisce anche come meta
// dell'ordine WooCommerce, utile per risalire alla prenotazione in fase di verifica.
// ============================================================================

export const RESERVATION_META_KEY = '_dsg_reservation_token';

interface OrderDataLike {
  line_items?: Array<{
    product_id?: number | string;
    variation_id?: number | string;
    quantity?: number | string;
    meta_data?: Array<{ key: string; value: string | number | boolean }>;
  }>;
  meta_data?: Array<{ key: string; value: string | number | boolean }>;
}

/** Estrae gli articoli da un orderData in formato WooCommerce. */
export function extractItemsFromOrderData(orderData: unknown): StockGuardItem[] {
  const data = orderData as OrderDataLike | null | undefined;
  if (!data || !Array.isArray(data.line_items)) return [];

  return data.line_items
    .filter(item => item && Number(item.product_id) > 0)
    .map(item => ({
      product_id: Number(item.product_id),
      variation_id: Number(item.variation_id || 0),
      quantity: Math.max(1, Number(item.quantity) || 1),
      meta_data: item.meta_data,
    }));
}

/** Legge il token di prenotazione dai metadati di un orderData. */
export function extractReservationToken(orderData: unknown): string {
  const data = orderData as OrderDataLike | null | undefined;
  if (!data || !Array.isArray(data.meta_data)) return '';

  const meta = data.meta_data.find(m => m && m.key === RESERVATION_META_KEY);
  return meta ? String(meta.value || '') : '';
}
