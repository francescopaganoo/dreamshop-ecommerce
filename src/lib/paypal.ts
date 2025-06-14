// Configurazione PayPal
export const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'AQp06Lsyjs71OUx7Ji3F2TrMPqqGR9jVMRo61sd3Z5s8OZhyG6HDIBdf9tsj_o5fJeQDXCGU52FDeM33'; // 'sb' è l'ID client sandbox di default

// Opzioni di configurazione per PayPal
export const paypalOptions = {
  clientId: PAYPAL_CLIENT_ID,
  currency: 'EUR',
  intent: 'capture',
  // Disabilita i pulsanti di finanziamento che non vogliamo mostrare
  disableFunding: 'credit,card,p24,sofort',
};
