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
   * Marca un ordine come completato (invece di eliminarlo)
   * Il webhook usa questo dopo aver creato l'ordine WooCommerce
   */
  async markCompleted(dataId: string, params: { wcOrderId: number; paymentIntentId: string }): Promise<boolean> {
    try {
      const response = await fetch(`${WORDPRESS_URL}/wp-json/dreamshop/v1/temp-order/${dataId}/mark-completed`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Dreamshop-Api-Key': API_KEY,
        },
        body: JSON.stringify({
          wc_order_id: params.wcOrderId,
          payment_intent_id: params.paymentIntentId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[ORDER-STORE] Errore markCompleted:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ORDER-STORE] Errore di connessione markCompleted:', error);
      return false;
    }
  }

  /**
   * Cerca un ordine per payment_intent_id
   * Ritorna wc_order_id se l'ordine è stato completato dal webhook
   */
  async getByPaymentIntent(paymentIntentId: string): Promise<{ dataId: string; wcOrderId: number | null; status: string } | null> {
    try {
      const url = `${WORDPRESS_URL}/wp-json/dreamshop/v1/temp-order-by-pi/${paymentIntentId}`;
      console.log(`[ORDER-STORE] getByPaymentIntent: ${paymentIntentId}`);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Dreamshop-Api-Key': API_KEY,
        },
      });

      if (!response.ok) {
        console.log(`[ORDER-STORE] getByPaymentIntent: non trovato (status=${response.status})`);
        return null;
      }

      const result = await response.json();

      return {
        dataId: result.data.data_id,
        wcOrderId: result.data.wc_order_id,
        status: result.data.status,
      };
    } catch (error) {
      console.error('[ORDER-STORE] Errore di connessione getByPaymentIntent:', error);
      return null;
    }
  }

  /**
   * Salva il payment_intent_id associato a un ordine temporaneo già esistente
   */
  async setPaymentIntentId(dataId: string, paymentIntentId: string): Promise<boolean> {
    try {
      console.log(`[ORDER-STORE] setPaymentIntentId: dataId=${dataId}, pi=${paymentIntentId}`);
      const url = `${WORDPRESS_URL}/wp-json/dreamshop/v1/temp-order/${dataId}/mark-completed`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Dreamshop-Api-Key': API_KEY,
        },
        body: JSON.stringify({
          payment_intent_id: paymentIntentId,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[ORDER-STORE] Errore setPaymentIntentId: status=${response.status}, body=${errorBody}`);
        return false;
      }

      console.log(`[ORDER-STORE] setPaymentIntentId OK per ${dataId}`);
      return true;
    } catch (error) {
      console.error('[ORDER-STORE] Errore di connessione setPaymentIntentId:', error);
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
