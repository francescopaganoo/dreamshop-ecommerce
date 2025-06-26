

export interface WishlistItem {
  id: number;
  name: string;
  price: string;
  regular_price: string;
  sale_price?: string;
  image?: {
    src: string;
    alt: string;
  };
  permalink: string;
  date_added: string;
}

/**
 * Ottiene la wishlist dell'utente corrente
 * @returns {Promise<WishlistItem[]>} - Lista dei prodotti nella wishlist
 */
export async function getWishlist(): Promise<WishlistItem[]> {
  try {
    const token = localStorage.getItem('woocommerce_token');
    
    if (!token) {
      console.error('Utente non autenticato');
      return [];
    }
    
    const response = await fetch('/api/wishlist', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Errore nel recupero della wishlist');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Errore nel recupero della wishlist:', error);
    return [];
  }
}

/**
 * Aggiunge un prodotto alla wishlist
 * @param {number} productId - ID del prodotto da aggiungere
 * @returns {Promise<{success: boolean, message: string}>} - Risultato dell'operazione
 */
export async function addToWishlist(productId: number): Promise<{success: boolean, message: string, already_exists?: boolean}> {
  try {
    const token = localStorage.getItem('woocommerce_token');
    
    if (!token) {
      return {
        success: false,
        message: 'Utente non autenticato'
      };
    }
    
    const response = await fetch('/api/wishlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'add',
        productId
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Errore nell\'aggiunta alla wishlist');
    }
    
    const data = await response.json();
    
    return {
      success: true,
      message: data.message || 'Prodotto aggiunto alla wishlist',
      already_exists: data.already_exists
    };
  } catch (error) {
    console.error('Errore nell\'aggiunta alla wishlist:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Errore nell\'aggiunta alla wishlist'
    };
  }
}

/**
 * Rimuove un prodotto dalla wishlist
 * @param {number} productId - ID del prodotto da rimuovere
 * @returns {Promise<{success: boolean, message: string}>} - Risultato dell'operazione
 */
export async function removeFromWishlist(productId: number): Promise<{success: boolean, message: string}> {
  try {
    const token = localStorage.getItem('woocommerce_token');
    
    if (!token) {
      return {
        success: false,
        message: 'Utente non autenticato'
      };
    }
    
    const response = await fetch('/api/wishlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'remove',
        productId
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Errore nella rimozione dalla wishlist');
    }
    
    const data = await response.json();
    
    return {
      success: true,
      message: data.message || 'Prodotto rimosso dalla wishlist'
    };
  } catch (error) {
    console.error('Errore nella rimozione dalla wishlist:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Errore nella rimozione dalla wishlist'
    };
  }
}

/**
 * Verifica se un prodotto è nella wishlist
 * @param {number} productId - ID del prodotto da verificare
 * @returns {Promise<boolean>} - true se il prodotto è nella wishlist, false altrimenti
 */
export async function isInWishlist(productId: number): Promise<boolean> {
  try {
    const token = localStorage.getItem('woocommerce_token');
    
    if (!token) {
      return false;
    }
    
    const response = await fetch('/api/wishlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'check',
        productId
      })
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.in_wishlist === true;
  } catch (error) {
    console.error('Errore nella verifica della wishlist:', error);
    return false;
  }
}
