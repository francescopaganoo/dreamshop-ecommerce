import { getWooCommerceToken } from '@/lib/auth';

// Interfaccia per gli ordini pianificati
export interface ScheduledOrder {
  id: number;
  parent_id: number;
  parent_order_number: string;
  date_created: string;
  status: string;
  status_name: string;
  total: string;
  formatted_total: string;
  payment_url: string;
  view_url: string;
}

/**
 * Recupera tutti gli ordini pianificati dell'utente
 */
export const getScheduledOrders = async (): Promise<ScheduledOrder[]> => {
  const token = getWooCommerceToken();
  
  if (!token) {
    throw new Error('Token non disponibile');
  }
  
  // Aggiungi un timestamp per evitare problemi di cache
  const timestamp = new Date().getTime();
  const apiUrl = `/api/scheduled-orders?_=${timestamp}`;
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Errore nel recupero degli ordini pianificati: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
};

/**
 * Recupera i dettagli di uno specifico ordine pianificato
 */
export const getScheduledOrder = async (orderId: number): Promise<ScheduledOrder | null> => {
  const token = getWooCommerceToken();
  
  if (!token) {
    throw new Error('Token non disponibile');
  }
  
  const apiUrl = `/api/scheduled-orders/${orderId}`;
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Errore nel recupero dei dettagli dell'ordine: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
};

/**
 * Avvia il processo di pagamento per un ordine pianificato
 * @param orderId ID dell'ordine pianificato da pagare
 * @returns URL di reindirizzamento per la pagina di checkout Stripe
 */
export const processScheduledOrderPayment = async (orderId: number): Promise<string> => {
  const token = getWooCommerceToken();
  
  if (!token) {
    throw new Error('Token non disponibile');
  }
  
  const apiUrl = `/api/scheduled-orders/${orderId}/pay`;
  console.log(`Avvio processo di pagamento per la rata #${orderId}`);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Errore nell'avvio del pagamento: ${response.status}`, errorText);
      throw new Error(`Errore nell'avvio del pagamento: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Risposta API pagamento rata:', data);
    
    if (!data.success || !data.redirect) {
      console.error('Risposta API pagamento non valida:', data);
      throw new Error('URL di pagamento non disponibile');
    }
    
    console.log('Reindirizzamento al checkout Stripe:', data.redirect);
    return data.redirect;
  } catch (error: any) {
    console.error('Errore durante il processo di pagamento:', error.message);
    throw new Error(`Errore durante il pagamento: ${error.message}`);
  }
};
