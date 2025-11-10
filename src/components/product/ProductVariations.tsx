'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ProductVariation, ProductAttribute, Product } from '../../lib/api';
import { useCart, CartItem } from '../../context/CartContext';
import ProductNotificationForm from '../ProductNotificationForm';
import GiftCardForm, { GiftCardData } from './GiftCardForm';
import GiftCardCustomAmount from './GiftCardCustomAmount';
import { variationImageEvents } from './ProductImagesSection';
import ProductDepositOptionsComponent from './ProductDepositOptions';
import { getDepositMetadata } from '@/lib/deposits';
import PayPalExpressButton from '@/components/product/PayPalExpressButton';
import AppleGooglePayButton from '@/components/product/AppleGooglePayButton';

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
  productImages?: Array<{
    id: number;
    src: string;
    alt: string;
  }>;
  dateOnSaleFrom?: string;
  dateOnSaleTo?: string;
}

export default function ProductVariations({
  productId,
  attributes,
  variations,
  defaultAttributes,
  productName,
  productImages,
  dateOnSaleFrom,
  dateOnSaleTo
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
  const [giftCardData, setGiftCardData] = useState<GiftCardData | null>(null);
  const [customAmount, setCustomAmount] = useState<number | undefined>(undefined);
  const [isGiftCardProduct, setIsGiftCardProduct] = useState<boolean>(false);
  const [enableDeposit, setEnableDeposit] = useState<'yes' | 'no'>('no');
  const { addToCart } = useCart();
  
  // Controlla se il prodotto è in pre-order basandosi sull'attributo Disponibilità
  const getAttribute = (name: string) => {
    const attr = attributes?.find(attr => attr.name === name);
    if (!attr) return undefined;

    const firstOption = attr.options?.[0];
    if (typeof firstOption === 'string') {
      return firstOption;
    }
    // If it's an object with name property
    return (firstOption as { name?: string })?.name;
  };

  const disponibilita = getAttribute('Disponibilità') || getAttribute('pa_disponibilita');
  const isPreOrder = disponibilita?.toLowerCase().includes('pre-order') || disponibilita?.toLowerCase().includes('preorder');

  // Verifica se è un prodotto gift card
  useEffect(() => {
    const checkIfGiftCardProduct = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_WORDPRESS_URL}wp-json/gift-card/v1/config`, {
          headers: {
            'Authorization': `Basic ${btoa(`${process.env.NEXT_PUBLIC_WC_CONSUMER_KEY}:${process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET}`)}`
          }
        });

        if (response.ok) {
          const config = await response.json();
          const giftCardProductId = config?.data?.gift_card_product_id;
          setIsGiftCardProduct(productId === giftCardProductId);
        } else {
          // Fallback per ID hardcoded
          setIsGiftCardProduct(productId === 176703);
        }
      } catch {
        // Fallback per ID hardcoded in caso di errore
        setIsGiftCardProduct(productId === 176703);
      }
    };

    checkIfGiftCardProduct();
  }, [productId]);

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

  // Emetti evento per cambiare l'immagine della galleria quando cambia la variazione selezionata
  useEffect(() => {
    if (selectedVariation && selectedVariation.image && !isGiftCardProduct) {
      variationImageEvents.emit(selectedVariation.image.src);
    }
  }, [selectedVariation, isGiftCardProduct]);

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

    // Cambia l'immagine principale nella galleria usando l'event emitter
    if (variation.image) {
      variationImageEvents.emit(variation.image.src);
    }
  };
  
  // Gestisce l'aggiunta al carrello di una variazione di prodotto
  const handleAddToCart = async () => {
    // Per le gift card con importo personalizzato, non è necessaria una variazione
    if (!selectedVariation && !(isGiftCardProduct && customAmount)) {
      setMessage('Seleziona una variazione prima di aggiungere al carrello');
      setShowMessage(true);
      return;
    }

    // Se è un prodotto gift card, verifica che i dati siano completi
    if (isGiftCardProduct) {
      if (!giftCardData || !giftCardData.recipientEmail) {
        setMessage('Per favore inserisci l\'email del destinatario per la gift card.');
        setShowMessage(true);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(giftCardData.recipientEmail)) {
        setMessage('Per favore inserisci un indirizzo email valido.');
        setShowMessage(true);
        return;
      }
    }

    if (isAddingToCart) return;

    // Controllo preliminare della quantità disponibile (solo se c'è una variazione selezionata)
    if (selectedVariation && selectedVariation.manage_stock && typeof selectedVariation.stock_quantity === 'number' &&
        quantity > selectedVariation.stock_quantity) {
      setMessage(`Disponibilità insufficiente. Massimo disponibile: ${selectedVariation.stock_quantity} pezzi`);
      setShowMessage(true);
      return;
    }

    setIsAddingToCart(true);

    try {
      // Se l'acconto è abilitato, arricchiamo il prodotto con i metadati dell'acconto
      if (enableDeposit === 'yes') {
        try {
          // Recupera le opzioni di acconto dal backend passando il prezzo della variazione
          const variationPrice = selectedVariation?.price || customAmount?.toString();
          const depositOptionsUrl = variationPrice
            ? `/api/products/${productId}/deposit-options?price=${variationPrice}`
            : `/api/products/${productId}/deposit-options`;
          const depositOptionsResponse = await fetch(depositOptionsUrl);
          let depositAmount = '40';
          let depositType = 'percent';
          let paymentPlanId = '';

          if (depositOptionsResponse.ok) {
            const depositOptions = await depositOptionsResponse.json();

            // Verifica se l'acconto è abilitato per questo prodotto
            if (depositOptions.success === true && depositOptions.deposit_enabled === false) {
              // Disabilita l'opzione di acconto e procedi con acquisto normale
              setEnableDeposit('no');

              // Continua con l'aggiunta normale (ricorsione con enableDeposit = 'no')
              setIsAddingToCart(false);
              return handleAddToCart();
            }

            if (depositOptions.deposit_amount) {
              depositAmount = depositOptions.deposit_amount.toString();
            }

            if (depositOptions.deposit_type) {
              depositType = depositOptions.deposit_type;
            }

            if (depositOptions.payment_plan && depositOptions.payment_plan.id) {
              paymentPlanId = depositOptions.payment_plan.id.toString();
            }

            if (depositOptions.is_pianoprova) {
              paymentPlanId = '810';
            }
          } else {
            console.warn('Impossibile recuperare le opzioni di acconto, utilizzo valori predefiniti');
          }

          let variationDetails = '';
          let productWithVariation: Product;

          if (selectedVariation) {
            variationDetails = selectedVariation.attributes
              ?.map(attr => `${attr.name}: ${attr.option}`)
              .join(', ') || `Variazione #${selectedVariation.id}`;

            productWithVariation = {
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
          } else {
            variationDetails = `Importo personalizzato €${customAmount}`;
            productWithVariation = {
              id: productId,
              name: `${productName} - ${variationDetails}`,
              price: customAmount?.toString() || '0',
              regular_price: customAmount?.toString() || '0',
              sale_price: '',
              description: '',
              short_description: '',
              permalink: '',
              slug: '',
              type: 'simple',
              stock_status: 'instock',
              stock_quantity: undefined,
              manage_stock: false,
              images: productImages || [],
              categories: []
            };
          }

          // Ottieni i metadati per l'acconto
          const depositMetadata = getDepositMetadata('yes', depositAmount, depositType, paymentPlanId);

          // Aggiungi i metadati al prodotto
          productWithVariation.meta_data = [
            ...(productWithVariation.meta_data || []),
            ...(depositMetadata.meta_data || [])
          ];

          // Aggiungi altre proprietà dal depositMetadata
          Object.assign(productWithVariation, {
            wc_deposit_option: depositMetadata.wc_deposit_option,
            _wc_convert_to_deposit: 'yes',
            _wc_deposit_type: depositType,
            _wc_deposit_amount: depositAmount,
            _deposit_payment_plan: paymentPlanId
          });

          const formattedAttributes = selectedVariation?.attributes?.map(attr => ({
            id: attr.id,
            name: attr.name,
            option: attr.option
          })) || [];

          const cartItem: CartItem = {
            product: productWithVariation,
            quantity: quantity,
            variation_id: selectedVariation?.id || 0,
            attributes: formattedAttributes,
            meta_data: []
          };

          const result = addToCart(cartItem);

          if (result.success) {
            setMessage(`${quantity} ${quantity > 1 ? 'pezzi' : 'pezzo'} di ${productWithVariation.name} ${quantity > 1 ? 'aggiunti' : 'aggiunto'} al carrello con acconto!`);
          } else {
            setMessage(result.message || 'Errore durante l\'aggiunta al carrello con acconto');
          }
        } catch (error) {
          console.error('Errore durante l\'aggiunta al carrello con acconto:', error);
          setMessage('Errore durante l\'aggiunta al carrello con acconto');
        }
      } else {
        // Aggiunta normale senza acconto
        let variationDetails = '';
        let productWithVariation: Product;

        if (selectedVariation) {
          // Caso normale con variazione selezionata
          variationDetails = selectedVariation.attributes
            ?.map(attr => `${attr.name}: ${attr.option}`)
            .join(', ') || `Variazione #${selectedVariation.id}`;

          productWithVariation = {
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
        } else {
          // Caso gift card con importo personalizzato senza variazione
          variationDetails = `Importo personalizzato €${customAmount}`;

          productWithVariation = {
            id: productId,
            name: `${productName} - ${variationDetails}`,
            price: customAmount?.toString() || '0',
            regular_price: customAmount?.toString() || '0',
            sale_price: '',
            description: '',
            short_description: '',
            permalink: '',
            slug: '',
            type: 'simple',
            stock_status: 'instock',
            stock_quantity: undefined,
            manage_stock: false,
            images: productImages || [],
            categories: []
          };
        }

        // Se è un prodotto gift card, aggiungi i metadati
        if (isGiftCardProduct && giftCardData) {
          const giftCardMetaData = [
            { key: '_gift_card_recipient_email', value: giftCardData.recipientEmail },
            { key: '_gift_card_recipient_name', value: giftCardData.recipientName || '' },
            { key: '_gift_card_message', value: giftCardData.message || '' }
          ];

          // Se usa un importo personalizzato, aggiungilo ai metadati e modifica il prezzo
          if (customAmount) {
            giftCardMetaData.push({ key: '_gift_card_custom_amount', value: customAmount.toString() });

            // Modifica il prezzo del prodotto per riflettere l'importo personalizzato
            productWithVariation = {
              ...productWithVariation,
              price: customAmount.toString(),
              regular_price: customAmount.toString(),
              sale_price: ''
            };
          }

          productWithVariation = {
            ...productWithVariation,
            meta_data: [
              ...(productWithVariation.meta_data || []),
              ...giftCardMetaData
            ]
          };
        }

        const formattedAttributes = selectedVariation?.attributes?.map(attr => ({
          id: attr.id,
          name: attr.name,
          option: attr.option
        })) || [];

        const cartItemMetaData = isGiftCardProduct && giftCardData ? [
          { key: '_gift_card_recipient_email', value: giftCardData.recipientEmail },
          { key: '_gift_card_recipient_name', value: giftCardData.recipientName || '' },
          { key: '_gift_card_message', value: giftCardData.message || '' }
        ] : [];

        // Se usa importo personalizzato, aggiungilo ai meta_data del cart item
        if (isGiftCardProduct && customAmount) {
          cartItemMetaData.push({ key: '_gift_card_custom_amount', value: customAmount.toString() });
        }

        const cartItem: CartItem = {
          product: productWithVariation,
          quantity: quantity,
          variation_id: selectedVariation?.id || 0,
          attributes: formattedAttributes,
          meta_data: cartItemMetaData
        };

        // Utilizziamo il risultato restituito dalla funzione addToCart
        const result = addToCart(cartItem);

        if (result.success) {
          if (isGiftCardProduct) {
            setMessage(`Gift card aggiunta al carrello! Verrà inviata a ${giftCardData?.recipientEmail}`);
          } else {
            setMessage(`${quantity} ${quantity > 1 ? 'pezzi' : 'pezzo'} di ${productWithVariation.name} ${quantity > 1 ? 'aggiunti' : 'aggiunto'} al carrello!`);
          }
        } else {
          // Mostriamo il messaggio di errore restituito dalla funzione addToCart
          setMessage(result.message || 'Errore durante l\'aggiunta al carrello');
        }
      }

      setShowMessage(true);
    } catch {
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

  // Gestisce il cambio dei dati gift card
  const handleGiftCardDataChange = (data: GiftCardData) => {
    setGiftCardData(data);
  };

  // Gestisce il cambio dell'importo personalizzato
  const handleCustomAmountChange = (amount: number | undefined) => {
    setCustomAmount(amount);
  };

  // Gestisce il cambio dell'opzione di acconto
  const handleDepositOptionChange = (option: 'yes' | 'no') => {
    setEnableDeposit(option);
  };

  // Formatta il prezzo con il simbolo della valuta
  const formatPrice = (price: string | undefined) => {
    if (!price || isNaN(parseFloat(price))) {
      return 'Prezzo non disponibile';
    }
    return `€${parseFloat(price).toFixed(2)}`;
  };

  // Verifica se il prodotto è in vendita - rispettando le date pianificate
  const isOnSale = (() => {
    if (!selectedVariation?.sale_price || selectedVariation.sale_price === '') return false;

    const now = new Date().getTime();

    // Controlla la data di inizio (se presente)
    if (dateOnSaleFrom) {
      const startDate = new Date(dateOnSaleFrom).getTime();
      if (now < startDate) return false;
    }

    // Controlla la data di fine (se presente)
    if (dateOnSaleTo) {
      const endDate = new Date(dateOnSaleTo).getTime();
      if (now > endDate) return false;
    }

    return true;
  })();

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
      
      {/* Galleria delle variazioni con immagini - nascosta per gift card */}
      {variationsLoaded && variations.filter(v => v.image).length > 0 && !isGiftCardProduct && (
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

      {/* Opzioni di acconto se disponibili - solo per prodotti non gift card */}
      {selectedVariation && selectedVariation.stock_status === 'instock' && hasValidPrice && !isGiftCardProduct && (
        <ProductDepositOptionsComponent
          product={{
            id: productId,
            name: productName,
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
            images: [],
            categories: []
          }}
          onDepositOptionChange={handleDepositOptionChange}
        />
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
              className="w-16 h-10 border-t border-b border-gray-300 text-center text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
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
      
      {/* Form notifica se variazione non disponibile */}
      {variationsLoaded && selectedVariation && selectedVariation.stock_status !== 'instock' && (
        <div className="mb-6">
          <ProductNotificationForm 
            productId={selectedVariation.id} 
            productName={`${productName} - ${Object.values(selectedAttributes).join(', ')}`}
          />
        </div>
      )}

      {/* Importo personalizzato Gift Card - solo per prodotti gift card */}
      {isGiftCardProduct && (
        <GiftCardCustomAmount
          productId={productId}
          onAmountChange={handleCustomAmountChange}
        />
      )}

      {/* Form Gift Card - solo per prodotti gift card */}
      {isGiftCardProduct && (
        <GiftCardForm
          productId={productId}
          onDataChange={handleGiftCardDataChange}
        />
      )}

      {/* Express Checkout Options - Sopra il pulsante aggiungi al carrello - Non per gift card */}
      {!isGiftCardProduct && selectedVariation && selectedVariation.stock_status === 'instock' && hasValidPrice && (
        <div className="space-y-3 mb-6">
          {/* Apple Pay / Google Pay */}
          <AppleGooglePayButton
            product={{
              id: productId,
              name: `${productName} - ${selectedVariation.attributes?.map(attr => `${attr.name}: ${attr.option}`).join(', ') || ''}`,
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
            }}
            quantity={quantity}
            enableDeposit={enableDeposit}
            variationId={selectedVariation.id}
            variationAttributes={selectedVariation.attributes?.map(attr => ({
              id: attr.id,
              name: attr.name,
              option: attr.option
            }))}
          />

          {/* PayPal Express - Gestisce internamente le condizioni di visibilità */}
          <PayPalExpressButton
            product={{
              id: productId,
              name: `${productName} - ${selectedVariation.attributes?.map(attr => `${attr.name}: ${attr.option}`).join(', ') || ''}`,
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
            }}
            quantity={quantity}
            enableDeposit={enableDeposit}
            variationId={selectedVariation.id}
            variationAttributes={selectedVariation.attributes?.map(attr => ({
              id: attr.id,
              name: attr.name,
              option: attr.option
            }))}
          />
        </div>
      )}

      {/* Pulsante Aggiungi al carrello */}
      {variationsLoaded && variations.length > 0 && (
        <button
          onClick={handleAddToCart}
          disabled={
            (!selectedVariation && !(isGiftCardProduct && customAmount)) ||
            (selectedVariation && selectedVariation.stock_status !== 'instock') ||
            isAddingToCart
          }
          className={`w-full py-3 px-6 rounded-md font-medium text-center flex items-center justify-center ${
            (!selectedVariation && !(isGiftCardProduct && customAmount)) ||
            (selectedVariation && selectedVariation.stock_status !== 'instock')
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : isAddingToCart
                ? 'bg-bred-700 text-white cursor-not-allowed'
                : 'bg-bred-500 text-white hover:bg-bred-700 transition-colors'
          }`}
        >
          {!selectedVariation && !(isGiftCardProduct && customAmount) ? (
            isGiftCardProduct ? 'Seleziona una variante o inserisci importo personalizzato' : 'Seleziona una variante'
          ) : selectedVariation && selectedVariation.stock_status !== 'instock' ? (
            'Non disponibile'
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
              {isGiftCardProduct
                ? customAmount
                  ? `Acquista Gift Card €${customAmount} ${quantity > 1 ? quantity + ' pezzi' : ''}`
                  : `Acquista Gift Card ${quantity > 1 ? quantity + ' pezzi' : ''}`
                : enableDeposit === 'yes'
                  ? `Paga acconto per ${quantity > 1 ? quantity + ' pezzi' : ''}`
                  : isPreOrder
                    ? `Pre-ordina ora ${quantity > 1 ? quantity + ' pezzi' : ''}`
                    : `Aggiungi ${quantity > 1 ? quantity + ' pezzi' : ''} al carrello`
              }
            </>
          )}
        </button>
      )}
    </div>
  );
}
