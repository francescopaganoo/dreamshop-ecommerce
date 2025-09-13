// Gift Card API client per comunicazione con il plugin WordPress

export interface GiftCardBalance {
  user_id: number;
  balance: number;
  formatted_balance: string;
}

export interface GiftCardTransaction {
  id: number;
  amount: number;
  formatted_amount: string;
  type: 'credit' | 'debit';
  type_label: string;
  description: string;
  order_id?: number;
  coupon_code?: string;
  created_at: string;
  formatted_date: string;
}

export interface GiftCardCoupon {
  id: number;
  user_id: number;
  coupon_code: string;
  amount: number;
  formatted_amount: string;
  status: 'active' | 'used' | 'expired';
  expires_at?: string;
  created_at: string;
  used_at?: string;
}

export interface GiftCardApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_WP_API_URL || '';

// Ottieni il saldo gift card dell'utente
export async function getGiftCardBalance(userId: number, token: string): Promise<GiftCardBalance> {
  try {
    // Usa l'API Next.js invece di chiamare direttamente WordPress (come fanno gli altri endpoint)
    const response = await fetch(`/api/gift-cards/balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success && !result.user_id) {
      throw new Error(result.message || 'Errore nel recupero del saldo');
    }

    // Formato compatibile con l'interfaccia esistente
    return {
      user_id: result.user_id,
      balance: result.balance,
      formatted_balance: result.formatted_balance
    };
  } catch (error) {
    console.error('Errore nel recupero del saldo gift card:', error);
    throw error;
  }
}

// Ottieni le transazioni gift card dell'utente
export async function getGiftCardTransactions(
  userId: number, 
  token: string,
  limit: number = 50,
  offset: number = 0
): Promise<{transactions: GiftCardTransaction[], has_more: boolean}> {
  try {
    // Usa l'API Next.js invece di chiamare direttamente WordPress (come fanno gli altri endpoint)
    const response = await fetch(
      `/api/gift-cards/transactions?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success && !result.transactions) {
      throw new Error(result.message || 'Errore nel recupero delle transazioni');
    }

    return {
      transactions: result.transactions || [],
      has_more: result.has_more || false
    };
  } catch (error) {
    console.error('Errore nel recupero delle transazioni gift card:', error);
    throw error;
  }
}

// Genera un nuovo coupon gift card
export async function generateGiftCardCoupon(
  userId: number, 
  amount: number, 
  token: string
): Promise<{coupon_code: string, amount: number, formatted_amount: string, new_balance: number, formatted_new_balance: string}> {
  try {
    // Usa l'API Next.js invece di chiamare direttamente WordPress (come fanno gli altri endpoint)
    const response = await fetch(`/api/gift-cards/generate-coupon`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        amount: amount
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Errore nella generazione del coupon');
    }

    return {
      coupon_code: result.coupon_code,
      amount: result.amount,
      formatted_amount: result.formatted_amount,
      new_balance: result.new_balance,
      formatted_new_balance: result.formatted_new_balance
    };
  } catch (error) {
    console.error('Errore nella generazione del coupon gift card:', error);
    throw error;
  }
}

// Ottieni informazioni su un coupon specifico
export async function getGiftCardCouponInfo(couponCode: string): Promise<GiftCardCoupon> {
  try {
    const response = await fetch(`${API_BASE_URL}/gift-card/v1/coupon/${couponCode}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: GiftCardApiResponse<GiftCardCoupon> = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Coupon non trovato');
    }

    return result.data;
  } catch (error) {
    console.error('Errore nel recupero delle info del coupon:', error);
    throw error;
  }
}

// Valida un coupon gift card
export async function validateGiftCardCoupon(
  couponCode: string, 
  cartTotal: number
): Promise<{
  valid: boolean;
  coupon_code: string;
  coupon_amount: number;
  discount_amount: number;
  formatted_discount: string;
  cart_total: number;
  new_total: number;
  message: string;
}> {
  try {
    // Usa l'API Next.js invece di chiamare direttamente WordPress (come fanno gli altri endpoint)
    const response = await fetch(`/api/gift-cards/validate-coupon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coupon_code: couponCode,
        cart_total: cartTotal
      }),
    });

    if (!response.ok) {
      console.error(`Errore nella validazione del coupon: ${response.status}`);
      return {
        valid: false,
        coupon_code: couponCode,
        coupon_amount: 0,
        discount_amount: 0,
        formatted_discount: '€0,00',
        cart_total: cartTotal,
        new_total: cartTotal,
        message: `Errore del server: ${response.status}`
      };
    }

    const result = await response.json();
    
    if (!result.success) {
      return {
        valid: false,
        coupon_code: couponCode,
        coupon_amount: 0,
        discount_amount: 0,
        formatted_discount: '€0,00',
        cart_total: cartTotal,
        new_total: cartTotal,
        message: result.message || 'Coupon non valido'
      };
    }

    return {
      valid: result.valid || true,
      coupon_code: couponCode,
      coupon_amount: result.coupon_amount || 0,
      discount_amount: result.discount_amount || 0,
      formatted_discount: result.formatted_discount || '€0,00',
      cart_total: cartTotal,
      new_total: result.new_total || cartTotal,
      message: result.message || 'Coupon valido'
    };
  } catch (error) {
    console.error('Errore nella validazione del coupon:', error);
    return {
      valid: false,
      coupon_code: couponCode,
      coupon_amount: 0,
      discount_amount: 0,
      formatted_discount: '€0,00',
      cart_total: cartTotal,
      new_total: cartTotal,
      message: 'Errore di connessione'
    };
  }
}