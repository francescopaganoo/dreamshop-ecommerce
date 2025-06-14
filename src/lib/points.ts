/**
 * Funzioni di utilità per la gestione dei punti
 */

/**
 * Interfaccia per la risposta dell'API dei punti
 */
interface PointsApiResponse {
  success: boolean;
  message: string;
  data?: {
    points?: number;
    user_id?: number;
  };
}

/**
 * Aggiunge punti a un utente dopo un ordine completato
 * @param userId ID dell'utente
 * @param orderId ID dell'ordine
 * @param orderTotal Totale dell'ordine
 * @param token Token di autenticazione
 * @returns Promise con la risposta dell'API
 */
export const addOrderPoints = async (
  userId: number,
  orderId: number,
  orderTotal: number,
  token: string
): Promise<PointsApiResponse | null> => {
  try {
    // Calcola i punti da assegnare (1 punto ogni 1€ di spesa)
    const points = Math.floor(orderTotal / 1);
    
    if (points <= 0) {
      console.log('Nessun punto da assegnare per questo ordine');
      return null;
    }
    
    console.log(`Aggiunta di ${points} punti per l'utente ${userId} per l'ordine #${orderId}`);
    
    // Chiamata all'API per aggiungere i punti
    const response = await fetch('/api/points/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        points: points,
        description: `Punti guadagnati dall'ordine #${orderId}`,
        order_id: orderId
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Errore nell'aggiunta dei punti: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Punti aggiunti con successo:', data);
    return data;
  } catch (error) {
    console.error('Errore durante l\'aggiunta dei punti:', error);
    return null;
  }
};
