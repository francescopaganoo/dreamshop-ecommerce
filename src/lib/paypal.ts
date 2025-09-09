// Configurazione PayPal
export const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''; // 'sb' è l'ID client sandbox di default

// Opzioni di configurazione per PayPal unificate
export const paypalOptions = {
  clientId: PAYPAL_CLIENT_ID,
  currency: 'EUR',
  intent: 'capture',
  // Abilita Pay Later e disabilita altri metodi di pagamento
  'enable-funding': 'paylater',
  'disable-funding': 'credit,card,venmo',
  // Componenti necessari per buttons e messages
  components: 'buttons,messages',
  // Locale Italia
  locale: 'it_IT',
  // Ambiente di debug
  'data-page-type': 'product-details'
};

// Funzione per pulire l'importo (rimuove caratteri non numerici eccetto punto decimale)
export function cleanAmount(amount: string): string {
  // Rimuove tutti i caratteri non numerici e non punti
  // Per gestire sia valute con comma (,) che con punto (.)
  const cleaned = amount.replace(/[^0-9.,]/g, '').replace(',', '.');
  
  // Assicura che ci sia solo un punto decimale
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  
  return cleaned;
}
