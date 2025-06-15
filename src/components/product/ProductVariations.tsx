'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ProductVariation, ProductAttribute, Product } from '../../lib/api';
import { useCart, CartItem } from '../../context/CartContext';

interface ProductVariationsProps {
  productId: number;
  attributes: ProductAttribute[];
  variations: ProductVariation[];
  defaultAttributes?: Array<{
    id: number;
    name: string;
    option: string;
  }>;
  productName: string;
}

export default function ProductVariations({ 
  productId, 
  attributes, 
  variations, 
  defaultAttributes,
  productName 
}: ProductVariationsProps) {
  // Stati essenziali
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [availableOptions, setAvailableOptions] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [showMessage, setShowMessage] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [variationsLoaded, setVariationsLoaded] = useState<boolean>(false);
  const [isAddingToCart, setIsAddingToCart] = useState<boolean>(false);
  const { addToCart } = useCart();
  
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

  // Estrai le opzioni di attributi disponibili dalle variazioni
  useEffect(() => {
    if (variations.length > 0 && attributes.length > 0) {
      const options: Record<string, Set<string>> = {};
      
      // Inizializza i set per ogni attributo
      attributes.forEach(attr => {
        if (attr.variation) {
          options[attr.name.toLowerCase()] = new Set<string>();
        }
      });
      
      // Aggiungi le opzioni dalle variazioni
      variations.forEach(variation => {
        if (variation.attributes && variation.attributes.length > 0) {
          variation.attributes.forEach(attr => {
            const attrName = attr.name.toLowerCase();
            if (options[attrName]) {
              options[attrName].add(attr.option);
            }
          });
        }
      });
      
      // Converti i Set in array
      const availableOptionsRecord: Record<string, string[]> = {};
      Object.entries(options).forEach(([key, valueSet]) => {
        availableOptionsRecord[key] = Array.from(valueSet);
      });
      
      setAvailableOptions(availableOptionsRecord);
      setVariationsLoaded(true);
    } else {
      setVariationsLoaded(true);
    }
  }, [variations, attributes]);
  
  // Inizializza gli attributi selezionati con i valori predefiniti
  useEffect(() => {
    if (defaultAttributes && defaultAttributes.length > 0 && Object.keys(availableOptions).length > 0) {
      const defaults: Record<string, string> = {};
      defaultAttributes.forEach(attr => {
        const attrName = attr.name.toLowerCase();
        if (availableOptions[attrName] && availableOptions[attrName].includes(attr.option)) {
          defaults[attrName] = attr.option;
        } else if (availableOptions[attrName] && availableOptions[attrName].length > 0) {
          defaults[attrName] = availableOptions[attrName][0];
        }
      });
      setSelectedAttributes(defaults);
    }
  }, [defaultAttributes, availableOptions]);
  
  // Aggiorna la variazione selezionata quando cambiano gli attributi selezionati
  useEffect(() => {
    if (Object.keys(selectedAttributes).length === 0 || variations.length === 0) {
      setSelectedVariation(null);
      return;
    }
    
    const exactMatchingVariation = variations.find(variation => {
      if (!variation.attributes || variation.attributes.length === 0) {
        return false;
      }
      
      const variationAttrs = variation.attributes.reduce((acc, attr) => {
        acc[attr.name.toLowerCase()] = attr.option;
        return acc;
      }, {} as Record<string, string>);
      
      for (const [attrName, attrValue] of Object.entries(selectedAttributes)) {
        if (variationAttrs[attrName] !== attrValue) {
          return false;
        }
      }
      
      return true;
    });
    
    setSelectedVariation(exactMatchingVariation || null);
  }, [selectedAttributes, variations, availableOptions]);
  
  // Gestisce la selezione di un attributo
  const handleAttributeSelect = (attributeName: string, option: string) => {
    setSelectedAttributes(prev => {
      const attrName = attributeName.toLowerCase();
      if (prev[attrName] === option) return prev;
      
      return {
        ...prev,
        [attrName]: option
      };
    });
  };
  
  // Gestisce la selezione di un'immagine di variazione
  const handleImageSelect = (variation: ProductVariation) => {
    setSelectedVariation(variation);
    
    if (variation.attributes && variation.attributes.length > 0) {
      const attrs: Record<string, string> = {};
      variation.attributes.forEach(attr => {
        attrs[attr.name.toLowerCase()] = attr.option;
      });
      setSelectedAttributes(attrs);
    }
  };
  
  // Gestisce l'aggiunta al carrello di una variazione di prodotto
  const handleAddToCart = () => {
    if (!selectedVariation) {
      setMessage('Seleziona una variazione prima di aggiungere al carrello');
      setShowMessage(true);
      return;
    }
    
    if (isAddingToCart) return;
    
    // Controllo preliminare della quantità disponibile
    if (selectedVariation.manage_stock && typeof selectedVariation.stock_quantity === 'number' && 
        quantity > selectedVariation.stock_quantity) {
      setMessage(`Disponibilità insufficiente. Massimo disponibile: ${selectedVariation.stock_quantity} pezzi`);
      setShowMessage(true);
      return;
    }
    
    setIsAddingToCart(true);
    
    try {
      const variationDetails = selectedVariation.attributes
        ?.map(attr => `${attr.name}: ${attr.option}`)
        .join(', ') || `Variazione #${selectedVariation.id}`;
      
      const productWithVariation: Product = {
        id: productId,
        name: `${productName} - ${variationDetails}`,
        price: selectedVariation.price,
        regular_price: selectedVariation.regular_price,
        sale_price: selectedVariation.sale_price,
        description: '',
        short_description: '',
        permalink: '',
        slug: '',
        type: 'variation',
        stock_status: selectedVariation.stock_status,
        stock_quantity: selectedVariation.stock_quantity,
        manage_stock: selectedVariation.manage_stock,
        images: selectedVariation.image ? [{ id: 0, src: selectedVariation.image.src, alt: '' }] : [],
        categories: []
      };
      
      const formattedAttributes = selectedVariation.attributes?.map(attr => ({
        id: attr.id,
        name: attr.name,
        option: attr.option
      })) || [];
      
      const cartItem: CartItem = {
        product: productWithVariation,
        quantity: quantity,
        variation_id: selectedVariation.id,
        attributes: formattedAttributes
      };
      
      // Utilizziamo il risultato restituito dalla funzione addToCart
      const result = addToCart(cartItem);
      
      if (result.success) {
        setMessage(`${quantity} ${quantity > 1 ? 'pezzi' : 'pezzo'} di ${productWithVariation.name} ${quantity > 1 ? 'aggiunti' : 'aggiunto'} al carrello!`);
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
  
  // Gestisce l'incremento della quantità
  const handleIncreaseQuantity = () => {
    if (selectedVariation?.manage_stock && typeof selectedVariation.stock_quantity === 'number') {
      if (quantity < selectedVariation.stock_quantity) {
        setQuantity(prev => prev + 1);
      } else {
        setMessage(`Disponibilità massima: ${selectedVariation.stock_quantity} pezzi`);
        setShowMessage(true);
      }
    } else {
      setQuantity(prev => prev + 1);
    }
  };
  
  // Gestisce il decremento della quantità
  const handleDecreaseQuantity = () => {
    setQuantity(prev => (prev > 1 ? prev - 1 : 1));
  };
  
  // Gestisce il cambio diretto della quantità
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    
    if (!isNaN(value) && value > 0) {
      if (selectedVariation?.manage_stock && typeof selectedVariation.stock_quantity === 'number') {
        if (value <= selectedVariation.stock_quantity) {
          setQuantity(value);
        } else {
          setQuantity(selectedVariation.stock_quantity);
          setMessage(`Disponibilità massima: ${selectedVariation.stock_quantity} pezzi`);
          setShowMessage(true);
        }
      } else {
        setQuantity(value);
      }
    } else if (e.target.value === '') {
      setQuantity(1);
    }
  };
  
  // Formatta il prezzo con il simbolo della valuta
  const formatPrice = (price: string | undefined) => {
    if (!price || isNaN(parseFloat(price))) {
      return 'Prezzo non disponibile';
    }
    return `€${parseFloat(price).toFixed(2)}`;
  };
  
  // Verifica se il prodotto è in vendita
  const isOnSale = selectedVariation?.sale_price && selectedVariation.sale_price !== '';
  
  // Verifica se la variazione ha un prezzo valido
  const hasValidPrice = selectedVariation && 
    ((selectedVariation.price && !isNaN(parseFloat(selectedVariation.price)) && parseFloat(selectedVariation.price) > 0) || 
     (selectedVariation.regular_price && !isNaN(parseFloat(selectedVariation.regular_price)) && parseFloat(selectedVariation.regular_price) > 0));
  
  return (
    <div className="relative">
      {/* Messaggio di conferma */}
      {showMessage && (
        <div className="absolute top-0 left-0 right-0 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-md z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{message}</span>
            </div>
            <button onClick={() => setShowMessage(false)} className="text-green-700 hover:text-green-900">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Indicatore di caricamento */}
      {!variationsLoaded && (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Caricamento variazioni...</p>
        </div>
      )}
      
      {/* Attributi del prodotto */}
      {variationsLoaded && attributes.filter(attr => attr.variation).map(attr => {
        const attrName = attr.name.toLowerCase();
        const options = availableOptions[attrName] || [];
        
        if (options.length === 0) return null;
        
        return (
          <div key={attr.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {attr.name}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {options.map(option => (
                <button 
                  key={option}
                  type="button"
                  className={`w-full border rounded-md p-4 text-center text-gray-900 ${
                    selectedAttributes[attrName] === option
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                  onClick={() => handleAttributeSelect(attr.name, option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      
      {/* Galleria delle variazioni con immagini */}
      {variationsLoaded && variations.filter(v => v.image).length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-900">Immagini varianti</h3>
          <div className="grid grid-cols-4 gap-2">
            {variations
              .filter(v => v.image)
              .map(variation => (
                <button 
                  key={variation.id}
                  type="button"
                  className={`relative h-20 w-20 border rounded-md overflow-hidden ${
                    selectedVariation?.id === variation.id
                      ? 'border-blue-500 ring-2 ring-blue-300'
                      : 'border-gray-300 hover:border-blue-500'
                  }`}
                  onClick={() => handleImageSelect(variation)}
                >
                  <Image
                    src={variation.image?.src || ''}
                    alt={variation.image?.alt || ''}
                    fill
                    sizes="80px"
                    style={{ objectFit: 'cover' }}
                  />
                </button>
              ))
            }
          </div>
        </div>
      )}
      
      {/* Prezzo della variazione selezionata */}
      {selectedVariation && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Prezzo</h3>
          {!hasValidPrice ? (
            <span className="text-xl font-bold text-red-600">Prezzo non disponibile</span>
          ) : isOnSale ? (
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-red-600">
                {formatPrice(selectedVariation.sale_price)}
              </span>
              <span className="text-xl line-through text-gray-500">
                {formatPrice(selectedVariation.regular_price)}
              </span>
            </div>
          ) : (
            <span className="text-3xl font-bold text-gray-900">
              {formatPrice(selectedVariation.price || selectedVariation.regular_price)}
            </span>
          )}
        </div>
      )}
      
      {/* Stato del magazzino */}
      {selectedVariation && (
        <div className="mb-6">
          {selectedVariation.stock_status === 'instock' && hasValidPrice ? (
            <div>
              <span className="text-green-600 bg-green-100 px-3 py-1 rounded-full text-sm font-medium">
                Disponibile
              </span>
              {selectedVariation.manage_stock && typeof selectedVariation.stock_quantity === 'number' && (
                <span className="ml-2 text-sm text-gray-600">
                  {selectedVariation.stock_quantity > 0 
                    ? `${selectedVariation.stock_quantity} ${selectedVariation.stock_quantity === 1 ? 'pezzo' : 'pezzi'} disponibili` 
                    : 'Esaurito'}
                </span>
              )}
            </div>
          ) : (
            <span className="text-red-600 bg-red-100 px-3 py-1 rounded-full text-sm font-medium">
              {!hasValidPrice ? 'Variazione non disponibile' : 'Non disponibile'}
            </span>
          )}
        </div>
      )}
      
      {/* Selettore di quantità */}
      {selectedVariation && selectedVariation.stock_status === 'instock' && hasValidPrice && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-900">Quantità</h3>
          <div className="flex items-center">
            <button 
              onClick={handleDecreaseQuantity}
              className="w-10 h-10 rounded-l-md bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={handleQuantityChange}
              className="w-16 h-10 border-t border-b border-gray-300 text-center text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button 
              onClick={handleIncreaseQuantity}
              className="w-10 h-10 rounded-r-md bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Messaggio se non ci sono variazioni disponibili */}
      {variationsLoaded && variations.length === 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mb-6">
          <p className="text-yellow-700">Nessuna variazione disponibile per questo prodotto.</p>
        </div>
      )}
      
      {/* Pulsante Aggiungi al carrello */}
      {variationsLoaded && variations.length > 0 && (
        <button
          onClick={handleAddToCart}
          disabled={!selectedVariation || selectedVariation.stock_status !== 'instock' || isAddingToCart}
          className={`w-full py-3 px-6 rounded-md font-medium text-center flex items-center justify-center ${
            !selectedVariation || selectedVariation.stock_status !== 'instock'
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : isAddingToCart
                ? 'bg-bred-700 text-white cursor-not-allowed'
                : 'bg-bred-500 text-white hover:bg-bred-700 transition-colors'
          }`}
        >
          {!selectedVariation ? (
            'Seleziona una variante'
          ) : selectedVariation.stock_status !== 'instock' ? (
            'Non disponibile'
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
              {`Aggiungi ${quantity > 1 ? quantity + ' pezzi' : ''} al carrello`}
            </>
          )}
        </button>
      )}
    </div>
  );
}
