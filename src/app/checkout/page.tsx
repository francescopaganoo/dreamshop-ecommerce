'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

import { createOrder, getShippingMethods, ShippingMethod } from '../../lib/api';
import { addOrderPoints } from '../../lib/points';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, getCartTotal, clearCart, coupon, discount } = useCart();
  const { isAuthenticated, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  
  // Hook di Stripe
  const stripe = useStripe();
  const elements = useElements();
  const [cardError, setCardError] = useState<string | null>(null);
  
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
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isSafari = typeof navigator !== 'undefined' && /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);
  
  // Stato per tenere traccia del processo di pagamento
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  // Stato per tenere traccia se il CardElement è pronto
  const [isCardElementReady, setIsCardElementReady] = useState(false);
  
  // Log per debugging
  useEffect(() => {
    console.log('Ambiente di esecuzione:', {
      isIOS,
      isSafari,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'non disponibile',
      stripeDisponibile: !!stripe,
      elementsDisponibile: !!elements
    });
    
    // Configurazione specifica per iOS
    if (isIOS && stripe && elements) {
      console.log('Applicando configurazioni iniziali per iOS');
      
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
          console.log('Pagina tornata visibile su iOS, riapplicando fix');
          applyIOSFix();
        }
      });
    }
  }, [stripe, elements, isIOS, isSafari]);
  
  // Form state
  const [formData, setFormData] = useState({
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
    paymentMethod: 'bacs', // Default to direct bank transfer (other options: 'stripe', 'cod')
    notes: '',
    createAccount: false,
    password: '',
    shipToDifferentAddress: false,
    shippingFirstName: '',
    shippingLastName: '',
    shippingAddress1: '',
    shippingAddress2: '',
    shippingCity: '',
    shippingState: '',
    shippingPostcode: '',
    shippingCountry: 'IT',
    shippingPhone: ''
  });
  
  // Stato per il pagamento Stripe
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  
  // Precompila i dati dell'utente se autenticato
  useEffect(() => {
    if (isAuthenticated && user) {
      setFormData(prev => ({
        ...prev,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || ''
      }));
    }
  }, [isAuthenticated, user]);
  
  // Calculate totals
  const subtotal = getCartTotal() + discount; // Aggiungiamo lo sconto al subtotale perché getCartTotal() restituisce già il valore scontato
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<ShippingMethod | null>(null);
  const [shippingCalculated, setShippingCalculated] = useState<boolean>(false);
  const shipping = selectedShippingMethod ? selectedShippingMethod.cost : 0;
  const total = (subtotal - discount) + shipping; // Sottraiamo lo sconto dal totale
  
  // Format price with currency symbol
  const formatPrice = (price: number) => {
    return `€${price.toFixed(2)}`;
  };
  
  // Handle form input changes
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);
    
    // Calcola il costo di spedizione quando vengono modificati i campi dell'indirizzo
    const addressFields = ['country', 'state', 'postcode', 'city', 'address1', 'address2'];
    if (addressFields.includes(name) && 
        newFormData.country && 
        newFormData.state && 
        newFormData.postcode && 
        newFormData.city && 
        newFormData.address1) {
      
      // Evita di calcolare la spedizione troppo frequentemente
      // Utilizziamo un debounce per evitare troppe chiamate API
      if (shippingDebounceTimerRef.current) {
        clearTimeout(shippingDebounceTimerRef.current);
      }
      
      shippingDebounceTimerRef.current = setTimeout(async () => {
        try {
          console.log(`Calcolo spedizione per ${newFormData.country} su ${isIOS ? 'iOS' : 'altro dispositivo'}`);
          
          // Prepara l'indirizzo di spedizione
          const shippingAddress = {
            first_name: newFormData.firstName,
            last_name: newFormData.lastName,
            address_1: newFormData.address1,
            address_2: newFormData.address2 || '',
            city: newFormData.city,
            state: newFormData.state,
            postcode: newFormData.postcode,
            country: newFormData.country,
          };
          
          console.log(`Recupero metodi di spedizione per indirizzo: ${JSON.stringify(shippingAddress)}`);
          
          // Calcola il totale del carrello senza spedizione per verificare la spedizione gratuita
          const cartTotal = subtotal - discount;
          
          // Ottieni i metodi di spedizione disponibili
          const availableMethods = await getShippingMethods(shippingAddress, cartTotal);
          console.log(`Metodi di spedizione disponibili: ${availableMethods.length}`);
          
          // Imposta i metodi di spedizione disponibili
          setShippingMethods(availableMethods);
          
          // Seleziona il primo metodo disponibile come predefinito
          if (availableMethods.length > 0) {
            setSelectedShippingMethod(availableMethods[0]);
          }
          
          setShippingCalculated(true);
        } catch (error) {
          console.error('Errore nel calcolo della spedizione:', error);
          // Fallback in caso di errore: imposta un metodo predefinito
          console.error('Errore nel recupero dei metodi di spedizione:', error);
          const defaultMethod = {
            id: 'flat_rate',
            title: 'Spedizione standard',
            description: 'Consegna in 3-5 giorni lavorativi',
            cost: 7.00
          };
          setShippingMethods([defaultMethod]);
          setSelectedShippingMethod(defaultMethod);
          setShippingCalculated(true);
        }
      }, 500); // Attendi 500ms prima di calcolare la spedizione
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cart.length === 0) {
      setFormError('Il tuo carrello è vuoto. Aggiungi prodotti prima di procedere al checkout.');
      return;
    }
    
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
          
          // Aggiungi gli attributi se presenti
          if (item.attributes && item.attributes.length > 0) {
            // Formatta gli attributi nel formato richiesto da WooCommerce
            lineItem.meta_data = item.attributes.map(attr => ({
              key: `pa_${attr.name.toLowerCase().replace(/\s+/g, '-')}`,
              value: attr.option
            }));
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
        
        // Prepara i dati dell'ordine
        const orderData = {
          payment_method: 'paypal',
          payment_method_title: 'PayPal',
          set_paid: false,
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
          ] : []
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
      
      // Prepare line items for the order
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
        
        // Aggiungi gli attributi se presenti
        if (item.attributes && item.attributes.length > 0) {
          // Formatta gli attributi nel formato richiesto da WooCommerce
          lineItem.meta_data = item.attributes.map(attr => ({
            key: `pa_${attr.name.toLowerCase().replace(/\s+/g, '-')}`,
            value: attr.option
          }));
        }
        
        return lineItem;
      });
      
      // Prepare billing info
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
      
      // Se il metodo di pagamento è Stripe, gestisci il pagamento con Stripe Elements
      if (formData.paymentMethod === 'stripe') {
        setIsStripeLoading(true);
        
        console.log('Inizializzazione pagamento con Stripe...');
        
        if (!stripe || !elements) {
          setCardError('Impossibile connettersi al sistema di pagamento. Riprova più tardi.');
          setIsStripeLoading(false);
          setIsSubmitting(false);
          return;
        }
        
        // Gestione speciale per iOS
        if (isIOS) {
          console.log('Utilizzo approccio alternativo per iOS...');
          
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
            
            console.log('Payment method creato con successo:', paymentMethod.id);
            
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
              
              // Aggiungi gli attributi se presenti
              if (item.attributes && item.attributes.length > 0) {
                // Formatta gli attributi nel formato richiesto da WooCommerce
                lineItem.meta_data = item.attributes.map(attr => ({
                  key: `pa_${attr.name.toLowerCase().replace(/\s+/g, '-')}`,
                  value: attr.option
                }));
              }
              
              return lineItem;
            });
            
            // Crea un ordine con il payment method ID
            const orderResponse = await fetch('/api/stripe/create-order-ios', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                paymentMethodId: paymentMethod.id,
                amount: Math.round((subtotal + (shipping || 0)) * 100),
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
                notes: formData.notes
              }),
            });
            
            const orderData = await orderResponse.json();
            
            if (orderData.error) {
              throw new Error(orderData.error);
            }
            
            // Controlla se è necessaria l'autenticazione 3D Secure
            if (orderData.requires_action && orderData.payment_intent_client_secret) {
              console.log('Autenticazione 3D Secure richiesta per iOS, gestione in-page...');
              
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
            
            // Mostra il messaggio di successo
            setOrderSuccess(true);
            setSuccessOrderId(orderData.orderId);
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
        
        // Crea un ordine in stato pending
        const orderData = {
          payment_method: 'stripe',
          payment_method_title: 'Carta di Credito (Stripe)',
          set_paid: false,
          customer_note: formData.notes,
          billing: billingInfo,
          shipping: shippingInfo,
          line_items,
          customer_id: isAuthenticated && user ? user.id : 0,
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
          ] : []
        };
        
        // Crea l'ordine in WooCommerce
        const order = await createOrder(orderData);
        
        // Assicurati che l'ordine sia stato creato correttamente
        if (!order || typeof order !== 'object' || !('id' in order)) {
          throw new Error('Errore nella creazione dell\'ordine');
        }
        
        // Calcola il totale dell'ordine
        const amount = Math.round((subtotal + (shipping || 0)) * 100); // in centesimi
        
        // Crea un payment intent con configurazione standard
        const response = await fetch('/api/stripe/payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
            orderId: order.id
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
          return;
        }
        
        // Verifica se c'è stato un errore nel pagamento
        if (result.error) {
          console.error('Errore Stripe:', result.error);
          setCardError(result.error.message || 'Si è verificato un errore durante il pagamento');
          setIsStripeLoading(false);
          setIsSubmitting(false);
          return;
        }
        
        // Verifica se il pagamento è stato completato con successo
        if (result.paymentIntent && 
            typeof result.paymentIntent === 'object' && 
            'status' in result.paymentIntent && 
            result.paymentIntent.status === 'succeeded') {
          // Aggiorna l'ordine come pagato
          await fetch(`/api/stripe/update-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderId: order.id,
              paymentIntentId: result.paymentIntent.id
            }),
          });
          
          // Svuota il carrello
          clearCart();
          
          // Mostra il messaggio di successo
          setOrderSuccess(true);
          setSuccessOrderId(typeof order.id === 'number' ? order.id.toString() : String(order.id));
          
          // Aggiungi punti all'utente se autenticato
          if (isAuthenticated && user) {
            try {
              const token = localStorage.getItem('woocommerce_token');
              if (token) {
                // Calcola il totale dell'ordine (senza spese di spedizione per i punti)
                const orderTotal = getCartTotal();
                const orderId = typeof order.id === 'number' ? order.id : parseInt(String(order.id), 10);
                if (!isNaN(orderId)) {
                  await addOrderPoints(user.id, orderId, orderTotal, token);
                }
              }
            } catch (error) {
              console.error('Errore durante l\'aggiunta dei punti:', error);
              // Non blocchiamo il flusso se l'aggiunta dei punti fallisce
            }
          }
          
          setIsSubmitting(false);
          setIsStripeLoading(false);
          return;
        } else {
          throw new Error('Pagamento non completato');
        }
      }
      
      // Per altri metodi di pagamento, crea l'ordine direttamente
      
      // Create the order
      const orderData = {
        payment_method: formData.paymentMethod,
        payment_method_title: (formData.paymentMethod as string) === 'stripe' ? 'Carta di credito' : 
                             (formData.paymentMethod as string) === 'bacs' ? 'Bonifico Bancario' : 
                             (formData.paymentMethod as string) === 'cod' ? 'Contrassegno' : 'Carta di Credito',
        set_paid: false, // Will be set to true after Stripe payment
        billing: billingInfo,
        shipping: shippingInfo,
        line_items: line_items,
        customer_note: formData.notes,
        // Se l'utente è autenticato, associa l'ordine al suo account
        customer_id: isAuthenticated && user ? user.id : 0,
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
        ] : []
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
      
      // Send the order to WooCommerce
      const order = await createOrder(orderData);
      
      // Check if order is valid and has an id property
      if (order && typeof order === 'object' && 'id' in order) {
        // Clear the cart after successful order
        clearCart();
        
        // Mostra il messaggio di successo
        setOrderSuccess(true);
        setSuccessOrderId(typeof order.id === 'number' ? order.id.toString() : String(order.id));
        
        // Aggiungi punti all'utente se autenticato
        if (isAuthenticated && user) {
          try {
            const token = localStorage.getItem('woocommerce_token');
            if (token) {
              // Calcola il totale dell'ordine (senza spese di spedizione per i punti)
              const orderTotal = getCartTotal();
              const orderId = typeof order.id === 'number' ? order.id : parseInt(String(order.id), 10);
              if (!isNaN(orderId)) {
                await addOrderPoints(user.id, orderId, orderTotal, token);
              }
            }
          } catch (error) {
            console.error('Errore durante l\'aggiunta dei punti:', error);
            // Non blocchiamo il flusso se l'aggiunta dei punti fallisce
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
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow py-8 bg-white">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8 text-gray-900">Checkout</h1>
          
          {/* Il messaggio di conferma dell'ordine è stato spostato all'interno del form */}
          
          {!isAuthenticated && (
            <div className="mb-6 p-4 bg-blue-100 text-blue-700 rounded-md">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="IT">Italia</option>
                    <option value="US">Stati Uniti</option>
                    <option value="GB">Regno Unito</option>
                    <option value="FR">Francia</option>
                    <option value="DE">Germania</option>
                    <option value="ES">Spagna</option>
                  </select>
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
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={formData.shipToDifferentAddress}
                      >
                        <option value="IT">Italia</option>
                        <option value="US">Stati Uniti</option>
                        <option value="GB">Regno Unito</option>
                        <option value="FR">Francia</option>
                        <option value="DE">Germania</option>
                        <option value="ES">Spagna</option>
                      </select>
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={formData.shipToDifferentAddress}
                      />
                    </div>
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-gray-700">Metodo di Pagamento</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="bacs"
                          checked={formData.paymentMethod === 'bacs'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        <span className="text-gray-700">Bonifico Bancario</span>
                      </label>
                      {formData.paymentMethod === 'bacs' && (
                        <div className="mt-2 pl-6 text-sm text-gray-600">
                          <p>Effettua il pagamento direttamente sul nostro conto bancario. Utilizza il numero dell&apos;ordine come riferimento. L&apos;ordine non verrà spedito fino all&apos;avvenuto accredito.</p>
                        </div>
                      )}
                    </div>
                    
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
                                createOrder={async (data, actions) => {
                                  try {
                                    // Crea l'ordine in WooCommerce e ottieni l'ID
                                    const response = await fetch('/api/paypal/create-order', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({
                                        orderData: paypalOrderData
                                      }),
                                    });
                                    
                                    const data = await response.json();
                                    
                                    if (!data.success || !data.orderId) {
                                      throw new Error(data.error || 'Errore nella creazione dell\'ordine');
                                    }
                                    
                                    // Salva l'ID dell'ordine WooCommerce
                                    setSuccessOrderId(String(data.orderId));
                                    
                                    // Crea l'ordine PayPal direttamente dal client
                                    // Questo evita la necessità di PAYPAL_CLIENT_SECRET sul server
                                    return actions.order.create({
                                      intent: 'CAPTURE',
                                      purchase_units: [
                                        {
                                          amount: {
                                            currency_code: 'EUR',
                                            value: data.total
                                          },
                                          reference_id: data.orderId.toString(),
                                          description: `Ordine #${data.orderId}`
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
                                    // Questo evita i problemi di permessi che possono verificarsi lato server
                                    if (actions.order) {
                                      try {
                                        const captureResult = await actions.order.capture();
                                        console.log('Pagamento catturato con successo:', captureResult);
                                        
                                        // Aggiorna l'ordine WooCommerce come pagato
                                        const response = await fetch('/api/paypal/update-order', {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                          },
                                          body: JSON.stringify({
                                            orderId: successOrderId,
                                            paypalOrderId: data.orderID,
                                            paypalDetails: captureResult
                                          }),
                                        });
                                        
                                        const updateData = await response.json();
                                        
                                        if (!updateData.success) {
                                          console.warn('Ordine WooCommerce non aggiornato correttamente, ma il pagamento è stato ricevuto:', updateData);
                                        }
                                        
                                        // Svuota il carrello
                                        clearCart();
                                        
                                        // Mostra il messaggio di successo
                                        setOrderSuccess(true);
                                        
                                        // Aggiungi punti all'utente se autenticato
                                        if (isAuthenticated && user) {
                                          try {
                                            const token = localStorage.getItem('woocommerce_token');
                                            if (token && successOrderId) {
                                              // Calcola il totale dell'ordine (senza spese di spedizione per i punti)
                                              const orderTotal = getCartTotal();
                                              const orderId = parseInt(successOrderId, 10);
                                              if (!isNaN(orderId)) {
                                                await addOrderPoints(user.id, orderId, orderTotal, token);
                                              }
                                            }
                                          } catch (error) {
                                            console.error('Errore durante l\'aggiunta dei punti:', error);
                                            // Non blocchiamo il flusso se l'aggiunta dei punti fallisce
                                          }
                                        }
                                        
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
                                  }
                                }}
                                onError={(err) => {
                                  console.error('Errore PayPal:', err);
                                  setFormError('Si è verificato un errore durante il pagamento con PayPal. Riprova più tardi.');
                                  setIsSubmitting(false);
                                }}
                                onCancel={() => {
                                  console.log('Pagamento PayPal annullato dall\'utente');
                                  setFormError('Pagamento annullato. Puoi riprovare quando vuoi.');
                                  setIsSubmitting(false);
                                  setShowPayPalButtons(false);
                                  
                                  // Elimina l'ordine WooCommerce creato ma non completato
                                  if (successOrderId) {
                                    fetch('/api/paypal/cancel-order', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({
                                        orderId: successOrderId
                                      })
                                    }).catch(err => {
                                      console.error('Errore durante la cancellazione dell\'ordine:', err);
                                    });
                                  }
                                }}
                              />
                            </div>
                          )}
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
                                  console.log('CardElement è pronto');
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
                    <div>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cod"
                          checked={formData.paymentMethod === 'cod'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        <span className="text-gray-700">Contrassegno</span>
                      </label>
                      {formData.paymentMethod === 'cod' && (
                        <div className="mt-2 pl-6 text-sm text-gray-600">
                          <p>Paga in contanti alla consegna.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mb-6">
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
                
                <div className="mb-6">
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Note dell&apos;ordine (opzionale)
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={4}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Note speciali per la consegna o altre informazioni"
                  />
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
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          required={formData.createAccount}
                          minLength={6}
                        />
                        <p className="text-xs text-gray-500 mt-1">La password deve essere di almeno 6 caratteri.</p>
                      </div>
                    )}
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={isSubmitting || isStripeLoading || isProcessingPayment || cart.length === 0}
                  className={`w-full py-3 px-4 rounded-md text-white font-medium ${(isSubmitting || isStripeLoading || isProcessingPayment) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isSubmitting ? 'Elaborazione...' : 
                   isStripeLoading ? 'Reindirizzamento a Stripe...' : 
                   isProcessingPayment ? 'Preparazione pagamento...' : 
                   'Effettua Ordine'}
                </button>
                
                {/* Messaggio di conferma dell'ordine */}
                {orderSuccess && successOrderId && (
                  <div className="mt-6 p-6 bg-green-100 text-green-800 rounded-lg shadow-md">
                    <div className="flex items-center mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <h2 className="text-2xl font-bold">Ordine Completato con Successo!</h2>
                    </div>
                    <p className="text-lg mb-2">Grazie per il tuo acquisto. Il tuo ordine è stato elaborato correttamente.</p>
                    <p className="mb-4">Numero Ordine: <span className="font-semibold">{successOrderId}</span></p>
                    <p className="text-sm mb-6">Riceverai presto un&apos;email di conferma con i dettagli del tuo ordine.</p>
                    <div className="flex flex-wrap gap-4">
                      <button 
                        onClick={() => router.push('/')} 
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Torna alla Home
                      </button>
                      <button 
                        onClick={() => router.push(`/checkout/success?order_id=${successOrderId}`)} 
                        className="px-4 py-2 border border-green-600 text-green-600 rounded hover:bg-green-50 transition-colors"
                      >
                        Vai ai Dettagli Ordine
                      </button>
                    </div>
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
                      
                      <div className="flex justify-between">
                        <span className="text-gray-600">Spedizione</span>
                        {selectedShippingMethod ? (
                          <span>
                            {selectedShippingMethod.free_shipping ? 'Gratuita' : `€${selectedShippingMethod.cost.toFixed(2)}`}
                          </span>
                        ) : (
                          <span className="italic text-gray-500">
                            Seleziona un metodo
                          </span>
                        )}
                      </div>
                      
                      <div className="flex justify-between font-bold text-lg pt-2 border-t text-gray-700">
                        <span>Totale</span>
                        <span>{formatPrice(total)}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-4">
                  <Link href="/cart" className="text-blue-600 hover:text-blue-800 text-sm">
                    ← Torna al carrello
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
