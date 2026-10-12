import { Stripe, loadStripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
};

// Billing details for confirmCardPayment, from the billingName/billingEmail returned by the
// *-stripe-pay routes: shows the real customer on Stripe instead of a generic placeholder
export const cardBillingDetails = (data?: { billingName?: string; billingEmail?: string } | null) => ({
  name: data?.billingName || 'Cliente Dreamshop',
  ...(data?.billingEmail ? { email: data.billingEmail } : {}),
});
