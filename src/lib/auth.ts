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

/**
 * Salva l'URL corrente per il redirect post-login
 */
export const setReturnUrl = (url: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('return_url', url);
  }
};

/**
 * Recupera l'URL di ritorno salvato
 */
export const getReturnUrl = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('return_url');
  }
  return null;
};

/**
 * Rimuove l'URL di ritorno salvato
 */
export const clearReturnUrl = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('return_url');
  }
};

/**
 * Recupera il token di autenticazione
 * Utilizzabile in contesti server-side
 */
export const getAuthToken = async (): Promise<string | null> => {
  try {
    // In ambiente server-side, non possiamo accedere direttamente a localStorage
    // Nelle API Routes di Next.js, il token potrebbe essere passato tramite cookies
    // o recuperato in altri modi
    
    // Questa è una implementazione di base che usa la funzione esistente
    // In un contesto server-side reale, qui si dovrebbero usare i cookies o headers
    if (typeof window !== 'undefined') {
      return getWooCommerceToken();
    }
    
    // Se siamo sul server, dovremmo ottenere il token in altro modo
    // Ad esempio usando i cookies nella request o un'altra fonte
    return null;
  } catch (error) {
    console.error('Errore nel recupero del token di autenticazione:', error);
    return null;
  }
};
