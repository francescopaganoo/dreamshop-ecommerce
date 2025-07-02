/**
 * Recupera il token JWT di WooCommerce dal localStorage
 */
export const getWooCommerceToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('woocommerce_token');
  }
  return null;
};

/**
 * Salva il token JWT di WooCommerce nel localStorage
 */
export const setWooCommerceToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('woocommerce_token', token);
  }
};

/**
 * Verifica se l'utente è autenticato
 */
export const isAuthenticated = (): boolean => {
  return getWooCommerceToken() !== null;
};

/**
 * Rimuove il token dal localStorage (logout)
 */
export const removeWooCommerceToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('woocommerce_token');
  }
};
