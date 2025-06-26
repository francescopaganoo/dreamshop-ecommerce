'use client';

import { useState, useEffect } from 'react';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';

interface WishlistButtonProps {
  productId: number;
  className?: string;
}

export default function WishlistButton({ productId, className = '' }: WishlistButtonProps) {
  const { isAuthenticated } = useAuth();
  const { addItem, removeItem, isItemInWishlist } = useWishlist();
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const router = useRouter();

  // Controlla se il prodotto è nella wishlist
  useEffect(() => {
    if (isAuthenticated) {
      setIsInWishlist(isItemInWishlist(productId));
    }
  }, [productId, isItemInWishlist, isAuthenticated]);

  // Gestisce il click sul pulsante
  const handleWishlistClick = async () => {
    if (!isAuthenticated) {
      // Reindirizza alla pagina di login se l'utente non è autenticato
      router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    setIsProcessing(true);
    
    try {
      if (isInWishlist) {
        // Rimuovi dalla wishlist
        const result = await removeItem(productId);
        if (result.success) {
          setIsInWishlist(false);
          setMessage('Prodotto rimosso dalla wishlist');
        } else {
          setMessage(result.message || 'Errore nella rimozione dalla wishlist');
        }
      } else {
        // Aggiungi alla wishlist
        const result = await addItem(productId);
        if (result.success) {
          setIsInWishlist(true);
          setMessage('Prodotto aggiunto alla wishlist');
        } else {
          setMessage(result.message || 'Errore nell\'aggiunta alla wishlist');
        }
      }
      
      // Mostra il messaggio
      setShowMessage(true);
      
      // Nascondi il messaggio dopo 3 secondi
      setTimeout(() => {
        setShowMessage(false);
      }, 3000);
      
    } catch (error) {
      console.error('Errore nell\'operazione wishlist:', error);
      setMessage('Si è verificato un errore');
      setShowMessage(true);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleWishlistClick}
        disabled={isProcessing}
        className={`flex items-center justify-center ${className}`}
        aria-label={isInWishlist ? 'Rimuovi dalla wishlist' : 'Aggiungi alla wishlist'}
      >
        {isInWishlist ? (
          <svg className="w-6 h-6 text-bred-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-gray-500 hover:text-bred-500" stroke="currentColor" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        )}
      </button>
      
      {/* Messaggio di feedback */}
      {showMessage && (
        <div className="fixed transform -translate-x-1/2 left-1/2 bottom-4 bg-white shadow-lg rounded-md p-3 z-50 min-w-48 text-sm text-gray-600 border border-gray-200">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
