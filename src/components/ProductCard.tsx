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
  priority?: boolean;
}

export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const { addToCart } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState('');
  const [prefetched, setPrefetched] = useState(false);
  const [hasInstallments, setHasInstallments] = useState(false);
  const [installmentsChecked, setInstallmentsChecked] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>('');
  const [imageChecked, setImageChecked] = useState(false);

  // Ottieni URL immagine originale (rimuovi dimensioni se presenti)
  const getOriginalImageUrl = (url: string) => {
    if (!url) return '';

    // Se l'URL ha già una dimensione tipo -800x800, rimuovila per ottenere l'originale
    return url.replace(/-\d+x\d+(\.[a-zA-Z]{3,4})$/, '$1');
  };

  // Imposta l'immagine all'inizializzazione
  useEffect(() => {
    if (!product.images?.[0]?.src || imageChecked) return;

    const originalUrl = getOriginalImageUrl(product.images[0].src);
    setCurrentImageUrl(originalUrl);
    setImageChecked(true);
  }, [product.images, imageChecked]);

  // Controlla se il prodotto è in pre-order basandosi sull'attributo pa_disponibilita
  const getAttribute = (name: string): { name: string; slug: string } | undefined => {
    if (!product.attributes) return undefined;

    const attr = product.attributes.find(attr => {
      // Check if it's a PluginProductAttribute (has slug property)
      if ('slug' in attr) {
        return attr.name === name || attr.slug === name;
      }
      // Otherwise it's a ProductAttribute (no slug property)
      return attr.name === name;
    });

    if (!attr) return undefined;

    // Return the first option, handling both attribute types
    if (Array.isArray(attr.options) && attr.options.length > 0) {
      const firstOption = attr.options[0];

      // PluginProductAttribute - options are objects
      if (typeof firstOption === 'object' && firstOption !== null && 'name' in firstOption) {
        return firstOption as { name: string; slug: string };
      }

      // ProductAttribute - options are strings
      if (typeof firstOption === 'string') {
        return { name: firstOption, slug: firstOption.toLowerCase().replace(/\s+/g, '-') };
      }
    }

    return undefined;
  };

  const disponibilita = getAttribute('pa_disponibilita');
  const isPreOrder = disponibilita?.name?.toLowerCase().includes('pre-order') ||
                     disponibilita?.slug?.toLowerCase().includes('pre-order') ||
                     disponibilita?.name?.toLowerCase().includes('preorder') ||
                     disponibilita?.slug?.toLowerCase().includes('preorder');

  // Controlla asincronamente se il prodotto ha pagamenti a rate disponibili
  useEffect(() => {
    const checkInstallments = () => {
      if (installmentsChecked) return;

      // Usa il campo has_deposit_option se disponibile (dal plugin)
      if (product.has_deposit_option !== undefined) {
        setHasInstallments(product.has_deposit_option);
        setInstallmentsChecked(true);
        return;
      }

      // Fallback: controlla i metadati esistenti
      const hasMetadataInstallments = () => {
        if (product._wc_convert_to_deposit === 'yes' ||
            product.wc_deposit_option === 'yes') {
          return true;
        }

        if (product.meta_data && Array.isArray(product.meta_data)) {
          const depositMeta = product.meta_data.find(meta =>
            (meta.key === '_wc_convert_to_deposit' && meta.value === 'yes') ||
            (meta.key === '_wc_deposit_enabled' && meta.value === 'yes') ||
            (meta.key === '_wc_deposit_type' && meta.value === 'plan') ||
            (meta.key === '_wc_deposit_type' && meta.value === 'percent') ||
            (meta.key === '_wc_deposit_type' && meta.value === 'fixed')
          );
          return !!depositMeta;
        }

        return false;
      };

      setHasInstallments(hasMetadataInstallments());
      setInstallmentsChecked(true);
    };

    checkInstallments();
  }, [product.id, product.has_deposit_option, product._wc_convert_to_deposit, product.wc_deposit_option, product.meta_data, installmentsChecked]);

  
  // Format price with currency symbol
  const formatPrice = (price: string | null | undefined) => {
    if (!price) return null;
    const parsedPrice = parseFloat(price);
    return isNaN(parsedPrice) ? null : `€${parsedPrice.toFixed(2)}`;
  };
  
  // Verifica se il prodotto è variabile
  const isGiftCard = product.name.toLowerCase().includes('gift card') ||
                     product.name.toLowerCase().includes('gift-card') ||
                     product.slug.toLowerCase().includes('gift-card');

  const isVariable = product.type === 'variable' ||
                     (product.variations && product.variations.length > 0) ||
                     (product.attributes && product.attributes.some(attr => attr.variation)) ||
                     isGiftCard;

  
  // Verifica se il prodotto è disponibile
  const hasValidPrice = product.price && parseFloat(product.price) > 0;

  // Per prodotti variabili, se stock_status è 'outofstock', nessuna variazione è disponibile
  const isVariableOutOfStock = isVariable && product.stock_status === 'outofstock';

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
    // Non permettere il click se il prodotto variabile è completamente out of stock
    if (isVariableOutOfStock) {
      return;
    }

    if (isVariable) {
      router.push(`/prodotto/${product.slug}`);
    } else if (isInStock) {
      handleAddToCart();
    }
  };

  return (
    <motion.div 
      id={`product-card-${product.id}`} 
      className="md:bg-white md:rounded-3xl md:shadow-sm flex flex-col h-full relative md:border md:border-gray-100 p-2 md:p-5"
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
      <Link href={`/prodotto/${product.slug}`} className="block mb-2 md:mb-5">
        <div className="relative h-40 md:h-52 w-full transition-all duration-300">
          {currentImageUrl && (
            <Image
              src={currentImageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              style={{ objectFit: 'contain' }}
              className="transition-transform duration-300 hover:scale-105"
              priority={priority}
            />
          )}
        </div>
      </Link>
      
      {/* Contenuto testuale minimalista */}
      <div className="flex flex-col flex-grow space-y-1 md:space-y-3">
        <Link href={`/prodotto/${product.slug}`} className="block">
          <h3 className="text-sm md:text-xl font-medium text-gray-900 line-clamp-2 md:line-clamp-1">{product.name}</h3>
        </Link>
        
        
        {/* Prezzo semplificato */}
        <div>
          {product.sale_price ? (
            <div className="flex items-center space-x-2">
              {formatPrice(product.sale_price) && (
                <span className="text-base md:text-xl font-medium text-gray-900">
                  {formatPrice(product.sale_price)}
                </span>
              )}
              {formatPrice(product.regular_price) && (
                <span className="text-xs md:text-sm line-through text-gray-400">
                  {formatPrice(product.regular_price)}
                </span>
              )}
            </div>
          ) : (
            formatPrice(product.price || product.regular_price) && (
              <span className="text-base md:text-xl font-medium text-gray-900">
                {formatPrice(product.price || product.regular_price)}
              </span>
            )
          )}

          {/* Indicazione pagamento a rate */}
          {hasInstallments && (
            <div className="mt-1">
              <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-md">
                Pagamento a rate disponibile
              </span>
            </div>
          )}

          {/* Sale Countdown Compact - Solo per prodotti in offerta con data di fine */}
          {/*{product.sale_price && product.date_on_sale_to && (
            <div className="mt-2">
              <SaleCountdownCompact saleEndDate={product.date_on_sale_to} />
            </div>
          )}*/}
        </div>
        
        {/* Spazio extra tra prezzo e pulsante - ridotto su mobile */}
        <div className="pt-1 md:pt-2"></div>
        
        {/* Spazio vuoto per pushare il pulsante in basso */}
        <div className="flex-grow"></div>
        
        {/* Button con colore originale e cursor-pointer - più compatto su mobile */}
        <motion.button
          onClick={handleButtonClick}
          disabled={isAddingToCart || (!isVariable && !isInStock) || isVariableOutOfStock}
          className={`w-full py-2 md:py-2.5 rounded-md text-xs md:text-base font-medium flex items-center justify-center transition-colors ${
            (!isVariable && !isInStock) || isVariableOutOfStock
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : isVariable
                ? 'bg-white border border-bred-500 text-bred-500 hover:bg-bred-500 hover:text-white cursor-pointer'
                : 'bg-bred-500 hover:bg-bred-600 text-white cursor-pointer'
          }`}
          whileTap={(!isVariable && !isInStock) || isVariableOutOfStock ? {} : { scale: 0.98 }}
        >
          <FaPlus className="mr-1 md:mr-2" size={10} />
          <span className="hidden md:inline">
            {isVariableOutOfStock
              ? "Non disponibile"
              : isVariable
                ? "Visualizza Prodotto"
                : !isInStock
                  ? "Non disponibile"
                  : isPreOrder
                    ? "Pre-ordina ora"
                    : "Aggiungi al Carrello"
            }
          </span>
          <span className="md:hidden">
            {isVariableOutOfStock
              ? "N/A"
              : isVariable
                ? "Visualizza"
                : !isInStock
                  ? "N/A"
                  : isPreOrder
                    ? "Pre-ordina"
                    : "Carrello"
            }
          </span>
        </motion.button>
        
        {/* Wishlist Button riposizionato - più piccolo su mobile */}
        <div className="absolute top-2 right-2 md:top-5 md:right-5">
          <WishlistButton productId={product.id} />
        </div>
        
        {/* Badge offerta - verde per indicare risparmio */}
        {product.sale_price && product.regular_price && parseFloat(product.sale_price) < parseFloat(product.regular_price) && (
          <div className="absolute top-2 left-2 md:top-5 md:left-5 z-10">
            <div className="bg-green-500 text-white text-xs font-bold px-2 py-1 md:px-3 md:py-1 rounded-full shadow-lg">
              -{Math.ceil(((parseFloat(product.regular_price) - parseFloat(product.sale_price)) / parseFloat(product.regular_price)) * 100)}%
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}