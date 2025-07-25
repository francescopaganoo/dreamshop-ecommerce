"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Product } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { useState, useEffect } from 'react';
import WishlistButton from '@/components/WishlistButton';
import { motion } from 'framer-motion';
import { FaShoppingCart, FaCreditCard, FaRegEye } from 'react-icons/fa';

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
    <motion.div 
      id={`product-card-${product.id}`} 
      className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col h-full relative group border border-gray-100"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -5, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.03)' }}
    >
      {/* Messaggio di conferma */}
      {showMessage && (
        <motion.div 
          className="absolute top-3 left-3 right-3 z-50 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl shadow-lg"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">{message}</span>
            </div>
            <button onClick={() => setShowMessage(false)} className="text-green-600 hover:text-green-800 focus:outline-none">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
      
      {/* Wishlist Button - migliorata con effetto di fade-in */}
      <div className="absolute top-3 left-3 z-10 opacity-80 group-hover:opacity-100 transition-opacity">
        <WishlistButton productId={product.id} />
      </div>
      
      {/* Badge offerta riposizionato e migliorato */}
      {product.sale_price && (
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm transform group-hover:scale-110 transition-transform">
            Offerta
          </div>
        </div>
      )}
      
      {/* Badge acconto se disponibile - migliorato */}
      <div className="absolute bottom-32 right-3 z-10">
        <div className="bg-bred-500/20 text-bred-600 text-xs font-medium px-3 py-1 rounded-full flex items-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm backdrop-blur-sm">
          <FaCreditCard className="mr-1" size={10} />
          <span>Acconto 40%</span>
        </div>
      </div>
      
      {/* Quick view button che appare in hover - con overlay più leggero */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 pointer-events-none">
        <Link 
          href={`/product/${product.slug}`}
          className="bg-white/90 backdrop-blur-sm text-gray-800 hover:bg-bred-500 hover:text-white px-4 py-2 rounded-full flex items-center transition-colors duration-200 pointer-events-auto shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <FaRegEye className="mr-2" />
          Anteprima
        </Link>
      </div>
      
      {/* Immagine prodotto con hover effect migliorato */}
      <Link href={`/product/${product.slug}`} className="block overflow-hidden">
        <div className="relative h-60 w-full bg-gradient-to-b from-gray-50 to-white">
          <div className="absolute inset-0 flex items-center justify-center p-6 group-hover:p-4 transition-all duration-300">
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              style={{ 
                objectFit: 'contain',
                transition: 'all 0.6s ease-in-out'
              }}
              className="group-hover:scale-110 transition-transform duration-500 group-hover:brightness-105"
            />
          </div>
        </div>
      </Link>
      
      {/* Contenuto testuale e CTA */}
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex-grow">
          <Link href={`/product/${product.slug}`} className="block group">
            <h3 className="text-lg font-medium text-gray-800 mb-2 line-clamp-2 group-hover:text-bred-500 transition-colors">{product.name}</h3>
          </Link>
          
          {/* Prezzi con badge */}
          <div className="flex items-center mb-4">
            {product.sale_price ? (
              <div className="flex items-center space-x-3">
                {formatPrice(product.sale_price) && (
                  <span className="text-xl font-bold text-red-600">
                    {formatPrice(product.sale_price)}
                  </span>
                )}
                {formatPrice(product.regular_price) && (
                  <span className="text-sm line-through text-gray-400">
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
        
        {/* Button migliorato con feedback visivo */}
        <motion.button
          onClick={handleButtonClick}
          disabled={isAddingToCart}
          className={`w-full py-3 rounded-lg font-medium flex items-center justify-center mt-auto transition-all duration-300 ${
            isVariable 
              ? 'bg-gray-50 border border-bred-500 text-bred-500 hover:bg-bred-500 hover:text-white' 
              : isAddingToCart
                ? 'bg-bred-500 text-white cursor-not-allowed'
                : 'bg-bred-500 hover:bg-bred-600 text-white'
          }`}
          whileTap={{ scale: 0.97 }}
        >
          {isVariable ? (
            <>
              <FaRegEye className="mr-2" />
              Seleziona Opzioni
            </>
          ) : (
            <>
              <FaShoppingCart className="mr-2" />
              Aggiungi al Carrello
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
