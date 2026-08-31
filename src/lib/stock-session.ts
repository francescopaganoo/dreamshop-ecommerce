// ============================================================================
// SESSIONE E TOKEN DI PRENOTAZIONE (lato browser)
// ============================================================================
//
// Due regole che non vanno violate, perché sbagliarle porta a bloccare clienti
// legittimi invece che a proteggere il magazzino:
//
// 1. L'identificativo di sessione deve essere UNICO PER BROWSER, non derivabile
//    da prodotto o utente. Il server rilascia le prenotazioni precedenti della
//    stessa sessione prima di crearne una nuova: se due visitatori diversi
//    condividessero lo stesso identificativo, il secondo cancellerebbe la
//    prenotazione del primo e la protezione si annullerebbe da sola.
//
// 2. Non si prenota se non si è in grado di conservare il token. Senza token il
//    cliente non può essere escluso dal conteggio al momento del pagamento e
//    verrebbe bloccato dalla propria stessa prenotazione. In quel caso si
//    rinuncia alla protezione e si prosegue come prima.
// ============================================================================

const SESSION_KEY = 'stock_session_id';
const TOKEN_KEY = 'stock_reservation_token';

/** Verifica che localStorage sia davvero utilizzabile in lettura e scrittura. */
function isStorageUsable(): boolean {
  try {
    const probe = '__dsg_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Identificativo stabile del browser.
 * Ritorna stringa vuota se localStorage non è utilizzabile: in quel caso il
 * chiamante deve rinunciare alla prenotazione, non inventarne una volatile.
 */
export function getStockSessionId(): string {
  if (!isStorageUsable()) return '';

  try {
    let sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = `dsg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
  } catch {
    return '';
  }
}

export function getStockReservationToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

/** Salva il token. Ritorna false se non è stato possibile conservarlo. */
export function setStockReservationToken(token: string | null): boolean {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    return true;
  } catch {
    return false;
  }
}
