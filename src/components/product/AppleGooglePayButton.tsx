'use client';

import React, { useState, useEffect, useRef } from 'react';
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

  // Ref per tracciare se il componente è montato
  const isMountedRef = useRef(true);
  // Ref per tracciare l'ultimo payment request creato
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentRequestRef = useRef<any>(null);
  // Ref per evitare re-creazioni inutili
  const lastConfigRef = useRef<string>('');

  // Stato per le opzioni di acconto
  const [depositOptions, setDepositOptions] = useState<{
    depositAmount: string;
    depositType: string;
    paymentPlanId?: string;
  } | null>(null);

  // Stato per il metodo di spedizione
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<ShippingMethod | null>(null);

  // Estrai valori primitivi dal product per evitare re-render
  const productId = product.id;
  const productName = product.name;
  const productPrice = product.price;
  const productSalePrice = product.sale_price;
  const productStockStatus = product.stock_status;
  const productShippingClassId = product.shipping_class_id;

  // Verifica se il prodotto è valido per l'acquisto
  const hasValidPrice = productPrice && parseFloat(productPrice) > 0;
  const isInStock = productStockStatus === 'instock' && hasValidPrice;

  // Memoizza userId per evitare re-render
  const userId = user?.id || 0;

  // Ref per avere sempre l'ultimo valore di userId nell'event handler
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Cleanup al unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);


  // Effetto per recuperare le opzioni di acconto se enableDeposit è 'yes'
  useEffect(() => {
    const fetchDepositOptions = async () => {
      if (enableDeposit !== 'yes') {
        setDepositOptions(null);
        return;
      }

      try {
        // Passa il prezzo del prodotto/variazione per calcolare correttamente l'acconto
        const depositOptionsUrl = productPrice
          ? `/api/products/${productId}/deposit-options?price=${productPrice}`
          : `/api/products/${productId}/deposit-options`;
        const response = await fetch(depositOptionsUrl);
        if (response.ok && isMountedRef.current) {
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
        if (isMountedRef.current) {
          setDepositOptions({
            depositAmount: '40',
            depositType: 'percent'
          });
        }
      }
    };

    fetchDepositOptions();
  }, [productId, productPrice, enableDeposit]);

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

        const unitPrice = parseFloat(productSalePrice || productPrice || '0');
        const cartTotal = unitPrice * quantity;

        // Prepara gli item del carrello per il calcolo spedizione
        const cartItems = [{
          product_id: productId,
          quantity: quantity,
          variation_id: variationId || 0,
          shipping_class_id: productShippingClassId || 0
        }];

        const availableMethods = await getShippingMethods(defaultAddress, cartTotal, cartItems);

        // Seleziona automaticamente il primo metodo disponibile
        if (isMountedRef.current) {
          if (availableMethods.length > 0) {
            setSelectedShippingMethod(availableMethods[0]);
          } else {
            // Nessun metodo disponibile = spedizione €0
            setSelectedShippingMethod(null);
          }
        }
      } catch (error) {
        console.error('Errore nel calcolo della spedizione di default:', error);
        // In caso di errore, nessuna spedizione
        if (isMountedRef.current) {
          setSelectedShippingMethod(null);
        }
      }
    };

    calculateDefaultShipping();
  }, [productId, productPrice, productSalePrice, productShippingClassId, quantity, variationId]);

  // Memoizza il costo di spedizione come valore primitivo
  const shippingCost = selectedShippingMethod?.cost ?? 0;
  const shippingMethodId = selectedShippingMethod?.id ?? 'free';
  const shippingMethodTitle = selectedShippingMethod?.title ?? 'Spedizione inclusa';
  const shippingMethodDescription = selectedShippingMethod?.description ?? 'Nessun costo aggiuntivo';

  // Memoizza depositOptions come valori primitivi
  const depositAmount = depositOptions?.depositAmount ?? '';
  const depositType = depositOptions?.depositType ?? '';
  const paymentPlanId = depositOptions?.paymentPlanId ?? '';

  useEffect(() => {
    if (!stripe || !isInStock) {
      return;
    }

    // Se l'acconto è abilitato ma le opzioni non sono ancora state caricate, aspetta
    if (enableDeposit === 'yes' && !depositAmount) {
      return;
    }

    // Crea una chiave di configurazione per evitare ri-creazioni inutili
    const configKey = `${productId}-${productPrice}-${productSalePrice}-${quantity}-${enableDeposit}-${depositAmount}-${depositType}-${shippingCost}-${shippingMethodId}`;

    // Se la configurazione non è cambiata, non ricreare il payment request
    if (lastConfigRef.current === configKey && paymentRequestRef.current) {
      return;
    }

    lastConfigRef.current = configKey;

    // Calcola il prezzo totale
    const unitPrice = parseFloat(productSalePrice || productPrice || '0');
    let totalAmount = unitPrice * quantity;

    // Se l'acconto è abilitato, calcola l'importo dell'acconto
    if (enableDeposit === 'yes' && depositAmount) {
      const depositAmountNum = parseFloat(depositAmount);
      if (depositType === 'percent') {
        totalAmount = totalAmount * (depositAmountNum / 100);
      } else {
        totalAmount = depositAmountNum * quantity;
      }
    }

    // Calcola il costo della spedizione
    const shippingAmount = Math.round(shippingCost * 100);

    // Totale finale = prodotto + spedizione
    const finalAmount = Math.round(totalAmount * 100) + shippingAmount;

    // Crea il payment request con configurazione semplificata
    const pr = stripe.paymentRequest({
      country: 'IT',
      currency: 'eur',
      total: {
        label: `${productName} x${quantity}${enableDeposit === 'yes' ? ' (Acconto)' : ''}`,
        amount: finalAmount,
      },
      requestPayerName: true,
      requestPayerEmail: true,
      requestPayerPhone: true,
      requestShipping: true,
      shippingOptions: shippingMethodId !== 'free' ? [
        {
          id: shippingMethodId,
          label: shippingMethodTitle,
          detail: shippingMethodDescription || '5-7 giorni lavorativi',
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

    // Salva riferimento al payment request
    paymentRequestRef.current = pr;

    // Controlla disponibilità con preferenza per Apple Pay
    pr.canMakePayment().then(result => {
      if (!isMountedRef.current) return;

      if (result) {
        setPaymentRequest(pr);
        setDebugInfo(`Disponibile: ${result.applePay ? 'Apple Pay' : ''} ${result.googlePay ? 'Google Pay' : ''} ${result.link ? 'Link' : ''}`);
      } else {
        setDebugInfo('Payment Request non disponibile su questo dispositivo/browser');
      }
    });

    // Gestisce il cambio di indirizzo di spedizione
    pr.on('shippingaddresschange', async (ev) => {
      try {
        // Converti l'indirizzo di spedizione nel formato richiesto
        const shippingAddress: ShippingAddress = {
          first_name: '',
          last_name: '',
          address_1: ev.shippingAddress?.addressLine?.[0] || '',
          city: ev.shippingAddress?.city || '',
          state: ev.shippingAddress?.region || '',
          postcode: ev.shippingAddress?.postalCode || '',
          country: ev.shippingAddress?.country || 'IT'
        };

        const unitPriceCalc = parseFloat(productSalePrice || productPrice || '0');
        const cartTotal = unitPriceCalc * quantity;

        const cartItems = [{
          product_id: productId,
          quantity: quantity,
          variation_id: variationId || 0,
          shipping_class_id: productShippingClassId || 0
        }];

        // Ricalcola i metodi di spedizione con il nuovo indirizzo
        const availableMethods = await getShippingMethods(shippingAddress, cartTotal, cartItems);

        if (availableMethods.length > 0) {
          const shippingMethod = availableMethods[0];
          const newShippingAmount = Math.round(shippingMethod.cost * 100);

          // Aggiorna il metodo di spedizione selezionato
          if (isMountedRef.current) {
            setSelectedShippingMethod(shippingMethod);
          }

          // Calcola il nuovo totale
          let productAmount = unitPriceCalc * quantity;
          if (enableDeposit === 'yes' && depositAmount) {
            const depositAmountNum = parseFloat(depositAmount);
            if (depositType === 'percent') {
              productAmount = productAmount * (depositAmountNum / 100);
            } else {
              productAmount = depositAmountNum * quantity;
            }
          }

          const newTotal = Math.round(productAmount * 100) + newShippingAmount;

          ev.updateWith({
            status: 'success',
            total: {
              label: `${productName} x${quantity}${enableDeposit === 'yes' ? ' (Acconto)' : ''}`,
              amount: newTotal,
            },
            shippingOptions: [
              {
                id: shippingMethod.id,
                label: shippingMethod.title,
                detail: shippingMethod.description || '5-7 giorni lavorativi',
                amount: newShippingAmount,
              },
            ],
          });
        } else {
          // Nessun metodo di spedizione disponibile per questo indirizzo
          ev.updateWith({
            status: 'invalid_shipping_address',
          });
        }
      } catch (error) {
        console.error('Errore nel calcolo della spedizione:', error);
        ev.updateWith({
          status: 'fail',
        });
      }
    });

    // Gestisce il cambio di opzione di spedizione (se l'utente sceglie tra più opzioni)
    pr.on('shippingoptionchange', async (ev) => {
      try {
        // Trova il metodo di spedizione selezionato
        const selectedOption = ev.shippingOption;

        // In questo caso abbiamo un solo metodo, ma aggiorniamo comunque il totale
        const optionShippingAmount = selectedOption.amount;

        const unitPriceCalc = parseFloat(productSalePrice || productPrice || '0');
        let productAmount = unitPriceCalc * quantity;

        if (enableDeposit === 'yes' && depositAmount) {
          const depositAmountNum = parseFloat(depositAmount);
          if (depositType === 'percent') {
            productAmount = productAmount * (depositAmountNum / 100);
          } else {
            productAmount = depositAmountNum * quantity;
          }
        }

        const newTotal = Math.round(productAmount * 100) + optionShippingAmount;

        ev.updateWith({
          status: 'success',
          total: {
            label: `${productName} x${quantity}${enableDeposit === 'yes' ? ' (Acconto)' : ''}`,
            amount: newTotal,
          },
        });
      } catch (error) {
        console.error('Errore nell\'aggiornamento dell\'opzione di spedizione:', error);
        ev.updateWith({
          status: 'fail',
        });
      }
    });

    // Gestisce il pagamento
    pr.on('paymentmethod', async (ev) => {
      try {
        setIsProcessing(true);
        setError(null);

        // Usa userIdRef.current per avere sempre l'ultimo valore
        const currentUserId = userIdRef.current;

        // Crea l'ordine backend
        const response = await fetch('/api/stripe/payment-request-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId: productId,
            quantity: quantity,
            userId: currentUserId,
            enableDeposit: enableDeposit,
            depositAmount: depositAmount || undefined,
            depositType: depositType || undefined,
            paymentPlanId: paymentPlanId || undefined,
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

    // Cleanup: non resettiamo paymentRequest a null per evitare flickering
  }, [
    stripe,
    isInStock,
    productId,
    productName,
    productPrice,
    productSalePrice,
    productShippingClassId,
    quantity,
    enableDeposit,
    depositAmount,
    depositType,
    paymentPlanId,
    shippingCost,
    shippingMethodId,
    shippingMethodTitle,
    shippingMethodDescription,
    userId,
    variationId,
    variationAttributes,
    selectedShippingMethod,
    router
  ]);

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