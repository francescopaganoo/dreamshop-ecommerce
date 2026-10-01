// Finestra di pagamento delle pagine Stripe Checkout (Klarna, Satispay).
//
// Senza expires_at una sessione resta pagabile 24 ore, mentre i dati
// dell'ordine (plugin dreamshop-temp-orders) scadono dopo 2 ore: un cliente
// che pagava dopo era addebitato senza che l'ordine venisse creato (sessione
// cs_live_a1peNq..., 30/09/2026, pagata dopo 4h46m).
//
// Le durate vanno tenute in quest'ordine:
//   sessione Stripe (31 min) < prenotazione pezzi (35 min) < dati ordine (2 ore)
// cosi' chi riesce a pagare lo fa con il pezzo ancora riservato e con i dati
// dell'ordine ancora disponibili per il webhook.

/** Stripe rifiuta expires_at sotto i 30 minuti dalla creazione: 31 lascia margine alla latenza. */
export const CHECKOUT_SESSION_TTL_MINUTES = 31;

/** Qualche minuto oltre la sessione, per chi paga all'ultimo prima che arrivi il webhook. */
export const CHECKOUT_RESERVATION_TTL_MINUTES = 35;

/** Valore di expires_at (secondi Unix) per stripe.checkout.sessions.create. */
export function checkoutSessionExpiresAt(): number {
  return Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_TTL_MINUTES * 60;
}
