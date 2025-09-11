'use client';

import React, { useState, useEffect } from 'react';
import { Product } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import ProductDepositOptionsComponent from '@/components/product/ProductDepositOptions';
import PayPalExpressButton from '@/components/product/PayPalExpressButton';
import AppleGooglePayButton from '@/components/product/AppleGooglePayButton';
import ProductNotificationForm from '@/components/ProductNotificationForm';
import { getDepositMetadata } from '@/lib/deposits';

interface SimpleProductAddToCartProps {
  product: Product;
}

export default function SimpleProductAddToCart({ product }: SimpleProductAddToCartProps) {
  const [quantity, setQuantity] = useState<number>(1);
  const [showMessage, setShowMessage] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [isAddingToCart, setIsAddingToCart] = useState<boolean>(false);
  const [enableDeposit, setEnableDeposit] = useState<'yes' | 'no'>('no');
  const { addToCart } = useCart();
  
  // Controlla se il prodotto è in pre-order basandosi sull'attributo Disponibilità
  const getAttribute = (name: string) => {
    return product.attributes?.find(attr => attr.name === name)?.options?.[0];
  };
  
  const disponibilita = getAttribute('Disponibilità');
  const isPreOrder = disponibilita?.toLowerCase().includes('pre-order') || disponibilita?.toLowerCase().includes('preorder');
  
  // Nascondi il messaggio dopo 3 secondi
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showMessage) {
      timer = setTimeout(() => setShowMessage(false), 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showMessage]);
  
  // Verifica se il prodotto è in stock e ha un prezzo valido
  const hasValidPrice = product.price && parseFloat(product.price) > 0;
  const isInStock = product.stock_status === 'instock' && hasValidPrice;
  
  // Verifica se il prodotto gestisce lo stock e ha una quantità disponibile
  const hasStockManagement = product.manage_stock && typeof product.stock_quantity === 'number';
  
  // Gestisce l'incremento della quantità
  const handleIncreaseQuantity = () => {
    if (hasStockManagement && typeof product.stock_quantity === 'number') {
      if (quantity < product.stock_quantity) {
        setQuantity(prev => prev + 1);
      } else {
        setMessage(`Disponibilità massima: ${product.stock_quantity} pezzi`);
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
      if (hasStockManagement && typeof product.stock_quantity === 'number') {
        if (value <= product.stock_quantity) {
          setQuantity(value);
        } else {
          setQuantity(product.stock_quantity);
          setMessage(`Disponibilità massima: ${product.stock_quantity} pezzi`);
          setShowMessage(true);
        }
      } else {
        setQuantity(value);
      }
    } else if (e.target.value === '') {
      setQuantity(1);
    }
  };
  
  // Gestisce l'aggiunta al carrello
  const handleAddToCart = async () => {
    if (isAddingToCart) return;
    
    // Controllo preliminare della quantità disponibile
    if (hasStockManagement && typeof product.stock_quantity === 'number' && quantity > product.stock_quantity) {
      setMessage(`Disponibilità insufficiente. Massimo disponibile: ${product.stock_quantity} pezzi`);
      setShowMessage(true);
      return;
    }
    
    setIsAddingToCart(true);
    
    try {
      // Se l'acconto è abilitato, arricchiamo il prodotto con i metadati dell'acconto
      if (enableDeposit === 'yes') {
        try {
          // Recupera le opzioni di acconto dal backend
          const depositOptionsResponse = await fetch(`/api/products/${product.id}/deposit-options`);
          let depositAmount = '40';
          let depositType = 'percent';
          let paymentPlanId = ''; // Inizializziamo l'ID del piano di pagamento
          
          if (depositOptionsResponse.ok) {
            const depositOptions = await depositOptionsResponse.json();
            console.log('Opzioni acconto dal backend:', depositOptions);
            
            // Verifica se l'acconto è abilitato per questo prodotto
            if (depositOptions.success === true && depositOptions.deposit_enabled === false) {
              // Prodotto non supporta acconti, procedi con acquisto normale
              console.log('Prodotto non supporta acconti, procedo con acquisto normale');
              
              // Disabilita l'opzione di acconto e procedi con acquisto normale
              setEnableDeposit('no');
              
              // Aggiungi il prodotto al carrello normalmente
              await addToCart(product, quantity);
              setIsAddingToCart(false);
              return; // Esci dalla funzione qui
            }
            
            // Estrai le informazioni sull'acconto
            if (depositOptions.deposit_amount) {
              depositAmount = depositOptions.deposit_amount.toString();
            }
            
            if (depositOptions.deposit_type) {
              depositType = depositOptions.deposit_type;
            }
            
            // Estrai l'ID del piano di pagamento se presente
            if (depositOptions.payment_plan && depositOptions.payment_plan.id) {
              paymentPlanId = depositOptions.payment_plan.id.toString();
              console.log('ID piano di pagamento estratto:', paymentPlanId);
            }
            
            // Se è il piano pianoprova, forziamo l'ID corretto
            if (depositOptions.is_pianoprova) {
              paymentPlanId = '810'; // ID hardcoded per pianoprova
              console.log('Forzato ID piano pianoprova:', paymentPlanId);
            }
          } else {
            console.warn('Impossibile recuperare le opzioni di acconto, utilizzo valori predefiniti');
          }
          
          console.log('ID piano di pagamento salvato nei metadati:', paymentPlanId);
            
          // Ottieni una copia del prodotto per non modificare l'originale
          const productWithDeposit = { ...product };
          
          // Ottieni i metadati per l'acconto con i valori recuperati dal backend
          // Includiamo anche l'ID del piano di pagamento
          const depositMetadata = getDepositMetadata('yes', depositAmount, depositType, paymentPlanId);
          
          // Aggiungi i metadati al prodotto
          productWithDeposit.meta_data = [
            ...(productWithDeposit.meta_data || []),
            ...(depositMetadata.meta_data || [])
          ];
          
          // Aggiungi altre proprietà dal depositMetadata
          Object.assign(productWithDeposit, {
            wc_deposit_option: depositMetadata.wc_deposit_option,
            _wc_convert_to_deposit: 'yes',
            _wc_deposit_type: depositType,
            _wc_deposit_amount: depositAmount,
            _deposit_payment_plan: paymentPlanId
          });
          
          // Usa la funzione addToCart del contesto carrello (comportamento originale funzionante)
          const result = addToCart(productWithDeposit, quantity);
          
          if (result.success) {
            setMessage(`${quantity} ${quantity > 1 ? 'pezzi' : 'pezzo'} di ${product.name} ${quantity > 1 ? 'aggiunti' : 'aggiunto'} al carrello con acconto!`);
          } else {
            setMessage(result.message || 'Errore durante l\'aggiunta al carrello con acconto');
          }
        } catch (error) {
          console.error('Errore durante l\'aggiunta al carrello con acconto:', error);
          setMessage('Errore durante l\'aggiunta al carrello con acconto');
        }
      } else {
        // Aggiunta normale al carrello senza acconto
        const result = addToCart(product, quantity);
        
        if (result.success) {
          setMessage(`${quantity} ${quantity > 1 ? 'pezzi' : 'pezzo'} di ${product.name} ${quantity > 1 ? 'aggiunti' : 'aggiunto'} al carrello!`);
        } else {
          setMessage(result.message || 'Errore durante l\'aggiunta al carrello');
        }
      }
      
      setShowMessage(true);
    } catch (error) {
      console.error('Errore durante l\'aggiunta al carrello:', error);
      setMessage('Si è verificato un errore durante l\'aggiunta al carrello');
      setShowMessage(true);
    }
    
    setTimeout(() => setIsAddingToCart(false), 300);
  };
  
  // Gestisce il cambio dell'opzione di acconto
  const handleDepositOptionChange = (option: 'yes' | 'no') => {
    setEnableDeposit(option);
  };
  
  return (
    <div className="mt-6 relative">      
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
      
      {/* Avviso prezzo non disponibile */}
      {!hasValidPrice && product.stock_status === 'instock' && (
        <div className="mb-6">
          <div className="text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Prezzo non disponibile</span>
          </div>
        </div>
      )}
      
      {/* Opzioni di acconto se disponibili */}
      {isInStock && hasValidPrice && (
        <ProductDepositOptionsComponent 
          product={product} 
          onDepositOptionChange={handleDepositOptionChange} 
        />
      )}
      
      {/* Selettore di quantità */}
      {isInStock && hasValidPrice && (
        <div className="mb-6">
          <div className="flex items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Quantità</h3>
            {/* Rimosso il contatore dei pezzi disponibili per privacy */}
          </div>
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
      
      {/* Express Checkout Options - Sopra il pulsante aggiungi al carrello */}
      {isInStock && hasValidPrice && (
        <div className="space-y-3">
          {/* Apple Pay / Google Pay */}
          <AppleGooglePayButton 
            product={product} 
            quantity={quantity} 
            enableDeposit={enableDeposit}
          />
          
          {/* PayPal Express */}
          <PayPalExpressButton 
            product={product} 
            quantity={quantity} 
            enableDeposit={enableDeposit}
          />
        </div>
      )}
      
      {/* Form notifica se prodotto non disponibile */}
      {!isInStock && (
        <div className="mb-6">
          <ProductNotificationForm 
            productId={product.id} 
            productName={product.name}
          />
        </div>
      )}
      
      {/* Pulsante Aggiungi al carrello - solo se disponibile */}
      {isInStock && (
        <button
          onClick={handleAddToCart}
          disabled={isAddingToCart}
          type="button"
          className={`w-full py-3 px-6 rounded-md font-medium text-center flex items-center justify-center ${
            isAddingToCart
              ? 'bg-bred-700 text-white cursor-not-allowed'
              : 'bg-bred-500 text-white hover:bg-bred-700 transition-colors'
          }`}
        >
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
            {enableDeposit === 'yes' 
              ? `Paga acconto per ${quantity > 1 ? quantity + ' pezzi' : ''}`
              : isPreOrder
                ? `Pre-ordina ora ${quantity > 1 ? quantity + ' pezzi' : ''}`
                : `Aggiungi ${quantity > 1 ? quantity + ' pezzi' : ''} al carrello`
            }
          </>
        </button>
      )}
    </div>
  );
}
