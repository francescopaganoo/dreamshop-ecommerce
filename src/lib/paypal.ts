// Configurazione PayPal
export const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'ARJfl24GmWSY5ULLgbtlZXXOH9JDmaAB1Fo1v0ZGTphdUiVc36cu4n0DztGEWU-WKVljgnczVqWamVFv'; // 'sb' è l'ID client sandbox di default

// Opzioni di configurazione per PayPal
export const paypalOptions = {
  clientId: PAYPAL_CLIENT_ID,
  currency: 'EUR',
  intent: 'capture',
  // Disabilita i pulsanti di finanziamento che non vogliamo mostrare
  disableFunding: 'credit,card,p24,sofort',
};
