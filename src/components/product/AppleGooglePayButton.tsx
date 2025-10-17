'use client';

import React, { useState, useEffect } from 'react';
import { PaymentRequestButtonElement, useStripe } from '@stripe/react-stripe-js';
import { Product, getShippingMethods, ShippingAddress, ShippingMethod } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

// Dichiarazione tipo per ApplePaySession
declare global {
  interface Window {
    ApplePaySession?: {
      canMakePayments(): boolean;
    };
  }
}

interface AppleGooglePayButtonProps {
  product: Product;
  quantity: number;
  enableDeposit?: 'yes' | 'no';
  variationId?: number;
  variationAttributes?: Array<{
    id: number;
    name: string;
    option: string;
  }>;
}

export default function AppleGooglePayButton({
  product,
  quantity,
  enableDeposit = 'no',
  variationId,
  variationAttributes
}: AppleGooglePayButtonProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [paymentRequest, setPaymentRequest] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const { user } = useAuth();
  const router = useRouter();
  const stripe = useStripe();

  // Stato per le opzioni di acconto
  const [depositOptions, setDepositOptions] = useState<{
    depositAmount: string;
    depositType: string;
    paymentPlanId?: string;
  } | null>(null);

  // Stato per il metodo di spedizione
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<ShippingMethod | null>(null);

  // Verifica se il prodotto è valido per l'acquisto
  const hasValidPrice = product.price && parseFloat(product.price) > 0;
  const isInStock = product.stock_status === 'instock' && hasValidPrice;


  // Effetto per recuperare le opzioni di acconto se enableDeposit è 'yes'
  useEffect(() => {
    const fetchDepositOptions = async () => {
      if (enableDeposit !== 'yes') {
        setDepositOptions(null);
        return;
      }

      try {
        // Passa il prezzo del prodotto/variazione per calcolare correttamente l'acconto
        const depositOptionsUrl = product.price
          ? `/api/products/${product.id}/deposit-options?price=${product.price}`
          : `/api/products/${product.id}/deposit-options`;
        const response = await fetch(depositOptionsUrl);
        if (response.ok) {
          const options = await response.json();

          if (options.success && options.deposit_enabled) {
            // Recupera anche il payment plan ID se presente
            const paymentPlanId = options.payment_plan?.id?.toString() ||
                                  (options.is_pianoprova ? '810' : undefined);

            setDepositOptions({
              depositAmount: options.deposit_amount?.toString() || '40',
              depositType: options.deposit_type || 'percent',
              paymentPlanId: paymentPlanId
            });
          } else {
            // Se l'acconto non è abilitato, usa null
            setDepositOptions(null);
          }
        }
      } catch (error) {
        console.error('Errore nel recupero delle opzioni di acconto:', error);
        // Fallback ai valori predefiniti
        setDepositOptions({
          depositAmount: '40',
          depositType: 'percent'
        });
      }
    };

    fetchDepositOptions();
  }, [product.id, product.price, enableDeposit]);

  // Effetto per calcolare i metodi di spedizione
  useEffect(() => {
    const calculateDefaultShipping = async () => {
      try {
        // Utilizziamo un indirizzo di default per l'Italia per il calcolo iniziale
        const defaultAddress: ShippingAddress = {
          first_name: '',
          last_name: '',
          address_1: 'Via Roma 1',
          city: 'Roma',
          state: 'RM',
          postcode: '00100',
          country: 'IT'
        };

        const unitPrice = parseFloat(product.sale_price || product.price || '0');
        const cartTotal = unitPrice * quantity;

        // Prepara gli item del carrello per il calcolo spedizione
        const cartItems = [{
          product_id: product.id,
          quantity: quantity,
          variation_id: variationId || 0,
          shipping_class_id: product.shipping_class_id || 0
        }];

        const availableMethods = await getShippingMethods(defaultAddress, cartTotal, cartItems);

        // Seleziona automaticamente il primo metodo disponibile
        if (availableMethods.length > 0) {
          setSelectedShippingMethod(availableMethods[0]);
        } else {
          // Nessun metodo disponibile = spedizione €0
          setSelectedShippingMethod(null);
        }
      } catch (error) {
        console.error('Errore nel calcolo della spedizione di default:', error);
        // In caso di errore, nessuna spedizione
        setSelectedShippingMethod(null);
      }
    };

    calculateDefaultShipping();
  }, [product.id, product.price, product.sale_price, product.shipping_class_id, quantity, variationId]);

  useEffect(() => {
    if (!stripe || !isInStock) {
      return;
    }

    // Reset del payment request quando cambiano le opzioni
    setPaymentRequest(null);

    // Se l'acconto è abilitato ma le opzioni non sono ancora state caricate, aspetta
    if (enableDeposit === 'yes' && !depositOptions) {
      return;
    }

    // Piccolo delay per assicurarsi che il vecchio bottone sia completamente distrutto
    const timer = setTimeout(() => {
      // Calcola il prezzo totale
      const unitPrice = parseFloat(product.sale_price || product.price || '0');
      let totalAmount = unitPrice * quantity;



      // Se l'acconto è abilitato, calcola l'importo dell'acconto
      if (enableDeposit === 'yes' && depositOptions) {
        const depositAmount = parseFloat(depositOptions.depositAmount);
        if (depositOptions.depositType === 'percent') {
          totalAmount = totalAmount * (depositAmount / 100);
        } else {
          totalAmount = depositAmount * quantity;
        }
      }

      // Calcola il costo della spedizione
      const shippingCost = selectedShippingMethod?.cost ?? 0;
      const shippingAmount = Math.round(shippingCost * 100);

      // Totale finale = prodotto + spedizione
      const finalAmount = Math.round(totalAmount * 100) + shippingAmount;


      // Crea il payment request con configurazione semplificata
      const pr = stripe.paymentRequest({
      country: 'IT',
      currency: 'eur',
      total: {
        label: `${product.name} x${quantity}${enableDeposit === 'yes' ? ' (Acconto)' : ''}`,
        amount: finalAmount,
      },
      requestPayerName: true,
      requestPayerEmail: true,
      requestShipping: true,
      shippingOptions: selectedShippingMethod ? [
        {
          id: selectedShippingMethod.id,
          label: selectedShippingMethod.title,
          detail: selectedShippingMethod.description || '5-7 giorni lavorativi',
          amount: shippingAmount,
        },
      ] : [
        {
          id: 'free',
          label: 'Spedizione inclusa',
          detail: 'Nessun costo aggiuntivo',
          amount: 0,
        },
      ],
    });

    // Controlla disponibilità con preferenza per Apple Pay
    pr.canMakePayment().then(result => {

      if (result) {
        setPaymentRequest(pr);
        setDebugInfo(`Disponibile: ${result.applePay ? 'Apple Pay' : ''} ${result.googlePay ? 'Google Pay' : ''} ${result.link ? 'Link' : ''}`);
      } else {
        setDebugInfo('Payment Request non disponibile su questo dispositivo/browser');
      }
    });

    // Gestisce il pagamento
    pr.on('paymentmethod', async (ev) => {
      try {
        setIsProcessing(true);
        setError(null);


        // Crea l'ordine backend
        const response = await fetch('/api/stripe/payment-request-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId: product.id,
            quantity: quantity,
            userId: user?.id || 0,
            enableDeposit: enableDeposit,
            depositAmount: depositOptions?.depositAmount,
            depositType: depositOptions?.depositType,
            paymentPlanId: depositOptions?.paymentPlanId,
            paymentMethodId: ev.paymentMethod.id,
            shippingMethod: selectedShippingMethod,
            variationId: variationId,
            variationAttributes: variationAttributes,
            billingData: {
              first_name: ev.payerName?.split(' ')[0] || '',
              last_name: ev.payerName?.split(' ').slice(1).join(' ') || '',
              email: ev.payerEmail || '',
              phone: ev.payerPhone || '',
              address_1: ev.shippingAddress?.addressLine?.[0] || '',
              address_2: ev.shippingAddress?.addressLine?.[1] || '',
              city: ev.shippingAddress?.city || '',
              state: ev.shippingAddress?.region || '',
              postcode: ev.shippingAddress?.postalCode || '',
              country: ev.shippingAddress?.country || 'IT'
            },
            shippingData: {
              first_name: ev.shippingAddress?.recipient?.split(' ')[0] || ev.payerName?.split(' ')[0] || '',
              last_name: ev.shippingAddress?.recipient?.split(' ').slice(1).join(' ') || ev.payerName?.split(' ').slice(1).join(' ') || '',
              address_1: ev.shippingAddress?.addressLine?.[0] || '',
              address_2: ev.shippingAddress?.addressLine?.[1] || '',
              city: ev.shippingAddress?.city || '',
              state: ev.shippingAddress?.region || '',
              postcode: ev.shippingAddress?.postalCode || '',
              country: ev.shippingAddress?.country || 'IT'
            }
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Controlla lo status del pagamento
          if (result.requiresAction || result.paymentStatus === 'requires_action') {
            // 3DS richiesto - Non completare il pagamento
            console.warn('[Apple/Google Pay] Payment requires 3DS authentication - not supported in Payment Request');
            ev.complete('fail');
            setError('Questo pagamento richiede autenticazione aggiuntiva. Per favore usa il checkout standard.');

            // Puoi anche cancellare l'ordine qui se vuoi
            console.log(`[Apple/Google Pay] Order #${result.order_id} left pending - requires 3DS`);
            return;
          }

          // Pagamento confermato con successo
          ev.complete('success');
          router.push(`/checkout/success?order_id=${result.order_id}`);

        } else {
          throw new Error(result.error || 'Errore durante la creazione dell\'ordine');
        }
      } catch (error) {
        console.error('Errore durante il pagamento Apple/Google Pay:', error);
        setError(error instanceof Error ? error.message : 'Errore durante il pagamento');
        ev.complete('fail');
      } finally {
        setIsProcessing(false);
      }
    });
    }, 100); // 100ms delay

    return () => clearTimeout(timer);
  }, [stripe, product, quantity, enableDeposit, depositOptions, selectedShippingMethod, user, router, isInStock, variationId, variationAttributes]);

  if (!isInStock) {
    return null;
  }

  return (
    <div className="mb-4">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">❌ {error}</p>
        </div>
      )}
      
      {/* Debug Info */}
      {debugInfo && !paymentRequest && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-700 text-sm">🔍 {debugInfo}</p>
          <p className="text-yellow-600 text-xs mt-1">
            Testa su Safari (iOS/Mac) o Chrome con carte salvate
          </p>
        </div>
      )}
      
      {/* Native Stripe Payment Request Button */}
      {paymentRequest && (
        <div className="space-y-2">
          <PaymentRequestButtonElement
            key={`${enableDeposit}-${depositOptions?.depositAmount || 'full'}`}
            options={{
              paymentRequest,
              style: {
                paymentRequestButton: {
                  type: 'buy', // 'default' | 'book' | 'buy' | 'checkout'
                  theme: 'dark', // 'dark' | 'light' | 'light-outline'
                  height: '48px',
                },
              },
            }}
          />
          {isProcessing && (
            <div className="flex items-center justify-center py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
              <span className="text-sm text-gray-600">Elaborazione pagamento...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}