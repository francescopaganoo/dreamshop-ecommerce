// Store persistente per i dati degli ordini Klarna usando WordPress/MySQL

interface StoredOrderData {
  orderData: unknown;
  pointsToRedeem: number;
  pointsDiscount: number;
}

const WORDPRESS_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://be.dreamshop18.com';
const API_KEY = process.env.DREAMSHOP_TEMP_ORDER_API_KEY || 'dreamshop_temp_order_secret_key_2024';

class OrderDataStore {

  /**
   * Salva i dati dell'ordine su WordPress/MySQL
   */
  async set(dataId: string, data: StoredOrderData): Promise<boolean> {
    try {
      const response = await fetch(`${WORDPRESS_URL}/wp-json/dreamshop/v1/temp-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dreamshop-Api-Key': API_KEY,
        },
        body: JSON.stringify({
          data_id: dataId,
          order_data: data.orderData,
          points_to_redeem: data.pointsToRedeem,
          points_discount: data.pointsDiscount,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[ORDER-STORE] Errore salvataggio:', error);
        return false;
      }

            return true;
    } catch (error) {
      console.error('[ORDER-STORE] Errore di connessione:', error);
      return false;
    }
  }

  /**
   * Recupera i dati dell'ordine da WordPress/MySQL
   */
  async get(dataId: string): Promise<StoredOrderData | null> {
    try {
      const response = await fetch(`${WORDPRESS_URL}/wp-json/dreamshop/v1/temp-order/${dataId}`, {
        method: 'GET',
        headers: {
          'X-Dreamshop-Api-Key': API_KEY,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[ORDER-STORE] Errore recupero:', error);
        return null;
      }

      const result = await response.json();
      
      return {
        orderData: result.data.orderData,
        pointsToRedeem: result.data.pointsToRedeem,
        pointsDiscount: result.data.pointsDiscount,
      };
    } catch (error) {
      console.error('[ORDER-STORE] Errore di connessione:', error);
      return null;
    }
  }

  /**
   * Elimina i dati dell'ordine da WordPress/MySQL
   */
  async delete(dataId: string): Promise<boolean> {
    try {
      const response = await fetch(`${WORDPRESS_URL}/wp-json/dreamshop/v1/temp-order/${dataId}`, {
        method: 'DELETE',
        headers: {
          'X-Dreamshop-Api-Key': API_KEY,
        },
      });

      if (!response.ok) {
        console.error('[ORDER-STORE] Errore eliminazione');
        return false;
      }

            return true;
    } catch (error) {
      console.error('[ORDER-STORE] Errore di connessione:', error);
      return false;
    }
  }

  /**
   * Genera un ID univoco per l'ordine temporaneo
   */
  generateId(): string {
    return `payment_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Singleton instance
export const orderDataStore = new OrderDataStore();
