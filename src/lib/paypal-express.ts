// Configurazione PayPal Express separata per Pay Later Italia
export const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';

// Configurazione specifica per PayPal Express con Pay Later Italia
export const paypalExpressOptions = {
  clientId: PAYPAL_CLIENT_ID,
  currency: 'EUR',
  intent: 'capture',
  // Abilita Pay Later esplicitamente
  'enable-funding': 'paylater',
  'disable-funding': 'credit,card,venmo',
  // Componenti necessari per Pay Later
  components: 'buttons,messages',
  // Locale Italia
  locale: 'it_IT',
  // Ambiente di debug
  'data-page-type': 'product-details'
};