"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Product } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { useState, useEffect } from 'react';
import WishlistButton from '@/components/WishlistButton';
import { motion } from 'framer-motion';
import { FaPlus } from 'react-icons/fa';

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
  
  // Controlla se il prodotto è in pre-order basandosi sull'attributo Disponibilità
  const getAttribute = (name: string) => {
    return product.attributes?.find(attr => attr.name === name)?.options?.[0];
  };
  
  const disponibilita = getAttribute('Disponibilità');
  const isPreOrder = disponibilita?.toLowerCase().includes('pre-order') || disponibilita?.toLowerCase().includes('preorder');
  
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
  
  // Verifica se il prodotto è disponibile
  const hasValidPrice = product.price && parseFloat(product.price) > 0;
  const isInStock = product.stock_status === 'instock' && hasValidPrice;
  
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
              if (!pathname.includes(`/prodotto/${product.slug}`)) {
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
      router.push(`/prodotto/${product.slug}`);
    } else if (isInStock) {
      handleAddToCart();
    }
  };

  return (
    <motion.div 
      id={`product-card-${product.id}`} 
      className="bg-white rounded-3xl shadow-sm flex flex-col h-full relative border border-gray-100 p-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}
    >
      {/* Messaggio di conferma - semplificato e meno invasivo */}
      {showMessage && (
        <motion.div 
          className="absolute top-2 left-2 right-2 z-50 bg-green-50 text-green-800 px-3 py-2 rounded-xl"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{message}</span>
            <button onClick={() => setShowMessage(false)} className="text-green-600 hover:text-green-800 focus:outline-none">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
      
      {/* Immagine prodotto semplificata - stile minimalista */}
      <Link href={`/prodotto/${product.slug}`} className="block mb-5">
        <div className="relative h-52 w-full transition-all duration-300">
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            style={{ objectFit: 'contain' }}
            className="transition-transform duration-300 hover:scale-105"
          />
        </div>
      </Link>
      
      {/* Contenuto testuale minimalista */}
      <div className="flex flex-col flex-grow space-y-3">
        <Link href={`/prodotto/${product.slug}`} className="block">
          <h3 className="text-xl font-medium text-gray-900 line-clamp-1">{product.name}</h3>
        </Link>
        
        
        {/* Prezzo semplificato */}
        <div>
          {product.sale_price ? (
            <div className="flex items-center space-x-2">
              {formatPrice(product.sale_price) && (
                <span className="text-xl font-medium text-gray-900">
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
              <span className="text-xl font-medium text-gray-900">
                {formatPrice(product.price || product.regular_price)}
              </span>
            )
          )}
          
          {/* Sale Countdown Compact - Solo per prodotti in offerta con data di fine */}
          {/*{product.sale_price && product.date_on_sale_to && (
            <div className="mt-2">
              <SaleCountdownCompact saleEndDate={product.date_on_sale_to} />
            </div>
          )}*/}
        </div>
        
        {/* Spazio extra tra prezzo e pulsante */}
        <div className="pt-2"></div>
        
        {/* Spazio vuoto per pushare il pulsante in basso */}
        <div className="flex-grow"></div>
        
        {/* Button con colore originale e cursor-pointer */}
        <motion.button
          onClick={handleButtonClick}
          disabled={isAddingToCart || (!isVariable && !isInStock)}
          className={`w-full py-2.5 rounded-md font-medium flex items-center justify-center transition-colors ${
            !isVariable && !isInStock
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : isVariable 
                ? 'bg-white border border-bred-500 text-bred-500 hover:bg-bred-500 hover:text-white cursor-pointer' 
                : 'bg-bred-500 hover:bg-bred-600 text-white cursor-pointer'
          }`}
          whileTap={!isVariable && !isInStock ? {} : { scale: 0.98 }}
        >
          <FaPlus className="mr-2" size={12} />
          {isVariable 
            ? "Seleziona Opzioni" 
            : !isInStock
              ? "Non disponibile"
              : isPreOrder
                ? "Pre-ordina ora"
                : "Aggiungi al Carrello"
          }
        </motion.button>
        
        {/* Wishlist Button riposizionato */}
        <div className="absolute top-5 right-5">
          <WishlistButton productId={product.id} />
        </div>
        
        {/* Badge offerta - se necessario */}
        {product.sale_price && (
          <div className="absolute top-5 left-5">
            <div className="bg-green-500 text-white text-xs font-medium px-2 py-1 rounded-md">
              {product.regular_price && product.sale_price 
                ? `Offerta -${Math.ceil(((parseFloat(product.regular_price) - parseFloat(product.sale_price)) / parseFloat(product.regular_price)) * 100)}%`
                : 'Offerta'}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}