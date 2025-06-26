'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { getWishlist, addToWishlist, removeFromWishlist, isInWishlist, WishlistItem } from '../lib/wishlist';
import { useAuth } from './AuthContext';

// Definizione dell'interfaccia del contesto wishlist
interface WishlistContextType {
  wishlistItems: WishlistItem[];
  isLoading: boolean;
  addItem: (productId: number) => Promise<{success: boolean, message: string}>;
  removeItem: (productId: number) => Promise<{success: boolean, message: string}>;
  isItemInWishlist: (productId: number) => boolean;
  refreshWishlist: () => Promise<void>;
}

// Creazione del contesto
const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

// Provider del contesto
export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAuth();
  const isInitialMount = useRef(true);
  const isLoadingRef = useRef(false);

  // Funzione per caricare la wishlist
  const loadWishlist = useCallback(async () => {
    // Previene chiamate multiple simultanee
    if (isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setIsLoading(true);
    
    try {
      const items = await getWishlist();
      setWishlistItems(items);
    } catch (error) {
      console.error('Errore nel caricamento della wishlist:', error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, []);
  
  // Carica la wishlist solo quando l'utente è autenticato e al primo mount
  useEffect(() => {
    // Se è il primo mount e l'utente è autenticato, carica la wishlist
    if (isInitialMount.current && isAuthenticated) {
      loadWishlist();
      isInitialMount.current = false;
    } else if (!isAuthenticated) {
      // Se l'utente non è autenticato, resetta lo stato
      setWishlistItems([]);
      isInitialMount.current = true;
    }
  }, [isAuthenticated, loadWishlist]);

  // Funzione per aggiungere un prodotto alla wishlist
  const addItem = async (productId: number) => {
    try {
      const result = await addToWishlist(productId);
      
      if (result.success && !result.already_exists) {
        // Ricarica la wishlist per ottenere i dati aggiornati
        await loadWishlist();
      }
      
      return result;
    } catch (error) {
      console.error('Errore nell\'aggiunta alla wishlist:', error);
      return {
        success: false,
        message: 'Errore nell\'aggiunta alla wishlist'
      };
    }
  };

  // Funzione per rimuovere un prodotto dalla wishlist
  const removeItem = async (productId: number) => {
    try {
      const result = await removeFromWishlist(productId);
      
      if (result.success) {
        // Aggiorna lo stato locale rimuovendo l'elemento
        setWishlistItems(prevItems => prevItems.filter(item => item.id !== productId));
      }
      
      return result;
    } catch (error) {
      console.error('Errore nella rimozione dalla wishlist:', error);
      return {
        success: false,
        message: 'Errore nella rimozione dalla wishlist'
      };
    }
  };

  // Funzione per verificare se un prodotto è nella wishlist
  const isItemInWishlist = (productId: number): boolean => {
    return wishlistItems.some(item => item.id === productId);
  };

  // Funzione per aggiornare la wishlist
  const refreshWishlist = useCallback(async () => {
    // Previene chiamate multiple simultanee
    if (isLoadingRef.current) return;
    await loadWishlist();
  }, [loadWishlist]);

  return (
    <WishlistContext.Provider value={{
      wishlistItems,
      isLoading,
      addItem,
      removeItem,
      isItemInWishlist,
      refreshWishlist
    }}>
      {children}
    </WishlistContext.Provider>
  );
}

// Hook personalizzato per utilizzare il contesto wishlist
export function useWishlist() {
  const context = useContext(WishlistContext);
  
  if (context === undefined) {
    throw new Error('useWishlist deve essere utilizzato all\'interno di un WishlistProvider');
  }
  
  return context;
}
