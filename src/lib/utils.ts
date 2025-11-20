/**
 * Formatta un prezzo con il simbolo dell'euro
 * @param {string|number} price - Il prezzo da formattare
 * @returns {string} - Il prezzo formattato
 */
export function formatPrice(price: string | number): string {
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numericPrice);
}

/**
 * Controlla se un utente è autenticato
 * @returns {boolean} - true se l'utente è autenticato, false altrimenti
 */
export function isUserAuthenticated(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  return !!localStorage.getItem('woocommerce_token');
}

/**
 * Ottiene l'ID dell'utente corrente dal token JWT
 * @returns {number|null} - L'ID dell'utente o null se non autenticato
 */
export function getCurrentUserId(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const token = localStorage.getItem('woocommerce_token');

  if (!token) {
    return null;
  }

  try {
    // Decodifica il payload del token JWT (la seconda parte)
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const payload = JSON.parse(jsonPayload);
    return payload.id || null;
  } catch (error) {
    console.error('Errore nella decodifica del token JWT:', error);
    return null;
  }
}

/**
 * Verifica se l'offerta di un prodotto è attualmente attiva
 * @param {Object} product - Il prodotto da verificare
 * @param {string} product.sale_price - Prezzo scontato
 * @param {string} [product.date_on_sale_from] - Data di inizio offerta
 * @param {string} [product.date_on_sale_to] - Data di fine offerta
 * @returns {boolean} - true se l'offerta è attiva, false altrimenti
 */
export function isProductOnSale(product: {
  sale_price?: string;
  date_on_sale_from?: string;
  date_on_sale_to?: string;
}): boolean {
  if (!product.sale_price || product.sale_price === '') {
    return false;
  }

  const now = new Date().getTime();

  // Controlla la data di inizio (se presente)
  if (product.date_on_sale_from) {
    const startDate = new Date(product.date_on_sale_from).getTime();
    if (now < startDate) {
      return false;
    }
  }

  // Controlla la data di fine (se presente)
  if (product.date_on_sale_to) {
    const endDate = new Date(product.date_on_sale_to).getTime();
    if (now > endDate) {
      return false;
    }
  }

  return true;
}
