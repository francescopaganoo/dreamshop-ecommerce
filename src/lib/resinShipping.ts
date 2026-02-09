export interface ResinShippingFee {
  id: number;
  order_id: number;
  order_number: string;
  order_item_id: number;
  product_id: number;
  product_name: string;
  shipping_amount: string;
  payment_status: 'pending' | 'paid';
  payment_token: string;
  paid_at: string | null;
  created_at: string;
}

export const getResinShippingFees = async (): Promise<ResinShippingFee[]> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('woocommerce_token') : null;

  if (!token) {
    throw new Error('Token non disponibile');
  }

  const timestamp = new Date().getTime();
  const response = await fetch(`/api/resin-shipping/customer?_=${timestamp}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store'
    }
  });

  if (!response.ok) {
    throw new Error(`Errore: ${response.status}`);
  }

  return response.json();
};

export const getResinShippingFeeByToken = async (token: string): Promise<ResinShippingFee> => {
  const response = await fetch(`/api/resin-shipping/${token}`, {
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('NOT_FOUND');
    }
    throw new Error(`Errore: ${response.status}`);
  }

  return response.json();
};
