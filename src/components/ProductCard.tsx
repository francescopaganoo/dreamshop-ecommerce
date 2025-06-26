"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Product } from '../lib/api';
import { useCart } from '../context/CartContext';
import { useState, useEffect } from 'react';
import WishlistButton from './WishlistButton';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState('');
  const [prefetched, setPrefetched] = useState(false);
  
  // Get the product image or use a placeholder
  const imageUrl = product.images && product.images.length > 0
    ? product.images[0].src
    : 'https://via.placeholder.com/300';
  
  // Format price with currency symbol
  const formatPrice = (price: string | null | undefined) => {
    if (!price) return null;
    const parsedPrice = parseFloat(price);
    return isNaN(parsedPrice) ? null : `€${parsedPrice.toFixed(2)}`;
  };
  
  // Verifica se il prodotto è variabile
  const isVariable = product.type === 'variable';
  
  // Nascondi il messaggio dopo 3 secondi
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showMessage) {
      timer = setTimeout(() => {
        setShowMessage(false);
      }, 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showMessage]);
  
  // Prefetch della pagina prodotto quando il componente è visibile
  useEffect(() => {
    // Implementiamo l'Intersection Observer per prefetch solo quando la card è visibile
    if (!prefetched && typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting && !prefetched) {
              // Prefetch solo se non siamo già nella pagina del prodotto
              if (!pathname.includes(`/product/${product.slug}`)) {
                // Invece di usare un prefetch che potrebbe causare il caricamento delle variazioni,
                // memorizziamo solo l'intenzione di navigare a questa pagina
                setPrefetched(true);
                
                // Non facciamo più il prefetch automatico per evitare il caricamento delle variazioni
                // nella home page
                console.log(`Product card visible: ${product.slug}`);
              }
            }
          });
        },
        { threshold: 0.1 } // Attiva quando almeno il 10% della card è visibile
      );
      
      // Trova l'elemento DOM corrente
      const currentElement = document.getElementById(`product-card-${product.id}`);
      if (currentElement) {
        observer.observe(currentElement);
        
        return () => {
          observer.disconnect();
        };
      }
    }
  }, [product.slug, product.id, pathname, prefetched]);

  // Gestisce l'aggiunta al carrello
  const handleAddToCart = () => {
    if (isAddingToCart) return;
    
    setIsAddingToCart(true);
    
    try {
      // Utilizziamo il risultato restituito dalla funzione addToCart
      const result = addToCart(product, 1);
      
      if (result.success) {
        setMessage(`${product.name} aggiunto al carrello!`);
      } else {
        // Mostriamo il messaggio di errore restituito dalla funzione addToCart
        setMessage(result.message || 'Errore durante l\'aggiunta al carrello');
      }
      
      setShowMessage(true);
    } catch (error) {
      console.error('Errore durante l\'aggiunta al carrello:', error);
      setMessage('Si è verificato un errore durante l\'aggiunta al carrello');
      setShowMessage(true);
    }
    
    setTimeout(() => {
      setIsAddingToCart(false);
    }, 300);
  };
  
  // Gestisce il click sul pulsante
  const handleButtonClick = () => {
    if (isVariable) {
      router.push(`/product/${product.slug}`);
    } else {
      handleAddToCart();
    }
  };

  return (
    <div id={`product-card-${product.id}`} className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:translate-y-[-5px] border border-gray-100 flex flex-col h-full relative">
      {/* Messaggio di conferma */}
      {showMessage && (
        <div className="absolute top-2 left-2 right-2 z-50 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">{message}</span>
            </div>
            <button onClick={() => setShowMessage(false)} className="text-green-700 hover:text-green-900">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {/* Pulsante wishlist posizionato fuori dal Link per evitare la propagazione del click */}
      <div className="absolute top-2 left-2 z-10">
        <WishlistButton productId={product.id} />
      </div>
      
      <Link href={`/product/${product.slug}`}>
        <div className="relative h-52 w-full p-4 bg-white">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              style={{ objectFit: 'contain' }}
            />
          </div>
          {product.sale_price && (
            <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              Offerta
            </div>
          )}
        </div>
      </Link>
      
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex-grow">
          <Link href={`/product/${product.slug}`} className="block">
            <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2 hover:text-bred-500">{product.name}</h3>
          </Link>
          
          <div className="flex items-center mb-4">
            {product.sale_price ? (
              <div className="flex items-center space-x-2">
                {formatPrice(product.sale_price) && (
                  <span className="text-xl font-bold text-red-600">
                    {formatPrice(product.sale_price)}
                  </span>
                )}
                {formatPrice(product.regular_price) && (
                  <span className="text-sm line-through text-gray-500">
                    {formatPrice(product.regular_price)}
                  </span>
                )}
              </div>
            ) : (
              formatPrice(product.price || product.regular_price) && (
                <span className="text-xl font-bold text-gray-900">
                  {formatPrice(product.price || product.regular_price)}
                </span>
              )
            )}
          </div>
        </div>
        
        <button
          onClick={handleButtonClick}
          disabled={isAddingToCart}
          className={`w-full py-3 rounded-lg font-medium flex items-center justify-center mt-auto ${
            isVariable 
              ? 'bg-bred-500 hover:bg-bred-700 text-white' 
              : isAddingToCart
                ? 'bg-bred-500 text-white cursor-not-allowed'
                : 'bg-bred-500 hover:bg-bred-700 text-white'
          }`}
        >
          {isVariable ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Seleziona Opzioni
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
              Aggiungi al Carrello
            </>
          )}
        </button>
      </div>
    </div>
  );
}
