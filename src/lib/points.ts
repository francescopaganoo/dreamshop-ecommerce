/**
 * Utility per la gestione dei punti WooCommerce
 */

/**
 * Interfaccia per la cronologia dei punti
 */
export interface PointsHistoryItem {
  id: number;
  date: string;
  points: number;
  description: string;
  type: 'earn' | 'redeem';
}

/**
 * Interfaccia per la risposta dell'API dei punti
 */
export interface PointsResponse {
  points: number;
  pointsLabel: string;
  history: PointsHistoryItem[];
}

/**
 * Ottiene i punti dell'utente
 * @param userId ID dell'utente (non utilizzato, viene estratto dal token)
 * @param token Token di autenticazione
 * @returns Oggetto con i punti, l'etichetta e la cronologia
 */
export async function getUserPoints(userId: number, token: string): Promise<PointsResponse> {
  try {
    
    // Usa l'API Next.js invece di chiamare direttamente WordPress
    const response = await fetch(`/api/points/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Errore nel recupero dei punti: ${response.status}`, errorText);
      throw new Error(`Errore nel recupero dei punti: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Errore durante il recupero dei punti:', error);
    // Restituisci un oggetto vuoto in caso di errore
    return {
      success: false,
      user_id: userId,
      points: 0,
      pointsLabel: '0 punti',
      history: [],
      new_balance: 0,
      description: 'Errore nel recupero dei punti'
    };
  }
}

/**
 * Interfaccia per la risposta dell'API di aggiunta o rimozione punti
 */
export interface PointsResponse {
  success: boolean;
  user_id: number;
  points_added?: number;
  points_redeemed?: number;
  new_balance: number;
  previous_balance?: number;
  description: string;
  order_id?: number;
}

/**
 * Aggiunge punti all'utente dopo un ordine
 * @param userId ID dell'utente (non utilizzato, viene estratto dal token)
 * @param orderId ID dell'ordine
 * @param orderTotal Totale dell'ordine
 * @param token Token di autenticazione
 * @returns Risultato dell'operazione
 */
export async function addOrderPoints(userId: number, orderId: number, orderTotal: number, token: string): Promise<PointsResponse> {
  try {
    
    // Calcola i punti da aggiungere (1 punto ogni euro)
    const points = Math.floor(orderTotal);
    
    // Usa l'API Next.js invece di chiamare direttamente WordPress
    const response = await fetch(`/api/points/add`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        points: points,
        description: `Punti guadagnati per l'ordine #${orderId}`,
        order_id: orderId
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Errore nell'aggiunta dei punti: ${response.status}`, errorText);
      throw new Error(`Errore nell'aggiunta dei punti: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Errore durante l\'aggiunta dei punti:', error);
    throw error;
  }
}

/**
 * Riscatta punti dell'utente per ottenere uno sconto
 * @param userId ID dell'utente (non utilizzato, viene estratto dal token)
 * @param points Punti da riscattare
 * @param orderId ID dell'ordine (opzionale)
 * @param token Token di autenticazione
 * @returns Risultato dell'operazione
 */
export async function redeemPoints(userId: number, points: number, orderId: number | null, token: string): Promise<PointsResponse> {
  try {

    // Validazione parametri
    if (!points || points <= 0) {
      console.error(`[POINTS DEBUG] Errore: punti non validi (${points})`);
      throw new Error('Punti non validi');
    }
    
    if (!token) {
      console.error('[POINTS DEBUG] Errore: token mancante');
      throw new Error('Token mancante');
    }
    
    // Usa l'API Next.js invece di chiamare direttamente WordPress
    const response = await fetch(`/api/points/redeem`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        points: points,
        description: orderId ? `Punti utilizzati per uno sconto sull'ordine #${orderId}` : 'Punti utilizzati per uno sconto',
        order_id: orderId || 0,
        // Aggiunta di campi ridondanti per gestire diverse interpretazioni su iOS
        orderId: orderId || 0,
        id: orderId || 0,
        // Includi informazioni sul dispositivo
        _client: {
          isIOS: typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
        }
      })
    });
    
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[POINTS DEBUG] Errore nel riscatto dei punti: ${response.status}`, errorText);
      throw new Error(`Errore nel riscatto dei punti: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[POINTS DEBUG] Errore durante il riscatto dei punti:', error);
    throw error;
  }
}
