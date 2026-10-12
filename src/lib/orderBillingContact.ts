import api from '@/lib/woocommerce';

export interface BillingContact {
  name: string;
  email: string;
}

/**
 * Read the customer's billing name and email from a WooCommerce order (server only).
 * Used to show the real customer on Stripe payments instead of a generic placeholder.
 * Never throws: on failure returns empty values so the payment can still proceed.
 */
export async function getOrderBillingContact(orderId: number | string): Promise<BillingContact> {
  try {
    const { data } = await api.get(`orders/${orderId}`) as {
      data: { billing?: { first_name?: string; last_name?: string; email?: string } };
    };
    const billing = data.billing || {};
    return {
      name: [billing.first_name, billing.last_name].filter(Boolean).join(' ').trim(),
      email: (billing.email || '').trim(),
    };
  } catch (error) {
    console.error(`getOrderBillingContact: impossibile leggere l'ordine #${orderId}:`, error instanceof Error ? error.message : error);
    return { name: '', email: '' };
  }
}
