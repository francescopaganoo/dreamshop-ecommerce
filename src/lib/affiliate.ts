export interface AffiliateCoupon {
  id: number;
  code: string;
  order_count: number;
  total_sales: number;
  total_commission: number;
}

export interface AffiliateOrder {
  order_id: number;
  order_date: string;
  status: string;
  coupon_code: string;
  amount: number;
  commission_amount: number;
}

export interface AffiliateTotals {
  total_orders: number;
  total_sales: number;
  total_commission: number;
  active_coupons: number;
}

export interface AffiliateDashboardData {
  totals: AffiliateTotals;
  coupons: AffiliateCoupon[];
  orders: AffiliateOrder[];
  date_range: {
    start_date: string;
    end_date: string;
  };
}

export const getAffiliateStatus = async (): Promise<boolean> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('woocommerce_token') : null;
  if (!token) return false;

  try {
    const response = await fetch('/api/affiliate/status', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.is_affiliate === true;
  } catch {
    return false;
  }
};

export const getAffiliateDashboard = async (
  startDate?: string,
  endDate?: string
): Promise<AffiliateDashboardData> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('woocommerce_token') : null;
  if (!token) throw new Error('Token non disponibile');

  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);

  const queryString = params.toString();
  const url = `/api/affiliate/dashboard${queryString ? '?' + queryString : ''}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Errore: ${response.status}`);
  }

  return response.json();
};
