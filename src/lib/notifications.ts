/**
 * API functions for product notifications
 */

const WORDPRESS_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL;

export interface NotificationSubscription {
  email: string;
  product_id: number;
  customer_name?: string;
}

export interface NotificationResponse {
  success: boolean;
  message: string;
  subscription_id?: number;
}

export interface SubscriptionStatus {
  subscribed: boolean;
  subscription?: {
    id: number;
    email: string;
    product_id: number;
    customer_name: string;
    created_at: string;
    status: string;
  };
}

/**
 * Subscribe to product notifications
 */
export async function subscribeToProduct(subscription: NotificationSubscription): Promise<NotificationResponse> {
  try {
    const response = await fetch(`${WORDPRESS_URL}/wp-json/dspn/v1/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Errore durante l\'iscrizione');
    }

    return result;
  } catch (error) {
    console.error('Error subscribing to product notifications:', error);
    throw error;
  }
}

/**
 * Unsubscribe from product notifications
 */
export async function unsubscribeFromProduct(email: string, productId: number): Promise<NotificationResponse> {
  try {
    const response = await fetch(`${WORDPRESS_URL}/wp-json/dspn/v1/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        product_id: productId
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Errore durante la disiscrizione');
    }

    return result;
  } catch (error) {
    console.error('Error unsubscribing from product notifications:', error);
    throw error;
  }
}

/**
 * Check subscription status
 */
export async function checkSubscriptionStatus(email: string, productId: number): Promise<SubscriptionStatus> {
  try {
    const response = await fetch(
      `${WORDPRESS_URL}/wp-json/dspn/v1/check-subscription?email=${encodeURIComponent(email)}&product_id=${productId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error('Errore durante il controllo dello stato');
    }

    return result;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    throw error;
  }
}