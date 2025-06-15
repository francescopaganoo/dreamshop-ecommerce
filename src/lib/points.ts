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
    console.log(`Richiedo punti per utente ${userId}`);
    
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
    console.log('Punti recuperati:', data);
    return data;
  } catch (error) {
    console.error('Errore durante il recupero dei punti:', error);
    // Restituisci un oggetto vuoto in caso di errore
    return {
      points: 0,
      pointsLabel: '0 punti',
      history: []
    };
  }
}

/**
 * Aggiunge punti all'utente dopo un ordine
 * @param userId ID dell'utente (non utilizzato, viene estratto dal token)
 * @param orderId ID dell'ordine
 * @param orderTotal Totale dell'ordine
 * @param token Token di autenticazione
 * @returns Risultato dell'operazione
 */
export async function addOrderPoints(userId: number, orderId: number, orderTotal: number, token: string): Promise<any> {
  try {
    console.log(`Aggiungo punti per ordine #${orderId}, utente ${userId}, totale ${orderTotal}€`);
    
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
    console.log('Punti aggiunti:', data);
    return data;
  } catch (error) {
    console.error('Errore durante l\'aggiunta dei punti:', error);
    throw error;
  }
}
