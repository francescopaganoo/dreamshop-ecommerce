'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import Link from 'next/link';
import AppleGooglePayCheckout from '@/components/checkout/AppleGooglePayCheckout';

import { createOrder, createCustomer, getShippingMethods, ShippingMethod, getUserAddresses, saveUserAddresses, getProductShippingClassId } from '../../lib/api';
import { redeemPoints } from '../../lib/points';
import { getAvailableCountries, CountryOption } from '../../lib/countries';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, getSubtotal, clearCart, coupon, discount } = useCart();
  const { isAuthenticated, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  
  // Stato per i punti riscattati
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const [pointsDiscount, setPointsDiscount] = useState<number>(0);

  // Controlla se ci sono prodotti con deposit (rate) nel carrello
  const hasDepositProducts = cart.some(item => item.product._wc_convert_to_deposit === 'yes');

  // Hook di Stripe
  const stripe = useStripe();
  const elements = useElements();
  const [cardError, setCardError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  
  // Hook di PayPal
  // Rimuoviamo le variabili non utilizzate
  const [, ] = usePayPalScriptReducer();
  const [showPayPalButtons, setShowPayPalButtons] = useState(false);
  
  // Definiamo un'interfaccia per i dati dell'ordine PayPal
  // Interfaccia per i metadati degli attributi
  interface AttributeMetaData {
    key: string;
    value: string;
  }

  // Interfaccia per i line items con supporto per le variazioni
  interface LineItem {
    product_id: number;
    quantity: number;
    variation_id?: number;
    meta_data?: AttributeMetaData[];
  }

  interface FormDataType {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address1: string;
    address2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    paymentMethod: string;
    notes: string;
    createAccount: boolean;
    password: string;
    shipToDifferentAddress: boolean;
    shippingFirstName: string;
    shippingLastName: string;
    shippingPhone: string;
    userId: number;
    shippingAddress1: string;
    shippingAddress2: string;
    shippingCity: string;
    shippingState: string;
    shippingPostcode: string;
    shippingCountry: string;
    acceptTerms: boolean;
  }

  interface PayPalOrderData {
    payment_method: string;
    payment_method_title: string;
    set_paid: boolean;
    customer_note?: string;
    billing: Record<string, string>;
    shipping: Record<string, string>;
    line_items: LineItem[];
    shipping_lines: Array<{method_id: string; method_title: string; total: string}>;
  }
  
  const [paypalOrderData, setPaypalOrderData] = useState<PayPalOrderData | null>(null);
  
  // Riferimento per il debounce timer
  const shippingDebounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Rileva se è iOS/Safari per logging e debugging
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  
  // Carica i punti riscattati dal localStorage e rileva il browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Rileva iOS/Safari
      setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent));
      setIsSafari(/Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent));
      
      const savedPointsToRedeem = localStorage.getItem('checkout_points_to_redeem');
      const savedPointsDiscount = localStorage.getItem('checkout_points_discount');
      
      if (savedPointsToRedeem && savedPointsDiscount) {
        setPointsToRedeem(parseInt(savedPointsToRedeem, 10));
        setPointsDiscount(parseFloat(savedPointsDiscount));
      }
    }
  }, []);

  // Carica i paesi disponibili dalle zone WooCommerce
  useEffect(() => {
    const loadCountries = async () => {
      try {
        setCountriesLoading(true);
        const countries = await getAvailableCountries();
        setAvailableCountries(countries);
      } catch (error) {
        console.error('Errore nel caricamento dei paesi:', error);
        // Fallback con paesi principali
        setAvailableCountries([
          { code: 'IT', name: 'Italia', zone: 'Italia' },
          { code: 'FR', name: 'Francia', zone: 'Europa' },
          { code: 'DE', name: 'Germania', zone: 'Europa' },
          { code: 'ES', name: 'Spagna', zone: 'Europa' },
          { code: 'GB', name: 'Regno Unito', zone: 'Europa Extra' }
        ]);
      } finally {
        setCountriesLoading(false);
      }
    };

    loadCountries();
  }, []);

  // Stato per tenere traccia del processo di pagamento
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  // Stato per tenere traccia se il CardElement è pronto
  const [isCardElementReady, setIsCardElementReady] = useState(false);
  
  // Log per debugging
  useEffect(() => {
   
    
    // Configurazione specifica per iOS
    if (isIOS && stripe && elements) {
      
      // Funzione per gestire specifiche configurazioni per iOS
      const applyIOSFix = () => {
        if (typeof document !== 'undefined') {
          // Aggiungiamo meta tag per migliorare l'esperienza su iOS
          const metaViewport = document.querySelector('meta[name=viewport]');
          if (metaViewport) {
            metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
          }
          
          // Aggiungiamo stili specifici per iOS
          const style = document.createElement('style');
          style.innerHTML = `
            @supports (-webkit-touch-callout: none) {
              /* Stili specifici per iOS */
              .stripe-element {
                -webkit-appearance: none;
                border-radius: 4px;
              }
            }
          `;
          document.head.appendChild(style);
        }
      };
      
      // Applica il fix iniziale
      applyIOSFix();
      
      // Riapplica il fix quando la pagina diventa visibile
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isIOS) {
          applyIOSFix();
        }
      });
    }
  }, [stripe, elements, isIOS, isSafari]);
  
  // Form state
  const [formData, setFormData] = useState<FormDataType>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'IT', // Default to Italy
    paymentMethod: 'stripe', // Default to credit card payment
    notes: '',
    createAccount: false,
    password: '',
    shipToDifferentAddress: false,
    shippingFirstName: '',
    shippingLastName: '',
    userId: 0, // Campo nascosto per memorizzare l'ID utente
    shippingAddress1: '',
    shippingAddress2: '',
    shippingCity: '',
    shippingState: '',
    shippingPostcode: '',
    shippingCountry: 'IT',
    shippingPhone: '',
    acceptTerms: false
  });

  // Stato per i paesi disponibili
  const [availableCountries, setAvailableCountries] = useState<CountryOption[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);

  // Stato per il pagamento Stripe
  const [isStripeLoading, setIsStripeLoading] = useState(false);

  // Stati per la spedizione
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<ShippingMethod | null>(null);
  const [shippingCalculated, setShippingCalculated] = useState<boolean>(false);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState<boolean>(false);

  // Funzione per calcolare i metodi di spedizione
  const calculateShippingMethods = React.useCallback(async (addressData: typeof formData) => {
    // Evita di calcolare la spedizione troppo frequentemente
    if (shippingDebounceTimerRef.current) {
      clearTimeout(shippingDebounceTimerRef.current);
    }

    shippingDebounceTimerRef.current = setTimeout(async () => {
      try {

        // Prepara l'indirizzo di spedizione (usa indirizzo di spedizione se diverso, altrimenti fatturazione)
        const shippingAddress = {
          first_name: addressData.shipToDifferentAddress ? addressData.shippingFirstName : addressData.firstName,
          last_name: addressData.shipToDifferentAddress ? addressData.shippingLastName : addressData.lastName,
          country: addressData.shipToDifferentAddress ? addressData.shippingCountry : addressData.country,
          state: addressData.shipToDifferentAddress ? addressData.shippingState : addressData.state,
          postcode: addressData.shipToDifferentAddress ? addressData.shippingPostcode : addressData.postcode,
          city: addressData.shipToDifferentAddress ? addressData.shippingCity : addressData.city,
          address_1: addressData.shipToDifferentAddress ? addressData.shippingAddress1 : addressData.address1,
          address_2: addressData.shipToDifferentAddress ? addressData.shippingAddress2 : addressData.address2
        };

        // Calcola il totale del carrello senza spedizione per verificare la spedizione gratuita
        const cartTotal = getSubtotal(); // Usa il totale del carrello

        // Prepara i dati del carrello per il calcolo della spedizione
        // Se un prodotto non ha shipping_class_id, recuperalo dal plugin
        const cartItems = await Promise.all(cart.map(async (item) => {
          let shippingClassId = item.product.shipping_class_id || 0;

          // Se non ha shipping_class_id, recuperalo dal plugin
          if (!shippingClassId || shippingClassId === 0) {
            console.log(`Recupero shipping_class_id per prodotto ${item.product.id}`);
            shippingClassId = await getProductShippingClassId(item.product.id);
            console.log(`Shipping class ID recuperato: ${shippingClassId}`);
          }

          return {
            product_id: item.product.id,
            quantity: item.quantity,
            variation_id: item.variation_id,
            shipping_class_id: shippingClassId
          };
        }));

        // Ottieni i metodi di spedizione disponibili
        const availableMethods = await getShippingMethods(shippingAddress, cartTotal, cartItems);

        // Imposta i metodi di spedizione disponibili
        setShippingMethods(availableMethods);

        // Seleziona sempre il primo metodo disponibile (per gestire i cambi di paese)
        if (availableMethods.length > 0) {
          setSelectedShippingMethod(availableMethods[0]);
        }

        setShippingCalculated(true);
      } catch (error) {
        console.error('Errore nel calcolo della spedizione:', error);
        // Fallback con metodo di spedizione standard
        console.error('Errore nel recupero dei metodi di spedizione:', error);
        const defaultMethod = {
          id: 'flat_rate',
          title: 'Spedizione standard',
          description: 'Spedizione standard 5-7 giorni',
          cost: 7.00,
          free_shipping: false
        };
        setShippingMethods([defaultMethod]);
        setSelectedShippingMethod(defaultMethod);
        setShippingCalculated(true);
      }
    }, 500); // Attendi 500ms prima di calcolare la spedizione
  }, [getSubtotal, cart]); // Rimosso selectedShippingMethod - non necessario

  // Precompila il form se l'utente è autenticato
  useEffect(() => {
    const loadUserData = async () => {
      if (isAuthenticated && user) {
        // Ottieni l'ID numerico dell'utente
        const numericUserId = user.id ? parseInt(String(user.id), 10) : 0;
        
        // Carica i dati base dell'utente
        const baseUserData = {
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          userId: numericUserId
        };
        
        // Prova a caricare gli indirizzi salvati
        try {
          const token = localStorage.getItem('woocommerce_token');
          if (token) {
            const addresses = await getUserAddresses(token);
            
            // Se esiste un indirizzo di fatturazione, precompila i campi
            if (addresses.billing) {
              
              setFormData(prev => {
                // Prepara i dati base con fatturazione
                const formUpdate: FormDataType = {
                  ...prev,
                  ...baseUserData,
                  phone: addresses.billing.phone || prev.phone,
                  address1: addresses.billing.address_1 || prev.address1,
                  address2: addresses.billing.address_2 || prev.address2,
                  city: addresses.billing.city || prev.city,
                  state: addresses.billing.state || prev.state,
                  postcode: addresses.billing.postcode || prev.postcode,
                  country: addresses.billing.country || prev.country
                };
                
                // Se esiste un indirizzo di spedizione, controlla se ha dati significativi e diversi
                if (addresses.shipping) {
                  // Prima controlla se l'indirizzo di spedizione ha dati significativi (non solo valori di default)
                  const hasSignificantShippingData = (
                    addresses.shipping.address_1 && 
                    addresses.shipping.address_1.trim() !== '' &&
                    addresses.shipping.city && 
                    addresses.shipping.city.trim() !== '' &&
                    addresses.shipping.postcode && 
                    addresses.shipping.postcode.trim() !== ''
                  );

                  if (hasSignificantShippingData) {
                    // Ora controlla se gli indirizzi sono veramente diversi (confronto rigoroso)
                    const isDifferentAddress = (
                      addresses.shipping.address_1 !== addresses.billing.address_1 ||
                      addresses.shipping.address_2 !== addresses.billing.address_2 ||
                      addresses.shipping.city !== addresses.billing.city ||
                      addresses.shipping.state !== addresses.billing.state ||
                      addresses.shipping.postcode !== addresses.billing.postcode ||
                      addresses.shipping.country !== addresses.billing.country ||
                      addresses.shipping.first_name !== addresses.billing.first_name ||
                      addresses.shipping.last_name !== addresses.billing.last_name
                    );

                    if (isDifferentAddress) {
                      formUpdate.shipToDifferentAddress = true;
                      formUpdate.shippingFirstName = addresses.shipping.first_name || baseUserData.firstName;
                      formUpdate.shippingLastName = addresses.shipping.last_name || baseUserData.lastName;
                      formUpdate.shippingAddress1 = addresses.shipping.address_1 || '';
                      formUpdate.shippingAddress2 = addresses.shipping.address_2 || '';
                      formUpdate.shippingCity = addresses.shipping.city || '';
                      formUpdate.shippingState = addresses.shipping.state || '';
                      formUpdate.shippingPostcode = addresses.shipping.postcode || '';
                      formUpdate.shippingCountry = addresses.shipping.country || 'IT';
                    } else {
                      formUpdate.shipToDifferentAddress = false;
                    }
                  } else {
                    formUpdate.shipToDifferentAddress = false;
                  }
                } else {
                  // Se non c'è indirizzo di spedizione, assicurati che il checkbox sia false
                  formUpdate.shipToDifferentAddress = false;
                }
                
                return formUpdate;
              });
              // Il calcolo della spedizione verrà triggerato automaticamente dal useEffect che ascolta formData.country

            } else {
              // Se non ci sono indirizzi salvati, usa solo i dati base
              setFormData(prev => ({ ...prev, ...baseUserData }));
            }
          } else {
            // Se non c'è token, usa solo i dati base
            setFormData(prev => ({ ...prev, ...baseUserData }));
          }
        } catch (error) {
          console.error('CHECKOUT: Errore nel caricamento degli indirizzi:', error);
          // In caso di errore, usa solo i dati base
          setFormData(prev => ({ ...prev, ...baseUserData }));
        }
      }
    };
    
    loadUserData();
  }, [isAuthenticated, user]); // Rimosso calculateShippingMethods per evitare loop

  // Calculate totals
  const subtotal = getSubtotal(); // Usa getSubtotal per ottenere il prezzo base senza sconti
  const shipping = selectedShippingMethod ? selectedShippingMethod.cost : 0;

  // Calcola il totale base (prodotti + spedizione - sconti)
  const baseTotal = (subtotal - discount - pointsDiscount) + shipping;

  // Calcola la commissione PayPal del 3.5% + €0.35 se PayPal è selezionato
  const paypalFee = formData.paymentMethod === 'paypal' ? (baseTotal * 0.035) + 0.35 : 0;

  // Totale finale includendo eventuale commissione PayPal
  const total = baseTotal + paypalFee;
  
  // Format price with currency symbol
  const formatPrice = (price: number) => {
    return `€${price.toFixed(2)}`;
  };
  

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Funzione per calcolare la spedizione manualmente
  const handleCalculateShipping = async () => {
    // Leggi il valore direttamente dal DOM per evitare problemi di timing su Safari
    const countrySelect = document.getElementById('country') as HTMLSelectElement;
    const shippingCountrySelect = document.getElementById('shippingCountry') as HTMLSelectElement;

    const currentCountry = formData.shipToDifferentAddress
      ? (shippingCountrySelect?.value || formData.shippingCountry)
      : (countrySelect?.value || formData.country);

    if (!currentCountry) {
      setFormError('Seleziona un paese prima di calcolare la spedizione');
      return;
    }

    // Aggiorna il formData con il valore corretto dal DOM
    const updatedFormData = {
      ...formData,
      ...(formData.shipToDifferentAddress
        ? { shippingCountry: currentCountry }
        : { country: currentCountry }
      )
    };

    setIsCalculatingShipping(true);
    setFormError(null);

    try {
      await calculateShippingMethods(updatedFormData);
    } finally {
      setIsCalculatingShipping(false);
    }
  };
  
  // Funzione per resettare il form dopo il completamento dell'ordine
  const resetFormAfterSuccess = () => {
    
    // Reset del form data
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      postcode: '',
      country: 'IT',
      paymentMethod: 'stripe',
      notes: '',
      createAccount: false,
      password: '',
      shipToDifferentAddress: false,
      shippingFirstName: '',
      shippingLastName: '',
      userId: 0,
      shippingAddress1: '',
      shippingAddress2: '',
      shippingCity: '',
      shippingState: '',
      shippingPostcode: '',
      shippingCountry: 'IT',
      shippingPhone: '',
      acceptTerms: false
    });
    
    // Reset errori
    setFormError(null);
    setCardError(null);
    
    // Reset dei punti
    setPointsToRedeem(0);
    setPointsDiscount(0);
    
    // Clear localStorage per i punti
    if (typeof window !== 'undefined') {
      localStorage.removeItem('checkout_points_to_redeem');
      localStorage.removeItem('checkout_points_discount');
    }
    
    // Reset del CardElement di Stripe
    if (elements) {
      const cardElement = elements.getElement(CardElement);
      if (cardElement) {
        cardElement.clear();
      }
    }
    
    // Reset PayPal
    setShowPayPalButtons(false);
    setPaypalOrderData(null);
  };

  // Funzione per salvare gli indirizzi dell'utente
  const saveAddressData = async () => {
    if (!isAuthenticated || !user) {
      return;
    }

    try {
      const token = localStorage.getItem('woocommerce_token');
      if (!token) {
        return;
      }

      // Prepara i dati di fatturazione
      const billingData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        company: '', // Non abbiamo questo campo nel form attuale
        address1: formData.address1,
        address2: formData.address2,
        city: formData.city,
        state: formData.state,
        postcode: formData.postcode,
        country: formData.country,
        email: formData.email,
        phone: formData.phone
      };

      // Prepara i dati di spedizione (solo se diversi dalla fatturazione E se ci sono dati significativi)
      let shippingData = null;
      if (formData.shipToDifferentAddress && 
          formData.shippingAddress1 && 
          formData.shippingCity && 
          formData.shippingPostcode) {
        
        const shippingDataToCheck = {
          firstName: formData.shippingFirstName || formData.firstName,
          lastName: formData.shippingLastName || formData.lastName,
          address1: formData.shippingAddress1,
          address2: formData.shippingAddress2,
          city: formData.shippingCity,
          state: formData.shippingState,
          postcode: formData.shippingPostcode,
          country: formData.shippingCountry
        };

        // Verifica se l'indirizzo di spedizione è veramente diverso da quello di fatturazione
        const isShippingDifferentFromBilling = (
          shippingDataToCheck.firstName !== billingData.firstName ||
          shippingDataToCheck.lastName !== billingData.lastName ||
          shippingDataToCheck.address1 !== billingData.address1 ||
          shippingDataToCheck.address2 !== billingData.address2 ||
          shippingDataToCheck.city !== billingData.city ||
          shippingDataToCheck.state !== billingData.state ||
          shippingDataToCheck.postcode !== billingData.postcode ||
          shippingDataToCheck.country !== billingData.country
        );

        // Salva i dati di spedizione solo se sono veramente diversi
        if (isShippingDifferentFromBilling) {
          shippingData = shippingDataToCheck;
        } 
      }

      const addressDataToSave: {
        billing: typeof billingData;
        shipping?: {
          firstName: string;
          lastName: string;
          address1: string;
          address2?: string;
          city: string;
          state: string;
          postcode: string;
          country: string;
        };
      } = { billing: billingData };
      
      if (shippingData) {
        addressDataToSave.shipping = shippingData;
      }

      await saveUserAddresses(token, addressDataToSave);

    } catch (error) {
      console.error('CHECKOUT: Errore durante il salvataggio degli indirizzi:', error);
      // Non blocchiamo il checkout se il salvataggio degli indirizzi fallisce
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent resubmission if order is already completed
    if (orderSuccess) {
      return;
    }
    
    // Debug visibile nel browser
    if (isAuthenticated && user) {
      console.log('CHECKOUT DEBUG - Dati utente:', {
        id: user.id,
        tipo_id: typeof user.id,
        email: user.email,
        username: user.username
      });
    } else {
      console.log('CHECKOUT DEBUG - Utente non autenticato');
    }
    
    if (cart.length === 0) {
      setFormError('Il tuo carrello è vuoto. Aggiungi prodotti prima di procedere al checkout.');
      return;
    }
    
    // Verifica se la spedizione è stata calcolata
    if (!selectedShippingMethod) {
      setFormError('Calcola la spedizione prima di procedere con l\'ordine.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Verifica se l'utente ha accettato i termini e condizioni
    if (!formData.acceptTerms) {
      setTermsError('È necessario accettare i termini e condizioni per completare l\'ordine.');
      return;
    }

    // Pulisci l'errore dei termini se è stato risolto
    setTermsError(null);

    // Verifica se l'utente ha selezionato di creare un account ma non ha inserito una password
    if (!isAuthenticated && formData.createAccount && (!formData.password || formData.password.length < 6)) {
      setFormError('Per creare un account è necessario inserire una password di almeno 6 caratteri.');
      return;
    }
    
    // Se il metodo di pagamento è PayPal, prepariamo i dati dell'ordine e mostriamo i pulsanti PayPal
    if (formData.paymentMethod as string === 'paypal') {
      try {
        // Prepara i line items per l'ordine
        const line_items = cart.map(item => {
          // Oggetto base con product_id e quantity
          const lineItem: LineItem = {
            product_id: item.product.id,
            quantity: item.quantity
          };
          
          // Aggiungi variation_id se presente
          if (item.variation_id) {
            lineItem.variation_id = item.variation_id;
          }
          
          // Inizializza meta_data se necessario
          if (!lineItem.meta_data) {
            lineItem.meta_data = [];
          }
          
          // Aggiungi gli attributi se presenti
          if (item.attributes && item.attributes.length > 0) {
            // Formatta gli attributi nel formato richiesto da WooCommerce
            const attributeMeta = item.attributes.map(attr => ({
              key: `pa_${attr.name.toLowerCase().replace(/\s+/g, '-')}`,
              value: attr.option
            }));
            
            // Assicurati che meta_data sia un array e aggiungi gli attributi
            lineItem.meta_data = [...(lineItem.meta_data || []), ...attributeMeta];
          }
          
          // Aggiungi i metadati dal cart item (es. dati gift card)
          if (item.meta_data && item.meta_data.length > 0) {
            // Assicurati che meta_data sia un array
            if (!lineItem.meta_data) lineItem.meta_data = [];

            // Aggiungi i metadati personalizzati dall'item del carrello
            lineItem.meta_data.push(...item.meta_data);
          }

          // Aggiungi i metadati degli acconti se il prodotto li ha
          if (item.product._wc_convert_to_deposit === 'yes') {

            // Assicurati che meta_data sia un array
            if (!lineItem.meta_data) lineItem.meta_data = [];

            // Aggiungi i metadati degli acconti
            lineItem.meta_data.push(
              { key: '_wc_convert_to_deposit', value: 'yes' },
              { key: '_wc_deposit_type', value: item.product._wc_deposit_type || 'percent' },
              { key: '_wc_deposit_amount', value: item.product._wc_deposit_amount || '40' }
            );

            // Aggiungi il piano di pagamento se presente
            if (item.product._deposit_payment_plan) {
              lineItem.meta_data.push(
                { key: '_wc_payment_plan', value: item.product._deposit_payment_plan },
                { key: '_deposit_payment_plan', value: item.product._deposit_payment_plan }
              );
            }

          }
          
          return lineItem;
        });
        
        // Prepara i dati cliente
        const billingInfo = {
          first_name: formData.firstName,
          last_name: formData.lastName,
          address_1: formData.address1,
          address_2: formData.address2 || '',
          city: formData.city,
          state: formData.state,
          postcode: formData.postcode,
          country: formData.country,
          email: formData.email,
          phone: formData.phone
        };
        
        // Prepare shipping info (use billing info or shipping info based on checkbox)
        const shippingInfo = formData.shipToDifferentAddress ? {
          first_name: formData.shippingFirstName,
          last_name: formData.shippingLastName,
          address_1: formData.shippingAddress1,
          address_2: formData.shippingAddress2 || '',
          city: formData.shippingCity,
          state: formData.shippingState,
          postcode: formData.shippingPostcode,
          country: formData.shippingCountry,
          phone: formData.shippingPhone
        } : billingInfo;
        
        // Recupera l'ID utente dalla form state per associarlo all'ordine
        const userIdFromForm = formData.userId || 0;
        
        
        // Prepara i dati dell'ordine
        const orderData = {
          payment_method: 'paypal',
          payment_method_title: 'PayPal',
          set_paid: false,
          // Assegna esplicitamente l'ID utente se autenticato
          customer_id: isAuthenticated ? userIdFromForm : 0,
          customer_note: formData.notes,
          billing: billingInfo,
          shipping: shippingInfo,
          line_items,
          shipping_lines: [
            {
              method_id: selectedShippingMethod?.id || 'flat_rate',
              method_title: selectedShippingMethod?.title || 'Spedizione standard',
              total: String(shipping)
            }
          ],
          // Aggiungi il coupon se presente
          coupon_lines: coupon ? [
            {
              code: coupon.code,
              discount: String(discount)
            }
          ] : [],
          // Aggiungi le fee lines (sconto punti e commissione PayPal)
          fee_lines: [
            // Sconto punti se presente
            ...(pointsDiscount > 0 ? [{
              name: `Sconto punti (${pointsToRedeem} punti)`,
              total: String(-pointsDiscount),
              tax_class: '',
              tax_status: 'none'
            }] : []),
            // Commissione PayPal se presente
            ...(paypalFee > 0 ? [{
              name: 'Commissione PayPal (3.5% + €0.35)',
              total: String(paypalFee),
              tax_class: '',
              tax_status: 'none'
            }] : [])
          ]
        };
        
        
        // Salva i dati dell'ordine per PayPal
        setPaypalOrderData(orderData);
        
        setShowPayPalButtons(true);
        
        // Termina qui l'esecuzione, il resto verrà gestito dai pulsanti PayPal
        return;
      } catch (error) {
        console.error('Errore durante la preparazione dell\'ordine PayPal:', error);
        setFormError('Si è verificato un errore durante la preparazione del pagamento PayPal. Riprova più tardi.');
        setIsSubmitting(false);
        return;
      }
    }
    
    setIsSubmitting(true);
    setFormError(null);
    setCardError(null);
    
    try {
      // Log dettagliato per debugging su iOS
      if (isIOS) {
        console.log('Avvio processo di checkout su iOS:', {
          formData: { ...formData, password: '***' }, // Nascondi la password nei log
          cartItems: cart.length,
          paymentMethod: formData.paymentMethod
        });
      }
      
      // Prepara i line_items per l'ordine
      const line_items = cart.map(item => {
        // Oggetto base con product_id e quantity
        const lineItem: LineItem = {
          product_id: item.product.id,
          quantity: item.quantity
        };
        
        // Aggiungi variation_id se presente
        if (item.variation_id) {
          lineItem.variation_id = item.variation_id;
        }
        
        // Inizializza meta_data se necessario
        if (!lineItem.meta_data) {
          lineItem.meta_data = [];
        }
        
        // Aggiungi gli attributi se presenti
        if (item.attributes && item.attributes.length > 0) {
          // Formatta gli attributi nel formato richiesto da WooCommerce
          const attributeMeta = item.attributes.map(attr => ({
            key: `pa_${attr.name.toLowerCase().replace(/\s+/g, '-')}`,
            value: attr.option
          }));
          
          // Assicurati che meta_data sia un array e aggiungi gli attributi
          lineItem.meta_data = [...(lineItem.meta_data || []), ...attributeMeta];
        }
        
        // Aggiungi i metadati dal cart item (es. dati gift card)
        if (item.meta_data && item.meta_data.length > 0) {
          // Assicurati che meta_data sia un array
          if (!lineItem.meta_data) lineItem.meta_data = [];

          // Aggiungi i metadati personalizzati dall'item del carrello
          lineItem.meta_data.push(...item.meta_data);
        }

        // Aggiungi i metadati degli acconti se il prodotto li ha
        if (item.product._wc_convert_to_deposit === 'yes') {

          // Assicurati che meta_data sia un array
          if (!lineItem.meta_data) lineItem.meta_data = [];

          // Aggiungi i metadati degli acconti
          lineItem.meta_data.push(
            { key: '_wc_convert_to_deposit', value: 'yes' },
            { key: '_wc_deposit_type', value: item.product._wc_deposit_type || 'percent' },
            { key: '_wc_deposit_amount', value: item.product._wc_deposit_amount || '40' }
          );

          // Aggiungi il piano di pagamento se presente
          if (item.product._deposit_payment_plan) {
            lineItem.meta_data.push(
              { key: '_wc_payment_plan', value: item.product._deposit_payment_plan },
              { key: '_deposit_payment_plan', value: item.product._deposit_payment_plan }
            );
          }

        }
        
        return lineItem;
      });
      
      // Prepara i dati cliente
      const billingInfo = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        address_1: formData.address1,
        address_2: formData.address2|| '',
        city: formData.city,
        state: formData.state,
        postcode: formData.postcode,
        country: formData.country,
        email: formData.email,
        phone: formData.phone
      };

      
      // Prepara i dati di spedizione (usa i dati di fatturazione o di spedizione in base alla checkbox)
      const shippingInfo = formData.shipToDifferentAddress ? {
        first_name: formData.shippingFirstName,
        last_name: formData.shippingLastName,
        address_1: formData.shippingAddress1,
        address_2: formData.shippingAddress2 || '',
        city: formData.shippingCity,
        state: formData.shippingState,
        postcode: formData.shippingPostcode,
        country: formData.shippingCountry,
        phone: formData.shippingPhone
      } : billingInfo;
      
      // Se il metodo di pagamento è Stripe, gestisci il pagamento con Stripe Elements
      if (formData.paymentMethod === 'stripe') {
        setIsStripeLoading(true);
        
        
        // Se l'utente vuole creare un account, crealo prima dell'ordine
        let customerId = undefined;
        if (formData.createAccount && formData.password && !isAuthenticated) {
          try {
            const customer = await createCustomer({
              email: formData.email,
              password: formData.password,
              first_name: formData.firstName,
              last_name: formData.lastName,
              billing: billingInfo,
              shipping: shippingInfo
            });
            customerId = customer.id;
          } catch (customerError) {
            console.error('[CHECKOUT STRIPE] Errore nella creazione del customer:', customerError);
            // Continua comunque con l'ordine come guest
          }
        }
        
        if (!stripe || !elements) {
          setCardError('Impossibile connettersi al sistema di pagamento. Riprova più tardi.');
          setIsStripeLoading(false);
          setIsSubmitting(false);
          return;
        }
        
        // Gestione speciale per iOS
        if (isIOS) {
          
          try {
            // Otteniamo l'elemento carta
            const cardElement = elements.getElement(CardElement);
            
            if (!cardElement) {
              setCardError('Elemento carta non trovato. Riprova più tardi.');
              setIsStripeLoading(false);
              setIsSubmitting(false);
              return;
            }
            
            // Per iOS, creiamo prima un payment method e poi l'ordine
            const { error, paymentMethod } = await stripe.createPaymentMethod({
              type: 'card',
              card: cardElement,
              billing_details: {
                name: `${formData.firstName} ${formData.lastName}`,
                email: formData.email,
                phone: formData.phone,
                address: {
                  line1: formData.address1,
                  line2: formData.address2 || '',
                  city: formData.city,
                  state: formData.state,
                  postal_code: formData.postcode,
                  country: formData.country
                }
              }
            });
            
            if (error) {
              console.error('Errore durante la creazione del payment method:', error);
              setCardError(error.message || 'Errore nella validazione della carta');
              setIsStripeLoading(false);
              setIsSubmitting(false);
              return;
            }
            
            if (!paymentMethod || !paymentMethod.id) {
              throw new Error('Payment method non creato correttamente');
            }
            
            
            // Prepara i line items per l'ordine
            console.log('iOS CHECKOUT - Analisi prodotti nel carrello:', cart.map(item => ({
              id: item.product.id,
              name: item.product.name,
              _wc_convert_to_deposit: item.product._wc_convert_to_deposit,
              _wc_deposit_type: item.product._wc_deposit_type,
              _wc_deposit_amount: item.product._wc_deposit_amount,
              hasDepositSettings: item.product._wc_convert_to_deposit === 'yes'
            })));
            
            const line_items = cart.map(item => {
              const lineItem: LineItem = {
                product_id: item.product.id,
                quantity: item.quantity
              };
              
              // Aggiungi variation_id se presente
              if (item.variation_id) {
                lineItem.variation_id = item.variation_id;
              }
              
              // Inizializza meta_data se necessario
              if (!lineItem.meta_data) {
                lineItem.meta_data = [];
              }
              
              // Aggiungi gli attributi se presenti
              if (item.attributes && item.attributes.length > 0) {
                const attributeMeta = item.attributes.map(attr => ({
                  key: `pa_${attr.name.toLowerCase().replace(/\s+/g, '-')}`,
                  value: attr.option
                }));
                
                // Assicurati che meta_data sia un array e aggiungi gli attributi
                lineItem.meta_data = [...(lineItem.meta_data || []), ...attributeMeta];
              }
              
              // Aggiungi i metadati dal cart item (es. dati gift card)
              if (item.meta_data && item.meta_data.length > 0) {
                // Assicurati che meta_data sia un array
                if (!lineItem.meta_data) lineItem.meta_data = [];

                // Aggiungi i metadati personalizzati dall'item del carrello
                lineItem.meta_data.push(...item.meta_data);
              }

              // Aggiungi i metadati degli acconti se il prodotto li ha
              if (item.product._wc_convert_to_deposit === 'yes') {
                console.log(`iOS CHECKOUT - Dettagli acconto:`, {
                  _wc_convert_to_deposit: item.product._wc_convert_to_deposit,
                  _wc_deposit_type: item.product._wc_deposit_type,
                  _wc_deposit_amount: item.product._wc_deposit_amount,
                  _deposit_payment_plan: item.product._deposit_payment_plan
                });

                // Assicurati che meta_data sia un array
                if (!lineItem.meta_data) lineItem.meta_data = [];

                // Aggiungi i metadati degli acconti
                lineItem.meta_data.push(
                  { key: '_wc_convert_to_deposit', value: 'yes' },
                  { key: '_wc_deposit_type', value: item.product._wc_deposit_type || 'percent' },
                  { key: '_wc_deposit_amount', value: item.product._wc_deposit_amount || '40' }
                );

                // Aggiungi il piano di pagamento se presente
                if (item.product._deposit_payment_plan) {
                  lineItem.meta_data.push(
                    { key: '_wc_payment_plan', value: item.product._deposit_payment_plan },
                    { key: '_deposit_payment_plan', value: item.product._deposit_payment_plan }
                  );
                }

              } else {
                console.log(`iOS CHECKOUT - NESSUN ACCONTO per prodotto ${item.product.id}: _wc_convert_to_deposit = ${item.product._wc_convert_to_deposit}`);
              }
              
              return lineItem;
            });
            
            // Ottieni l'ID utente direttamente dal form
            // Questo valore è stato impostato nell'useEffect quando l'utente è stato autenticato
            const userIdFromForm = formData.userId || 0;
            

            
            // Crea un ordine con il payment method ID
            const orderResponse = await fetch('/api/stripe/create-order-ios', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                paymentMethodId: paymentMethod.id,
                amount: Math.round(total * 100),
                customerInfo: {  // Usa direttamente le informazioni dal formData
                  first_name: formData.firstName,
                  last_name: formData.lastName,
                  address_1: formData.address1,
                  address_2: formData.address2 || '',
                  city: formData.city,
                  state: formData.state,
                  postcode: formData.postcode,
                  country: formData.country,
                  email: formData.email,
                  phone: formData.phone
                },
                line_items,
                shipping: shipping || 0,
                notes: formData.notes,
                // Passa l'ID utente salvato nel form
                directCustomerId: userIdFromForm,
                isAuthenticated: isAuthenticated,
                // Aggiungi le informazioni sui punti da riscattare
                pointsToRedeem: pointsToRedeem > 0 ? pointsToRedeem : 0,
                token: localStorage.getItem('woocommerce_token') || '',
                // Aggiungi il coupon manuale se presente
                couponCode: coupon ? coupon.code : ''
              }),
            });
            
            const orderData = await orderResponse.json();
            
            if (orderData.error) {
              throw new Error(orderData.error);
            }
            
            // CORREZIONE iOS: Se il pagamento è completato con successo dall'API
            if (orderData.success && orderData.orderId && !orderData.requires_action) {
              console.log('[iOS SUCCESS] Ordine creato e pagamento completato con successo:', {
                orderId: orderData.orderId,
                pointsRedeemed: orderData.pointsRedeemed,
                paymentStatus: orderData.paymentStatus
              });
              
              // Salva gli indirizzi dell'utente
              await saveAddressData();
              
              // Mostra il messaggio di successo
              setOrderSuccess(true);
              setSuccessOrderId(orderData.orderId);
              
              // CORREZIONE iOS: Ritarda il reset per permettere la visualizzazione
              setTimeout(() => {
                resetFormAfterSuccess();
              }, 3000);
              
              setIsSubmitting(false);
              setIsStripeLoading(false);
              return;
            }
            
            // Controlla se è necessaria l'autenticazione 3D Secure
            if (orderData.requires_action && orderData.payment_intent_client_secret) {
              
              // Gestisci l'autenticazione 3D Secure in-page
              const { error, paymentIntent } = await stripe.handleCardAction(
                orderData.payment_intent_client_secret
              );
              
              if (error) {
                console.error('Errore durante l\'autenticazione 3D Secure:', error);
                setCardError('Autenticazione fallita. Riprova o usa un\'altra carta.');
                setIsStripeLoading(false);
                setIsSubmitting(false);
                return;
              }
              
              if (paymentIntent.status === 'requires_confirmation') {
                // Conferma il pagamento dopo l'autenticazione
                const confirmResponse = await fetch('/api/stripe/confirm-payment', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    paymentIntentId: paymentIntent.id,
                    orderId: orderData.orderId
                  }),
                });
                
                const confirmResult = await confirmResponse.json();
                
                if (confirmResult.error) {
                  throw new Error(confirmResult.error);
                }
              }
            }
            
            // Svuota il carrello
            clearCart();
            
            // Riscatta i punti se necessario
            if (pointsToRedeem > 0 && user) {
              try {
                // Recupera il token JWT da localStorage
                const token = localStorage.getItem('woocommerce_token');
                if (token) {
                  // Per PayPal, useremo l'ID dell'ordine salvato in successOrderId
                  const orderId = successOrderId ? parseInt(successOrderId, 10) : null;
                  
                  if (!orderId) {
                    console.warn('[CHECKOUT] Nota: Nessun ID ordine valido trovato, il riscatto punti sarà gestito internamente');
                    // Continuiamo senza bloccare il flusso, dato che la gestione punti funziona comunque
                    return;
                  }
                  
                  
                  // Chiamata API per riscattare i punti
                  const pointsResponse = await redeemPoints(user.id, pointsToRedeem, orderId, token);
                  
                  if (pointsResponse && pointsResponse.success) {
                    
                    // Rimuovi i punti riscattati dal localStorage
                    localStorage.removeItem('checkout_points_to_redeem');
                    localStorage.removeItem('checkout_points_discount');
                  } else {
                    console.error('[CHECKOUT] Errore nella risposta API riscatto punti:', pointsResponse);
                    throw new Error('Risposta API riscatto punti non valida');
                  }
                } else {
                  console.error('[CHECKOUT] Token JWT mancante, impossibile riscattare i punti');
                  throw new Error('Token JWT mancante');
                }
              } catch (pointsError) {
                console.error('[CHECKOUT] Errore durante il riscatto dei punti:', pointsError);
                // Non blocchiamo il checkout se il riscatto punti fallisce
                // Log dell'errore senza mostrare alert all'utente
              }
            }
            
            // Salva gli indirizzi dell'utente
            await saveAddressData();
            
            // Mostra il messaggio di successo
            setOrderSuccess(true);
            // Per PayPal, l'ID dell'ordine verrà impostato quando viene creato l'ordine in WooCommerce
            // Questo avverrà nella gestione del pagamento PayPal
            
            // Reset del form dopo il successo
            resetFormAfterSuccess();
            
            setIsSubmitting(false);
            setIsStripeLoading(false);
            return;
            
          } catch (iosError) {
            console.error('Errore durante il pagamento su iOS:', iosError);
            setCardError('Si è verificato un errore durante l\'elaborazione del pagamento. Riprova più tardi.');
            setIsStripeLoading(false);
            setIsSubmitting(false);
            return;
          }
        }
        
        // Otteniamo l'elemento carta dopo il reset
        const cardElement = elements.getElement(CardElement);
        
        if (!cardElement) {
          setCardError('Elemento carta non trovato. Riprova più tardi.');
          setIsStripeLoading(false);
          setIsSubmitting(false);
          return;
        }
        
        // Aggiungiamo informazioni di debug per iOS
        if (isIOS) {
          console.log('[CHECKOUT iOS] Preparazione pagamento con carta su iOS');
        }

        // Calcola i punti che saranno assegnati per questo ordine
        const couponDiscount = coupon ? discount : 0;
        const subtotalForPoints = subtotal - couponDiscount - pointsDiscount; // Subtotale meno tutti gli sconti
        const pointsToEarn = Math.floor(Math.max(0, subtotalForPoints)); // 1 euro = 1 punto

        // Prepara i dati dell'ordine (sarà creato dopo il successo del pagamento)
        const orderDataForLater = {
          payment_method: 'stripe',
          payment_method_title: 'Carta di Credito (Stripe)',
          set_paid: false,
          customer_id: customerId || (isAuthenticated && user ? user.id : 0),
          customer_note: formData.notes,
          billing: billingInfo,
          shipping: shippingInfo,
          line_items,
          shipping_lines: [
            {
              method_id: selectedShippingMethod?.id || 'flat_rate',
              method_title: selectedShippingMethod?.title || 'Spedizione standard',
              total: String(shipping)
            }
          ],
          // Aggiungi il coupon se presente
          coupon_lines: coupon ? [
            {
              code: coupon.code,
              discount: String(discount)
            }
          ] : [],
          // Aggiungi metadati
          meta_data: [
            {
              key: '_points_to_earn_frontend',
              value: pointsToEarn.toString()
            }
          ]
        };

        // Calcola il totale dell'ordine includendo lo sconto punti
        const amount = Math.round(total * 100); // in centesimi (include commissione PayPal se applicabile)

        // Crea un payment intent e salva i dati dell'ordine per il webhook
        const response = await fetch('/api/stripe/payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
            orderId: null, // Non passiamo più l'orderId perché l'ordine non esiste ancora
            orderData: orderDataForLater, // Passa i dati dell'ordine per il webhook
            pointsToRedeem: pointsToRedeem,
            pointsDiscount: pointsDiscount
          }),
        });

        const paymentData = await response.json();

        if (paymentData.error) {
          throw new Error(paymentData.error);
        }
        
        // Prepariamo il processo di pagamento
        setIsProcessingPayment(true);
        console.log('Preparazione per il processo di pagamento');
        
        console.log('Confermando il pagamento...');
        
        // Verifichiamo che il CardElement sia pronto prima di procedere
        if (!isCardElementReady) {
          console.log('CardElement non è pronto, attendiamo...');
          // Attendiamo che l'elemento sia pronto prima di procedere
          await new Promise<void>(resolve => {
            const checkInterval = setInterval(() => {
              if (isCardElementReady) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
            // Timeout dopo 5 secondi
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, 5000);
          });
        }
        
        // Dichiariamo la variabile result fuori dal blocco try per renderla accessibile in tutto lo scope
        // Utilizziamo un tipo più flessibile per il risultato di Stripe
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let result: any = {};
        
        try {
          // Configurazione per il pagamento
          const confirmOptions = {
            payment_method: {
              card: cardElement,
              billing_details: {
                name: `${formData.firstName} ${formData.lastName}`,
                email: formData.email,
                phone: formData.phone,
                address: {
                  line1: formData.address1,
                  line2: formData.address2 || '',
                  city: formData.city,
                  state: formData.state,
                  postal_code: formData.postcode,
                  country: formData.country
                }
              }
            }
          };
          
          // Utilizziamo lo stesso approccio per tutti i dispositivi
          console.log('Preparazione conferma pagamento...');
          
          // Approccio semplificato per il pagamento
          console.log('Confermando il pagamento...');
          result = await stripe.confirmCardPayment(
            paymentData.clientSecret,
            confirmOptions
          );
          
          console.log('Risposta da confirmCardPayment:', { 
            error: result.error ? { type: result.error.type, message: result.error.message } : null,
            paymentIntentStatus: result.paymentIntent ? result.paymentIntent.status : 'non disponibile'
          });
        } catch (stripeError) {
          console.error('Errore durante la conferma del pagamento:', stripeError);
          
          // Messaggio di errore generico
          setCardError('Si è verificato un errore durante l\'elaborazione del pagamento. Verifica i dati della carta e riprova.');
          
          setIsStripeLoading(false);
          setIsSubmitting(false);
          setIsProcessingPayment(false);
          return;
        }
        
        // Verifica se c'è stato un errore nel pagamento
        if (result.error) {
          console.error('Errore Stripe:', result.error);
          setCardError(result.error.message || 'Si è verificato un errore durante il pagamento');
          setIsStripeLoading(false);
          setIsSubmitting(false);
          setIsProcessingPayment(false);
          return;
        }
        
        // Verifica se il pagamento è stato completato con successo
        if (result.paymentIntent &&
            typeof result.paymentIntent === 'object' &&
            'status' in result.paymentIntent &&
            result.paymentIntent.status === 'succeeded') {

          console.log('[STRIPE] Pagamento completato con successo, webhook creerà l\'ordine');
          console.log('[STRIPE] Payment Intent ID:', result.paymentIntent.id);

          // Svuota il carrello
          clearCart();

          // Salva gli indirizzi dell'utente
          await saveAddressData();

          // Redirect alla thank you page che attenderà la creazione dell'ordine dal webhook
          router.push(`/checkout/success?payment_intent=${result.paymentIntent.id}&payment_method=stripe`);

          setIsSubmitting(false);
          setIsStripeLoading(false);
          return;
        } else {
          throw new Error('Pagamento non completato');
        }
      }

      // Se il metodo di pagamento è Klarna, gestisci il pagamento tramite Stripe con Klarna
      if (formData.paymentMethod === 'klarna') {
        setIsStripeLoading(true);

        console.log('Inizializzazione pagamento con Klarna...');

        // Se l'utente vuole creare un account, crealo prima del pagamento
        let customerId = undefined;
        if (formData.createAccount && formData.password && !isAuthenticated) {
          try {
            const customerData = {
              email: formData.email,
              first_name: formData.firstName,
              last_name: formData.lastName,
              password: formData.password,
              billing: billingInfo,
              shipping: shippingInfo
            };

            const newCustomer = await createCustomer(customerData);
            customerId = newCustomer.id;
            console.log('Account cliente creato con successo per Klarna:', customerId);
          } catch (error) {
            console.error('Errore nella creazione dell\'account cliente per Klarna:', error);
            setFormError('Si è verificato un errore durante la creazione dell\'account. Riprova con un\'altra email.');
            setIsStripeLoading(false);
            setIsSubmitting(false);
            return;
          }
        }

        // Calcola i punti che saranno assegnati per questo ordine
        const couponDiscount = coupon ? discount : 0;
        const subtotalForPoints = subtotal - couponDiscount - pointsDiscount;
        const pointsToEarn = Math.floor(Math.max(0, subtotalForPoints));
        console.log(`[CHECKOUT KLARNA] CALCOLO PUNTI - Subtotale: €${subtotal.toFixed(2)}, Sconto coupon: €${couponDiscount.toFixed(2)}, Sconto punti: €${pointsDiscount.toFixed(2)}, Valore per punti: €${subtotalForPoints.toFixed(2)} → ${pointsToEarn} punti verranno assegnati`);

        // Prepara i dati dell'ordine (NON lo creiamo ancora, lo creeremo dopo il pagamento)
        const orderData = {
          payment_method: 'klarna',
          payment_method_title: 'Klarna',
          set_paid: false,
          customer_id: customerId || (isAuthenticated && user ? user.id : 0),
          customer_note: formData.notes,
          billing: billingInfo,
          shipping: shippingInfo,
          line_items,
          shipping_lines: [
            {
              method_id: selectedShippingMethod?.id || 'flat_rate',
              method_title: selectedShippingMethod?.title || 'Spedizione standard',
              total: String(shipping)
            }
          ],
          // Aggiungi coupon lines se presenti
          coupon_lines: coupon ? [
            {
              code: coupon.code,
              discount: String(discount)
            }
          ] : [],
          meta_data: [
            { key: '_checkout_points_earned', value: String(pointsToEarn) },
            { key: '_checkout_payment_method', value: 'klarna' },
            { key: '_points_to_earn_frontend', value: String(pointsToEarn) }
          ]
        };

        console.log('Preparazione sessione Klarna con dati ordine:', orderData);

        try {
          // Salva i dati in sessionStorage (come Satispay) per evitare il limite di 500 caratteri dei metadata Stripe
          const klarnaCheckoutData = {
            orderData: orderData,
            pointsToRedeem: pointsToRedeem > 0 ? pointsToRedeem : 0,
            pointsDiscount: pointsDiscount,
            customerId: user?.id || 0
          };

          sessionStorage.setItem('klarna_checkout_data', JSON.stringify(klarnaCheckoutData));

          // Crea la Checkout Session passando anche i dati dell'ordine per il webhook
          const sessionResponse = await fetch('/api/stripe/checkout-klarna', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: Math.round(total * 100),
              orderData: orderData,
              pointsToRedeem: pointsToRedeem > 0 ? pointsToRedeem : 0,
              pointsDiscount: pointsDiscount
            }),
          });

          const sessionData = await sessionResponse.json();

          if (sessionData.error || !sessionData.url) {
            throw new Error(sessionData.error || 'Errore nella creazione della sessione Klarna');
          }

          console.log('Sessione Klarna creata, reindirizzo a:', sessionData.url);

          // Reindirizza alla Checkout Session di Stripe
          window.location.href = sessionData.url;

        } catch (error) {
          console.error('Errore durante il pagamento con Klarna:', error);
          setFormError(error instanceof Error ? error.message : 'Si è verificato un errore durante il pagamento con Klarna');
          setIsStripeLoading(false);
          setIsSubmitting(false);
          return;
        }

        return;
      }

      // Se il metodo di pagamento è Satispay, gestisci il pagamento tramite Stripe con Satispay
      if (formData.paymentMethod === 'satispay') {
        setIsStripeLoading(true);

        console.log('Inizializzazione pagamento con Satispay...');

        // Se l'utente vuole creare un account, crealo prima dell'ordine
        let customerId = undefined;
        if (formData.createAccount && formData.password && !isAuthenticated) {
          try {
            const customerData = {
              email: formData.email,
              first_name: formData.firstName,
              last_name: formData.lastName,
              password: formData.password,
              billing: billingInfo,
              shipping: shippingInfo
            };

            const newCustomer = await createCustomer(customerData);
            customerId = newCustomer.id;
            console.log('Account cliente creato con successo per Satispay:', customerId);
          } catch (error) {
            console.error('Errore nella creazione dell\'account cliente per Satispay:', error);
            setFormError('Si è verificato un errore durante la creazione dell\'account. Riprova con un\'altra email.');
            setIsStripeLoading(false);
            setIsSubmitting(false);
            return;
          }
        }

        // Calcola i punti che saranno assegnati per questo ordine
        const couponDiscount = coupon ? discount : 0;
        const subtotalForPoints = subtotal - couponDiscount - pointsDiscount;
        const pointsToEarn = Math.floor(Math.max(0, subtotalForPoints));
        console.log(`[CHECKOUT SATISPAY] CALCOLO PUNTI - Subtotale: €${subtotal.toFixed(2)}, Sconto coupon: €${couponDiscount.toFixed(2)}, Sconto punti: €${pointsDiscount.toFixed(2)}, Valore per punti: €${subtotalForPoints.toFixed(2)} → ${pointsToEarn} punti verranno assegnati`);

        // Prepara i dati dell'ordine (sarà creato dopo il successo del pagamento)
        const orderData = {
          payment_method: 'satispay',
          payment_method_title: 'Satispay',
          set_paid: false,
          customer_id: customerId || (isAuthenticated && user ? user.id : 0),
          customer_note: formData.notes,
          billing: billingInfo,
          shipping: shippingInfo,
          line_items: cart.map(item => {
            const lineItem: LineItem = {
              product_id: item.product.id,
              quantity: item.quantity
            };

            if (item.variation_id) {
              lineItem.variation_id = item.variation_id;
            }

            if (!lineItem.meta_data) {
              lineItem.meta_data = [];
            }

            if (item.attributes && item.attributes.length > 0) {
              const attributeMeta = item.attributes.map(attr => ({
                key: `pa_${attr.name.toLowerCase().replace(/\s+/g, '-')}`,
                value: attr.option
              }));

              lineItem.meta_data = [...(lineItem.meta_data || []), ...attributeMeta];
            }

            // Aggiungi i metadati dal cart item (es. dati gift card)
            if (item.meta_data && item.meta_data.length > 0) {
              if (!lineItem.meta_data) lineItem.meta_data = [];
              lineItem.meta_data.push(...item.meta_data);
            }

            // Aggiungi i metadati degli acconti se il prodotto li ha
            if (item.product._wc_convert_to_deposit === 'yes') {
              if (!lineItem.meta_data) lineItem.meta_data = [];

              // Aggiungi i metadati degli acconti
              lineItem.meta_data.push(
                { key: '_wc_convert_to_deposit', value: 'yes' },
                { key: '_wc_deposit_type', value: item.product._wc_deposit_type || 'percent' },
                { key: '_wc_deposit_amount', value: item.product._wc_deposit_amount || '40' }
              );

              // Aggiungi il piano di pagamento se presente
              if (item.product._deposit_payment_plan) {
                lineItem.meta_data.push(
                  { key: '_wc_payment_plan', value: item.product._deposit_payment_plan },
                  { key: '_deposit_payment_plan', value: item.product._deposit_payment_plan }
                );
              }
            }

            return lineItem;
          }),
          shipping_lines: selectedShippingMethod ? [{
            method_id: selectedShippingMethod.id || 'flat_rate',
            method_title: selectedShippingMethod.title || 'Spedizione standard',
            total: String(shipping)
          }] : [],
          coupon_lines: coupon ? [{
            code: coupon.code,
            discount: (Math.round(discount * 100) / 100).toString()
          }] : [],
          meta_data: [
            ...(customerId ? [{ key: '_customer_user', value: customerId.toString() }] : []),
            ...(isAuthenticated && user?.id ? [{ key: '_customer_user', value: user.id.toString() }] : []),
            { key: '_checkout_payment_method', value: 'satispay' }
          ]
        };

        console.log('Dati ordine Satispay preparati (sarà creato dopo il pagamento):', orderData);

        try {
          // Crea una descrizione dettagliata con i prodotti del carrello
          const itemsDescription = cart.map(item => {
            const productName = item.product.name;
            const quantity = item.quantity;
            return `${productName} x${quantity}`;
          }).join(', ');

          const orderDescription = `DreamShop - ${itemsDescription}`;

          console.log('📧 Descrizione ordine Satispay che apparirà nella transazione:', orderDescription);

          // Salva i dati dell'ordine in sessionStorage invece di creare l'ordine
          // L'ordine verrà creato solo dopo il successo del pagamento
          const satispayCheckoutData = {
            orderData,
            amount: Math.round(total * 100),
            pointsToRedeem,
            pointsDiscount,
            customerId: customerId || (isAuthenticated && user ? user.id : undefined),
            orderDescription
          };

          sessionStorage.setItem('satispay_checkout_data', JSON.stringify(satispayCheckoutData));

          console.log('[SATISPAY] Dati salvati in sessionStorage, salvataggio nello store...');

          // Salva i dati anche nello store per il webhook
          const storeResponse = await fetch('/api/stripe/store-order-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderData: orderData,
              pointsToRedeem: pointsToRedeem,
              pointsDiscount: pointsDiscount
            }),
          });

          if (!storeResponse.ok) {
            throw new Error('Errore nel salvataggio dei dati dell\'ordine');
          }

          const { dataId } = await storeResponse.json();
          console.log('[SATISPAY] Dati salvati nello store con ID:', dataId);

          // Per Satispay, reindirizza all'hosted payment page di Stripe che gestisce Satispay
          // Passa la descrizione e il dataId come parametri URL (encoded)
          const encodedDescription = encodeURIComponent(orderDescription);
          window.location.href = `/api/stripe/checkout-satispay?amount=${Math.round(total * 100)}&description=${encodedDescription}&dataId=${dataId}`;

        } catch (error) {
          console.error('Errore durante il pagamento con Satispay:', error);
          setFormError(error instanceof Error ? error.message : 'Si è verificato un errore durante il pagamento con Satispay');
          setIsStripeLoading(false);
          setIsSubmitting(false);
          return;
        }

        setIsStripeLoading(false);
        setIsSubmitting(false);
        return;
      }

      // Per altri metodi di pagamento, crea l'ordine direttamente
      
      // Debug: Verifichiamo i dati dell'utente prima di creare l'ordine
      console.log('Dati utente pre-ordine:', isAuthenticated ? {
        id: user?.id,
        email: user?.email,
        username: user?.username,
        // Altri dati per il debug
        userObject: user
      } : 'Non autenticato');
      
      // Prepara l'ID utente esplicitamente
      const customerIdForOrder = isAuthenticated && user && user.id ? parseInt(String(user.id), 10) : 0;
      
      // Log esplicito dell'ID utente prima di creazione ordine
      console.log('CHECKOUT DEBUG - ID UTENTE IMPOSTATO ESPLICITAMENTE:', customerIdForOrder);

      // Calcola i punti che saranno assegnati per questo ordine
      const couponDiscount = coupon ? discount : 0;
      const subtotalForPoints = subtotal - couponDiscount - pointsDiscount; // Subtotale meno tutti gli sconti
      const pointsToEarn = Math.floor(Math.max(0, subtotalForPoints)); // 1 euro = 1 punto
      console.log(`[CHECKOUT] CALCOLO PUNTI - Subtotale: €${subtotal.toFixed(2)}, Sconto coupon: €${couponDiscount.toFixed(2)}, Sconto punti: €${pointsDiscount.toFixed(2)}, Valore per punti: €${subtotalForPoints.toFixed(2)} → ${pointsToEarn} punti verranno assegnati`);

      // Create the order con customer_id come prima proprietà
      const orderData = {
        // Metti customer_id come prima proprietà per assicurarti che sia incluso
        customer_id: customerIdForOrder,
        payment_method: formData.paymentMethod,
        payment_method_title: (formData.paymentMethod as string) === 'stripe' ? 'Carta di credito' : (formData.paymentMethod as string) === 'klarna' ? 'Klarna' : (formData.paymentMethod as string) === 'satispay' ? 'Satispay' : 'PayPal',
        set_paid: false, // Will be set to true after Stripe payment
        billing: billingInfo,
        shipping: shippingInfo,
        line_items: line_items,
        customer_note: formData.notes,
        shipping_lines: [
          {
            method_id: selectedShippingMethod?.id || 'flat_rate',
            method_title: selectedShippingMethod?.title || 'Spedizione Standard',
            total: shipping?.toString() || '0'
          }
        ],
        // Aggiungi il coupon se presente
        coupon_lines: coupon ? [
          {
            code: coupon.code,
            discount: String(discount)
          }
        ] : [],
        // Aggiungi le fee lines (sconto punti e commissione PayPal)
        fee_lines: [
          // Sconto punti se presente
          ...(pointsDiscount > 0 ? [{
            name: `Sconto punti (${pointsToRedeem} punti)`,
            total: String(-pointsDiscount),
            tax_class: '',
            tax_status: 'none'
          }] : []),
          // Commissione PayPal se presente (nota: per Stripe non dovrebbe mai essere aggiunta)
          ...(paypalFee > 0 && formData.paymentMethod === 'paypal' ? [{
            name: 'Commissione PayPal (3.5% + €0.35)',
            total: String(paypalFee),
            tax_class: '',
            tax_status: 'none'
          }] : [])
        ],
        // Aggiungi metadati
        meta_data: [
          {
            key: '_points_to_earn_frontend',
            value: pointsToEarn.toString()
          }
        ]
      };

      // Se l'utente ha selezionato di creare un account, registralo prima di creare l'ordine
      let userId = null;
      if (!isAuthenticated && formData.createAccount) {
        try {
          const registerResponse = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              firstName: formData.firstName,
              lastName: formData.lastName,
              username: formData.email
            }),
          });
          
          if (!registerResponse.ok) {
            throw new Error('Registrazione fallita');
          }
          
          const registerData = await registerResponse.json();
          userId = registerData.user.id;
          
          // Aggiorna l'ID cliente nell'ordine
          orderData.customer_id = userId;
        } catch (error) {
          console.error('Errore durante la registrazione dell\'utente:', error);
          setFormError('Si è verificato un errore durante la creazione dell\'account. L\'ordine verrà processato come ospite.');
          // Continua con l'ordine anche se la registrazione fallisce
        }
      }
      
      // Prepariamo l'ID utente da passare separatamente
      const userIdForWooCommerce = isAuthenticated && user && user.id ? parseInt(String(user.id), 10) : 0;
      
      // Log dettagliato dell'orderData prima di inviare a WooCommerce
      console.log('CHECKOUT DEBUG - Dati ordine inviati a WooCommerce:', {
        customer_id_separato: userIdForWooCommerce, // ID che passeremo separatamente
        payment_method: orderData.payment_method,
        email: orderData.billing?.email
      });

      // Send the order to WooCommerce (l'ID utente viene recuperato direttamente nella funzione)
      const order = await createOrder(orderData);
      
      // Log della risposta (con type safety)
      console.log('CHECKOUT DEBUG - Risposta da WooCommerce:', {
        order_id: order && typeof order === 'object' && 'id' in order ? order.id : 'non disponibile',
        order_type: order ? typeof order : 'undefined',
        order_keys: order && typeof order === 'object' ? Object.keys(order) : []  // Questo ci mostrerà quali chiavi sono disponibili
      });
      
      // Check if order is valid and has an id property
      if (order && typeof order === 'object' && 'id' in order) {
        // Clear the cart after successful order
        clearCart();
        
        // Riscatta i punti se necessario (per metodi di pagamento alternativi)
        if (pointsToRedeem > 0 && user) {
          try {
            // Recupera il token JWT da localStorage
            const token = localStorage.getItem('woocommerce_token');
            if (token) {
              // Verifica che l'ID ordine sia valido
              if (!order.id) {
                console.error('[CHECKOUT ALTRI] Errore: Impossibile riscattare i punti senza un ID ordine valido');
                // Non blocchiamo il checkout, ma logghiamo l'errore
              } else {
                console.log(`[CHECKOUT ALTRI] Inizia riscatto ${pointsToRedeem} punti per l'utente ${user.id}, ordine #${order.id}`);
                
                // Chiamata API per riscattare i punti
                const pointsResponse = await redeemPoints(user.id, pointsToRedeem, order.id, token);
                
                if (pointsResponse && pointsResponse.success) {
                  console.log(`[CHECKOUT ALTRI] Riscatto punti completato con successo: ${pointsToRedeem} punti per l'utente ${user.id}, ordine #${order.id}`);
                  
                  // Rimuovi i punti riscattati dal localStorage
                  localStorage.removeItem('checkout_points_to_redeem');
                  localStorage.removeItem('checkout_points_discount');
                } else {
                  console.error('[CHECKOUT ALTRI] Errore nella risposta API riscatto punti:', pointsResponse);
                }
              }
            } else {
              console.error('[CHECKOUT ALTRI] Token JWT mancante, impossibile riscattare i punti');
            }
          } catch (pointsError) {
            console.error('[CHECKOUT ALTRI] Errore durante il riscatto dei punti:', pointsError);
            // Non blocchiamo il checkout se il riscatto punti fallisce
          }
        }
        
        // Redirect to success page with order ID
        router.push(`/checkout/success?order_id=${order.id}`);
      }
    } catch (error) {
      console.error('Error processing order:', error);
      setFormError('Si è verificato un errore durante l\'elaborazione dell\'ordine. Riprova più tardi.');
    } finally {
      setIsSubmitting(false);
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      
      <main className="flex-grow py-8 bg-white">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8 text-gray-900">Checkout</h1>
          
          {/* Il messaggio di conferma dell'ordine è stato spostato all'interno del form */}
          
          {!isAuthenticated && (
            <div className="mb-6 p-4 bg-bred-100 text-bred-500 rounded-md">
              <p>Hai già un account? <Link href="/login?redirect=/checkout" className="font-bold underline">Accedi</Link> per velocizzare il checkout.</p>
            </div>
          )}
          
          {formError && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
              {formError}
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Checkout Form */}
            <div className="lg:col-span-2">
              <form id="checkout-form" onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-6 text-gray-900">Informazioni di Fatturazione e Spedizione</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      Nome *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Cognome *
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                      required
                    />
                  </div>
                </div>
                
                <div className="mb-6">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                    required
                  />
                </div>
                
                <div className="mb-6">
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Telefono *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                    required
                  />
                </div>
                
                <div className="mb-6">
                  <label htmlFor="address1" className="block text-sm font-medium text-gray-700 mb-1">
                    Indirizzo *
                  </label>
                  <input
                    type="text"
                    id="address1"
                    name="address1"
                    value={formData.address1}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                    required
                  />
                </div>
                
                <div className="mb-6">
                  <label htmlFor="address2" className="block text-sm font-medium text-gray-700 mb-1">
                    Indirizzo 2 (opzionale)
                  </label>
                  <input
                    type="text"
                    id="address2"
                    name="address2"
                    value={formData.address2}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                      Città *
                    </label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                      Provincia *
                    </label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="postcode" className="block text-sm font-medium text-gray-700 mb-1">
                      CAP *
                    </label>
                    <input
                      type="text"
                      id="postcode"
                      name="postcode"
                      value={formData.postcode}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                      required
                    />
                  </div>
                </div>
                
                <div className="mb-6">
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                    Paese *
                  </label>
                  <select
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                    required
                    disabled={countriesLoading}
                  >
                    {countriesLoading ? (
                      <option value="">Caricamento paesi...</option>
                    ) : availableCountries.length > 0 ? (
                      availableCountries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))
                    ) : (
                      <option value="IT">Italia</option>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={handleCalculateShipping}
                    disabled={isCalculatingShipping || countriesLoading}
                    className="mt-3 w-full bg-bred-500 text-white py-2 px-4 rounded-md hover:bg-bred-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isCalculatingShipping ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Calcolo in corso...
                      </>
                    ) : (
                      'Calcola Spedizione'
                    )}
                  </button>
                </div>

                <div className="mb-6">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="shipToDifferentAddress"
                      name="shipToDifferentAddress"
                      checked={formData.shipToDifferentAddress}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setFormData(prev => ({
                          ...prev,
                          shipToDifferentAddress: isChecked,
                          // Se l'opzione è selezionata, inizializza i campi di spedizione con i dati di fatturazione
                          ...(isChecked && {
                            shippingFirstName: prev.firstName,
                            shippingLastName: prev.lastName,
                            shippingAddress1: prev.address1,
                            shippingAddress2: prev.address2,
                            shippingCity: prev.city,
                            shippingState: prev.state,
                            shippingPostcode: prev.postcode,
                            shippingCountry: prev.country,
                            shippingPhone: prev.phone
                          })
                        }));
                      }}
                      className="h-4 w-4 text-bred-500 focus:ring-bred-500 border-gray-300 rounded"
                    />
                    <label htmlFor="shipToDifferentAddress" className="ml-2 block text-sm font-medium text-gray-700">
                      Spedire ad un indirizzo differente?
                    </label>
                  </div>
                </div>
                
                
                {/* Campi per l'indirizzo di spedizione (mostrati solo se shipToDifferentAddress è true) */}
                {formData.shipToDifferentAddress && (
                  <div className="mt-8 mb-6 border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900">Indirizzo di Spedizione</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label htmlFor="shippingFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                          Nome *
                        </label>
                        <input
                          type="text"
                          id="shippingFirstName"
                          name="shippingFirstName"
                          value={formData.shippingFirstName}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                          required={formData.shipToDifferentAddress}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="shippingLastName" className="block text-sm font-medium text-gray-700 mb-1">
                          Cognome *
                        </label>
                        <input
                          type="text"
                          id="shippingLastName"
                          name="shippingLastName"
                          value={formData.shippingLastName}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                          required={formData.shipToDifferentAddress}
                        />
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <label htmlFor="shippingAddress1" className="block text-sm font-medium text-gray-700 mb-1">
                        Indirizzo *
                      </label>
                      <input
                        type="text"
                        id="shippingAddress1"
                        name="shippingAddress1"
                        value={formData.shippingAddress1}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                        required={formData.shipToDifferentAddress}
                      />
                    </div>
                    
                    <div className="mb-6">
                      <label htmlFor="shippingAddress2" className="block text-sm font-medium text-gray-700 mb-1">
                        Indirizzo 2 (opzionale)
                      </label>
                      <input
                        type="text"
                        id="shippingAddress2"
                        name="shippingAddress2"
                        value={formData.shippingAddress2}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div>
                        <label htmlFor="shippingCity" className="block text-sm font-medium text-gray-700 mb-1">
                          Città *
                        </label>
                        <input
                          type="text"
                          id="shippingCity"
                          name="shippingCity"
                          value={formData.shippingCity}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                          required={formData.shipToDifferentAddress}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="shippingState" className="block text-sm font-medium text-gray-700 mb-1">
                          Provincia *
                        </label>
                        <input
                          type="text"
                          id="shippingState"
                          name="shippingState"
                          value={formData.shippingState}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                          required={formData.shipToDifferentAddress}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="shippingPostcode" className="block text-sm font-medium text-gray-700 mb-1">
                          CAP *
                        </label>
                        <input
                          type="text"
                          id="shippingPostcode"
                          name="shippingPostcode"
                          value={formData.shippingPostcode}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                          required={formData.shipToDifferentAddress}
                        />
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <label htmlFor="shippingCountry" className="block text-sm font-medium text-gray-700 mb-1">
                        Paese *
                      </label>
                      <select
                        id="shippingCountry"
                        name="shippingCountry"
                        value={formData.shippingCountry}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                        required={formData.shipToDifferentAddress}
                        disabled={countriesLoading}
                      >
                        {countriesLoading ? (
                          <option value="">Caricamento paesi...</option>
                        ) : availableCountries.length > 0 ? (
                          availableCountries.map((country) => (
                            <option key={country.code} value={country.code}>
                              {country.name}
                            </option>
                          ))
                        ) : (
                          <option value="IT">Italia</option>
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={handleCalculateShipping}
                        disabled={isCalculatingShipping || countriesLoading}
                        className="mt-3 w-full bg-bred-500 text-white py-2 px-4 rounded-md hover:bg-bred-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {isCalculatingShipping ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Calcolo in corso...
                          </>
                        ) : (
                          'Calcola Spedizione'
                        )}
                      </button>
                    </div>

                    <div className="mb-6">
                      <label htmlFor="shippingPhone" className="block text-sm font-medium text-gray-700 mb-1">
                        Telefono *
                      </label>
                      <input
                        type="tel"
                        id="shippingPhone"
                        name="shippingPhone"
                        value={formData.shippingPhone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                        required={formData.shipToDifferentAddress}
                      />
                    </div>
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-gray-700">Metodo di Pagamento</h3>
                  
                  {/* Apple Pay / Google Pay */}
                  <AppleGooglePayCheckout
                    billingData={{
                      firstName: formData.firstName,
                      lastName: formData.lastName,
                      email: formData.email,
                      phone: formData.phone,
                      address1: formData.address1,
                      address2: formData.address2,
                      city: formData.city,
                      state: formData.state,
                      postcode: formData.postcode,
                      country: formData.country
                    }}
                    shippingData={formData.shipToDifferentAddress ? {
                      firstName: formData.shippingFirstName,
                      lastName: formData.shippingLastName,
                      phone: formData.shippingPhone,
                      address1: formData.shippingAddress1,
                      address2: formData.shippingAddress2,
                      city: formData.shippingCity,
                      state: formData.shippingState,
                      postcode: formData.shippingPostcode,
                      country: formData.shippingCountry
                    } : undefined}
                    onPaymentStart={() => {
                      setIsSubmitting(true);
                      setFormError(null);
                    }}
                    onPaymentError={(error) => {
                      setFormError(error);
                      setIsSubmitting(false);
                    }}
                    className="mb-6"
                  />
                  
                  <div className="space-y-2">
                    
                    <div>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="paypal"
                          checked={formData.paymentMethod === 'paypal'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        <span className="text-gray-700">PayPal</span>
                      </label>
                      {formData.paymentMethod === 'paypal' && (
                        <div className="mt-2 pl-6 text-sm text-gray-600">
                          <p>Paga in modo sicuro tramite PayPal. Non è necessario avere un account PayPal, puoi pagare anche con la tua carta di credito.</p>
                          {showPayPalButtons && paypalOrderData && (
                            <div className="mt-4">
                              <PayPalButtons
                                style={{ layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' }}
                                createOrder={async (_data, actions) => {
                                  try {
                                    // Crea l'ordine PayPal direttamente dal client senza creare l'ordine WooCommerce
                                    // L'ordine WooCommerce verrà creato solo dopo il successo del pagamento in onApprove

                                    // Crea una descrizione dettagliata con i prodotti del carrello
                                    const itemsDescription = cart.map(item => {
                                      const productName = item.product.name;
                                      const quantity = item.quantity;
                                      return `${productName} x${quantity}`;
                                    }).join(', ');

                                    const orderDescription = `DreamShop - ${itemsDescription}`;


                                    return actions.order.create({
                                      intent: 'CAPTURE',
                                      purchase_units: [
                                        {
                                          amount: {
                                            currency_code: 'EUR',
                                            value: total.toFixed(2)
                                          },
                                          description: orderDescription
                                        }
                                      ]
                                    });
                                  } catch (error) {
                                    console.error('Errore nella creazione dell\'ordine PayPal:', error);
                                    setFormError('Si è verificato un errore durante la creazione dell\'ordine. Riprova più tardi.');
                                    return '';
                                  }
                                }}
                                onApprove={async (data, actions) => {
                                  try {
                                    console.log('Pagamento PayPal approvato:', data);

                                    // Utilizziamo l'SDK PayPal per catturare il pagamento lato client
                                    if (actions.order) {
                                      try {
                                        const captureResult = await actions.order.capture();
                                        console.log('Pagamento catturato con successo:', captureResult);

                                        // Estrai l'ID della transazione PayPal
                                        const transactionId = captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.id || data.orderID;

                                        // Estrai l'importo effettivamente pagato da PayPal (fonte di verità)
                                        const actualPaidAmount = parseFloat(
                                          captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ||
                                          captureResult.purchase_units?.[0]?.amount?.value ||
                                          '0'
                                        );

                                        console.log('[PAYPAL-CHECKOUT] Importo effettivamente pagato:', actualPaidAmount);

                                        // Ora crea l'ordine WooCommerce dopo il successo del pagamento
                                        const response = await fetch('/api/paypal/create-order-after-payment', {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                          },
                                          body: JSON.stringify({
                                            orderData: paypalOrderData,
                                            paypalOrderId: data.orderID,
                                            paypalTransactionId: transactionId,
                                            expectedTotal: actualPaidAmount // Usa l'importo da PayPal (già verificato e addebitato)
                                          }),
                                        });

                                        const createData = await response.json();

                                        if (!createData.success || !createData.orderId) {
                                          throw new Error(createData.error || 'Errore nella creazione dell\'ordine WooCommerce');
                                        }


                                        // Salva l'ID dell'ordine per riferimento
                                        setSuccessOrderId(String(createData.orderId));

                                        // Svuota il carrello
                                        clearCart();

                                        // Riscatta i punti se necessario
                                        if (pointsToRedeem > 0 && user) {
                                          try {
                                            const token = localStorage.getItem('woocommerce_token');
                                            if (token) {
                                              await redeemPoints(user.id, pointsToRedeem, createData.orderId, token);
                                              console.log(`Riscattati ${pointsToRedeem} punti per l'utente ${user.id}`);

                                              // Rimuovi i punti riscattati dal localStorage
                                              localStorage.removeItem('checkout_points_to_redeem');
                                              localStorage.removeItem('checkout_points_discount');
                                            }
                                          } catch (pointsError) {
                                            console.error('Errore durante il riscatto dei punti:', pointsError);
                                            // Non blocchiamo il checkout se il riscatto punti fallisce
                                          }
                                        }

                                        // Salva gli indirizzi dell'utente
                                        await saveAddressData();

                                        // Mostra il messaggio di successo
                                        setOrderSuccess(true);

                                        // Reset del form dopo il successo
                                        resetFormAfterSuccess();

                                        setIsSubmitting(false);
                                      } catch (captureError) {
                                        console.error('Errore durante la cattura del pagamento:', captureError);
                                        throw new Error('Errore durante la cattura del pagamento');
                                      }
                                    } else {
                                      throw new Error('Oggetto actions.order non disponibile');
                                    }
                                  } catch (error) {
                                    console.error('Errore nella gestione del pagamento PayPal:', error);
                                    setFormError('Si è verificato un errore durante la finalizzazione del pagamento. Contatta il supporto clienti.');
                                    setIsSubmitting(false);
                                    setIsProcessingPayment(false);
                                  }
                                }}
                                onError={(err) => {
                                  console.error('Errore PayPal:', err);
                                  setFormError('Si è verificato un errore durante il pagamento con PayPal. Riprova più tardi.');
                                  setIsSubmitting(false);
                                  setIsProcessingPayment(false);
                                }}
                                onCancel={() => {
                                  console.log('Pagamento PayPal annullato dall\'utente');
                                  setFormError('Pagamento annullato. Puoi riprovare quando vuoi.');
                                  setIsSubmitting(false);
                                  setIsProcessingPayment(false);
                                  setShowPayPalButtons(false);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Klarna - Disabilitato se ci sono prodotti con rate nel carrello */}
                    {!hasDepositProducts && (
                      <div>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="klarna"
                            checked={formData.paymentMethod === 'klarna'}
                            onChange={handleInputChange}
                            className="mr-2"
                          />
                          <span className="text-gray-700">Klarna - Paga in 3 rate</span>
                        </label>
                        {formData.paymentMethod === 'klarna' && (
                          <div className="mt-2 pl-6 text-sm text-gray-600">
                            <p>Paga in 3 rate senza interessi con Klarna. Completa l&apos;acquisto ora e ricevi la merce immediatamente.</p>
                            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                              <div className="flex items-center text-blue-700">
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium">Paga subito solo 1/3 dell&apos;importo</span>
                              </div>
                              <p className="text-xs text-blue-600 mt-1">Le rate rimanenti verranno addebitate automaticamente ogni 30 giorni</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="satispay"
                          checked={formData.paymentMethod === 'satispay'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        <span className="text-gray-700">Satispay</span>
                      </label>
                      {formData.paymentMethod === 'satispay' && (
                        <div className="mt-2 pl-6 text-sm text-gray-600">
                          <p>Paga facilmente con la tua app Satispay. Sicuro, veloce e senza commissioni.</p>
                          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                            <div className="flex items-center text-red-700">
                              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm font-medium">Pagamento immediato e sicuro</span>
                            </div>
                            <p className="text-xs text-red-600 mt-1">Avrai bisogno dell&apos;app Satispay per completare il pagamento</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="stripe"
                          checked={formData.paymentMethod === 'stripe'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        <span className="text-gray-700">Carta di Credito</span>
                      </label>
                      {formData.paymentMethod === 'stripe' && (
                        <div className="mt-2 pl-6 text-sm text-gray-600">
                          {/* Utilizziamo pointer-events: none per le label su iOS come consigliato da Stripe */}
                          <p className={`mb-2 ${isIOS ? 'pointer-events-none' : ''}`}>Inserisci i dati della tua carta di credito:</p>
                          <div 
                            className={`p-3 border border-gray-300 rounded-md bg-white ${isIOS ? 'ios-payment-element' : ''}`}
                            onClick={() => {
                              // Forziamo un reflow del DOM quando l'utente clicca sull'elemento su iOS
                              if (isIOS && typeof document !== 'undefined') {
                                console.log('Forzando reflow su click del CardElement');
                                document.body.style.zoom = '0.99';
                                setTimeout(() => { document.body.style.zoom = '1'; }, 10);
                              }
                            }}
                          >
                            {/* Su iOS, utilizziamo un approccio più semplice e diretto come consigliato da Stripe */}
                            <div className={isIOS ? 'ios-stripe-wrapper' : ''}>
                              <CardElement
                                id="card-element"
                                options={{
                                  style: {
                                    base: {
                                      fontSize: '16px',
                                      color: '#424770',
                                      '::placeholder': {
                                        color: '#aab7c4',
                                      },
                                      // Miglioramenti per iOS
                                      iconColor: '#666EE8',
                                      fontWeight: '500',
                                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                    },
                                    invalid: {
                                      color: '#E25950',
                                    },
                                  },
                                  // Opzioni specifiche per iOS
                                  hidePostalCode: true,
                                  iconStyle: 'solid',
                                }}
                                onChange={(event) => {
                                  // Gestiamo esplicitamente gli eventi di cambiamento
                                  if (event.error) {
                                    setCardError(event.error.message);
                                  } else {
                                    setCardError(null);
                                  }
                                  
                                  // Aggiorniamo lo stato di prontezza dell'elemento
                                  setIsCardElementReady(event.complete);
                                  
                                  // Log per debugging
                                  console.log('Stato CardElement:', {
                                    complete: event.complete,
                                    empty: event.empty,
                                    error: event.error ? event.error.message : null,
                                    brand: event.brand,
                                  });
                                }}
                                onReady={() => {

                                  setIsCardElementReady(true);
                                  
                                  // Su iOS, forziamo un reflow quando l'elemento è pronto
                                  if (isIOS && typeof document !== 'undefined') {
                                    setTimeout(() => {
                                      document.body.style.zoom = '0.99';
                                      setTimeout(() => { document.body.style.zoom = '1'; }, 10);
                                    }, 100);
                                  }
                                }}
                              />
                            </div>
                            
                            {/* Aggiungiamo un elemento invisibile per forzare il reflow su iOS */}
                            {isIOS && <div style={{ height: '1px', width: '1px', opacity: 0 }} aria-hidden="true"></div>}
                          </div>
                          {cardError && (
                            <div className="mt-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                              <div className="flex items-center">
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {cardError}
                              </div>
                            </div>
                          )}
                          {isIOS && (
                            <p className="text-gray-500 text-xs mt-2">
                              <svg className="w-3 h-3 inline-block mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              Per una migliore esperienza su iOS, assicurati di compilare tutti i campi correttamente.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mb-6 hidden">
                  <h3 className="text-lg font-semibold mb-2 text-gray-700">Metodo di Spedizione</h3>
                  <div className="space-y-3">
                    {shippingMethods.length > 0 ? (
                      shippingMethods.map((method) => (
                        <div key={method.id} className="flex items-start">
                          <input
                            type="radio"
                            id={`shipping-${method.id}`}
                            name="shipping-method"
                            className="mt-1 mr-2"
                            checked={selectedShippingMethod?.id === method.id}
                            onChange={() => setSelectedShippingMethod(method)}
                          />
                          <label htmlFor={`shipping-${method.id}`} className="flex-grow cursor-pointer">
                            <div className="flex justify-between">
                              <span className="font-medium">{method.title}</span>
                              <span className="font-medium">
                                {method.free_shipping ? 'Gratuita' : `€${method.cost.toFixed(2)}`}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">{method.description}</p>
                          </label>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 italic">
                        {shippingCalculated ? 
                          'Nessun metodo di spedizione disponibile per questo indirizzo' : 
                          'Inserisci l\'indirizzo di spedizione per vedere le opzioni disponibili'}
                      </p>
                    )}
                  </div>
                </div>
                
                
                {/* Opzione per creare un account (solo per utenti non autenticati) */}
                {!isAuthenticated && (
                  <div className="mb-6">
                    <div className="flex items-center">
                      <input
                        id="createAccount"
                        name="createAccount"
                        type="checkbox"
                        checked={formData.createAccount}
                        onChange={(e) => setFormData({...formData, createAccount: e.target.checked})}
                        className="h-4 w-4 text-bred-500 focus:ring-bred-500 border-gray-300 rounded"
                      />
                      <label htmlFor="createAccount" className="ml-2 block text-sm text-gray-900">
                        Crea un account per tracciare i tuoi ordini
                      </label>
                    </div>
                    
                    {formData.createAccount && (
                      <div className="mt-3">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                          Password *
                        </label>
                        <input
                          type="password"
                          id="password"
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-bred-500 focus:border-bred-500 sm:text-sm"
                          required={formData.createAccount}
                          minLength={6}
                        />
                        <p className="text-xs text-gray-500 mt-1">La password deve essere di almeno 6 caratteri.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Checkbox per accettare i termini e condizioni */}
                <div className="mb-6">
                  <div className="flex items-start">
                    <input
                      id="acceptTerms"
                      name="acceptTerms"
                      type="checkbox"
                      checked={formData.acceptTerms}
                      onChange={(e) => {
                        setFormData({...formData, acceptTerms: e.target.checked});
                        if (e.target.checked) {
                          setTermsError(null);
                        }
                      }}
                      className="h-4 w-4 text-bred-500 focus:ring-bred-500 border-gray-300 rounded mt-1"
                    />
                    <label htmlFor="acceptTerms" className="ml-2 block text-sm text-gray-900">
                      Accetto i{' '}
                      <a
                        href="/termini-vendita"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-bred-500 hover:text-bred-700 underline"
                      >
                        termini e condizioni
                      </a>
                      {' '}di vendita *
                    </label>
                  </div>
                  {termsError && (
                    <div className="mt-2 text-sm text-red-600">
                      {termsError}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isStripeLoading || isProcessingPayment || cart.length === 0 || orderSuccess}
                  className={`w-full py-3 px-4 rounded-md text-white font-medium ${(isSubmitting || isStripeLoading || isProcessingPayment || orderSuccess) ? 'bg-gray-400 cursor-not-allowed' : 'bg-bred-500 hover:bg-bred-700'}`}
                >
                  {orderSuccess ? 'Ordine Completato ✓' :
                   isSubmitting ? 'Elaborazione...' :
                   isStripeLoading ? 'Reindirizzamento a Stripe...' :
                   isProcessingPayment ? 'Preparazione pagamento...' :
                   'Effettua Ordine'}
                </button>
                
                {/* Link di navigazione rapida sotto il pulsante quando l'ordine è completato */}
                {orderSuccess && (
                  <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                    <button 
                      onClick={() => {
                        // Se abbiamo successOrderId, naviga ai dettagli, altrimenti vai all'account
                        const targetUrl = successOrderId 
                          ? `/checkout/success?order_id=${successOrderId}`
                          : '/account?tab=orders';
                        window.location.href = targetUrl;
                      }}
                      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-bred-600 bg-white border border-bred-600 rounded-md hover:bg-bred-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bred-500 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {successOrderId ? 'Visualizza Ordine' : 'I Miei Ordini'}
                    </button>
                    <button 
                      onClick={() => {
                        window.location.href = '/';
                      }}
                      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Torna alla Home
                    </button>
                  </div>
                )}
                
                {/* Messaggio di conferma dell'ordine */}
                {orderSuccess && (
                  <div className="mt-6 p-6 bg-green-100 text-green-800 rounded-lg shadow-md">
                    <div className="flex items-center mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <h2 className="text-2xl font-bold">Ordine Completato con Successo!</h2>
                    </div>
                    <p className="text-lg mb-2">Grazie per il tuo acquisto. Il tuo ordine è stato elaborato correttamente.</p>
                    {successOrderId && (
                      <p className="mb-2">Numero Ordine: <span className="font-semibold">{successOrderId}</span></p>
                    )}
                    <p className="text-sm">Riceverai presto un&apos;email di conferma con i dettagli del tuo ordine.</p>
                  </div>
                )}
              </form>
            </div>
            
            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Riepilogo Ordine</h2>
                
                {cart.length === 0 ? (
                  <p className="text-gray-500 mb-4">Il tuo carrello è vuoto.</p>
                ) : (
                  <div className="mb-6">
                    <div className="space-y-3 mb-4 text-gray-700">

                        
                      {cart.map(item => {
                        const itemPrice = parseFloat(item.product.price || item.product.regular_price || '0');
                        const itemTotal = itemPrice * item.quantity;
                        
                        return (
                          <div key={item.product.id} className="flex justify-between">
                            <div>
                              <span className="font-medium">{item.product.name}</span>
                              <span className="text-gray-600"> × {item.quantity}</span>
                            </div>
                            <span>{formatPrice(itemTotal)}</span>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotale</span>
                        <span className="text-gray-700">{formatPrice(subtotal)}</span>
                      </div>
                      
                      {discount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span className="flex items-center">
                            Sconto{coupon && ` (${coupon.code})`}
                          </span>
                          <span>-{formatPrice(discount)}</span>
                        </div>
                      )}
                      
                      {pointsDiscount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span className="flex items-center">
                            Sconto punti ({pointsToRedeem} punti)
                          </span>
                          <span>-{formatPrice(pointsDiscount)}</span>
                        </div>
                      )}

                      {/* Mostra i punti che saranno assegnati */}
                      {isAuthenticated && user && (
                        <div className="flex justify-between text-bred-500 bg-bred-50 p-2 rounded">
                          <span className="flex items-center text-sm font-medium">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            Punti che guadagnerai
                          </span>
                          <span className="text-sm font-medium">
                            {Math.floor(Math.max(0, subtotal - (coupon ? discount : 0) - pointsDiscount))} punti
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between">
                        <span className="text-gray-600">Spedizione</span>
                        {selectedShippingMethod ? (
                          <span>
                            {selectedShippingMethod.free_shipping ? 'Gratuita' : `€${selectedShippingMethod.cost.toFixed(2)}`}
                          </span>
                        ) : (
                          <span className="italic text-bred-500 font-medium">
                            Calcola spedizione
                          </span>
                        )}
                      </div>

                      {/* Commissione PayPal se selezionato */}
                      {formData.paymentMethod === 'paypal' && paypalFee > 0 && (
                        <div className="flex justify-between text-bred-600">
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                            PayPal fee
                          </span>
                          <span>{formatPrice(paypalFee)}</span>
                        </div>
                      )}

                      <div className="flex justify-between font-bold text-lg pt-2 border-t text-gray-700">
                        <span>Totale</span>
                        <span>{formatPrice(total)}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-4">
                  <Link href="/cart" className="text-bred-500 hover:text-bred-700 text-sm">
                    ← Torna al carrello
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
    </div>
  );
}