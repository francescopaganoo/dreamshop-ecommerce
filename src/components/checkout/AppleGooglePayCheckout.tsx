'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PaymentRequestButtonElement, useStripe } from '@stripe/react-stripe-js';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getShippingMethods, ShippingAddress, ShippingMethod } from '@/lib/api';
import { getDepositInfo, ProductWithDeposit } from '@/lib/deposits';

// Dichiarazione tipo per ApplePaySession
declare global {
  interface Window {
    ApplePaySession?: {
      canMakePayments(): boolean;
    };
  }
}

interface AppleGooglePayCheckoutProps {
  billingData: {
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
  };
  shippingData?: {
    firstName: string;
    lastName: string;
    phone: string;
    address1: string;
    address2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  onPaymentStart?: () => void;
  onPaymentError?: (error: string) => void;
  className?: string;
  customerId?: number; // ID cliente passato dalla pagina checkout
  pointsToRedeem?: number;
  pointsDiscount?: number;
}

export default function AppleGooglePayCheckout({
  billingData,
  shippingData,
  onPaymentStart,
  onPaymentError,
  className = '',
  customerId,
  pointsToRedeem = 0,
  pointsDiscount = 0
}: AppleGooglePayCheckoutProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [paymentRequest, setPaymentRequest] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const { cart, getCartTotal, discount, clearCart } = useCart();
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
  // Ref per calcolare la spedizione solo una volta
  const hasCalculatedShippingRef = useRef(false);

  // Stato per il metodo di spedizione
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<ShippingMethod | null>(null);

  // Verifica se il carrello è valido
  const hasItems = cart.length > 0;
  const cartTotal = getCartTotal();
  const finalTotal = cartTotal - discount - pointsDiscount;

  // Usa customerId se passato come prop, altrimenti fallback a useAuth()
  // Questo risolve il problema di timing quando useAuth() non ha ancora caricato l'utente
  const userId = customerId || user?.id || 0;

  // Ref per avere sempre l'ultimo valore di userId nell'event handler
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Ref per avere sempre gli ultimi valori di punti nell'event handler
  const pointsToRedeemRef = useRef(pointsToRedeem);
  pointsToRedeemRef.current = pointsToRedeem;
  const pointsDiscountRef = useRef(pointsDiscount);
  pointsDiscountRef.current = pointsDiscount;

  // Memoizza cart come stringa per confronto stabile
  const cartKey = useMemo(() =>
    cart.map(item => `${item.product.id}-${item.quantity}-${item.variation_id || 0}`).join('|'),
    [cart]
  );

  // Cleanup al unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Effetto per calcolare i metodi di spedizione - SOLO UNA VOLTA al mount
  useEffect(() => {
    // Se abbiamo già calcolato la spedizione, non ricalcolare
    if (hasCalculatedShippingRef.current) {
      return;
    }

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

        // Prepara gli item del carrello per il calcolo spedizione
        const cartItems = cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          variation_id: item.variation_id || 0,
          shipping_class_id: item.product.shipping_class_id || 0
        }));

        const availableMethods = await getShippingMethods(defaultAddress, cartTotal, cartItems);

        // Seleziona automaticamente il primo metodo disponibile
        if (isMountedRef.current) {
          hasCalculatedShippingRef.current = true; // Marca come calcolato
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
          hasCalculatedShippingRef.current = true; // Marca come calcolato anche in caso di errore
          setSelectedShippingMethod(null);
        }
      }
    };

    if (hasItems && cart.length > 0) {
      calculateDefaultShipping();
    }
  }, [cart, cartTotal, hasItems]);

  // Memoizza il costo di spedizione come valore primitivo
  const shippingCost = selectedShippingMethod?.cost ?? 0;
  const shippingMethodId = selectedShippingMethod?.id ?? 'free';
  const shippingMethodTitle = selectedShippingMethod?.title ?? 'Spedizione inclusa';
  const shippingMethodDescription = selectedShippingMethod?.description ?? 'Nessun costo aggiuntivo';

  // Helper per costruire i displayItems (usato sia nella creazione che nell'update)
  const buildDisplayItems = (currentPointsDiscount: number, currentPointsToRedeem: number) => {
    const items = cart.map(item => ({
      label: `${item.product.name} x${item.quantity}`,
      amount: Math.round(parseFloat(item.product.price || '0') * item.quantity * 100)
    }));

    if (discount > 0) {
      items.push({
        label: 'Sconto',
        amount: -Math.round(discount * 100)
      });
    }

    if (currentPointsDiscount > 0 && currentPointsToRedeem > 0) {
      items.push({
        label: `Sconto punti (${currentPointsToRedeem} punti)`,
        amount: -Math.round(currentPointsDiscount * 100)
      });
    }

    return items;
  };

  // useEffect 1: Crea il Payment Request UNA SOLA VOLTA (quando carrello/spedizione sono pronti)
  // I punti vengono gestiti separatamente con paymentRequest.update()
  useEffect(() => {
    if (!stripe || !hasItems || cartTotal <= 0) {
      return;
    }

    // Aspetta che la spedizione sia stata calcolata
    if (selectedShippingMethod === undefined) {
      return;
    }

    // Se il payment request esiste già, non ricrearlo
    // (i cambiamenti di punti vengono gestiti dal secondo useEffect con .update())
    const baseConfigKey = `${cartKey}-${cartTotal}-${discount}-${shippingCost}-${shippingMethodId}`;
    if (lastConfigRef.current === baseConfigKey && paymentRequestRef.current) {
      return;
    }

    lastConfigRef.current = baseConfigKey;

    // Usa i valori correnti dei punti per la creazione iniziale
    const currentPointsDiscount = pointsDiscountRef.current;
    const currentPointsToRedeem = pointsToRedeemRef.current;
    const currentFinalTotal = cartTotal - discount - currentPointsDiscount;

    if (currentFinalTotal <= 0) {
      return;
    }

    const displayItems = buildDisplayItems(currentPointsDiscount, currentPointsToRedeem);
    const shippingAmount = Math.round(shippingCost * 100);
    const totalWithShipping = Math.round(currentFinalTotal * 100) + shippingAmount;

    // Crea il payment request
    const pr = stripe.paymentRequest({
      country: 'IT',
      currency: 'eur',
      total: {
        label: 'Totale Ordine DreamShop',
        amount: totalWithShipping,
      },
      displayItems: displayItems,
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

    // Controlla disponibilità
    pr.canMakePayment().then(result => {
      if (!isMountedRef.current) return;

      if (result) {
        setPaymentRequest(pr);
        setDebugInfo(
          `Disponibile: ${result.applePay ? 'Apple Pay' : ''} ${result.googlePay ? 'Google Pay' : ''} ${result.link ? 'Link' : ''}`.trim()
        );
      } else {
        setDebugInfo('Apple Pay/Google Pay non disponibile su questo dispositivo');
      }
    }).catch(err => {
      console.error('Errore controllo Payment Request:', err);
      setDebugInfo('Errore nel controllo della disponibilità');
    });

    // Gestisce il cambio di indirizzo di spedizione
    pr.on('shippingaddresschange', async (ev) => {
      try {
        const shippingAddress: ShippingAddress = {
          first_name: '',
          last_name: '',
          address_1: ev.shippingAddress?.addressLine?.[0] || '',
          city: ev.shippingAddress?.city || '',
          state: ev.shippingAddress?.region || '',
          postcode: ev.shippingAddress?.postalCode || '',
          country: ev.shippingAddress?.country || 'IT'
        };

        const cartItemsForShipping = cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          variation_id: item.variation_id || 0,
          shipping_class_id: item.product.shipping_class_id || 0
        }));

        const availableMethods = await getShippingMethods(shippingAddress, cartTotal, cartItemsForShipping);

        if (availableMethods.length > 0) {
          const shippingMethod = availableMethods[0];
          const newShippingAmount = Math.round(shippingMethod.cost * 100);

          if (isMountedRef.current) {
            setSelectedShippingMethod(shippingMethod);
          }

          // Usa ref per avere il valore aggiornato dei punti
          const latestFinalTotal = cartTotal - discount - pointsDiscountRef.current;
          const newTotal = Math.round(latestFinalTotal * 100) + newShippingAmount;
          const latestDisplayItems = buildDisplayItems(pointsDiscountRef.current, pointsToRedeemRef.current);

          ev.updateWith({
            status: 'success',
            total: {
              label: 'Totale Ordine DreamShop',
              amount: newTotal,
            },
            displayItems: latestDisplayItems,
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

    // Gestisce il cambio del metodo di spedizione
    pr.on('shippingoptionchange', async (ev) => {
      try {
        const shippingOption = ev.shippingOption;
        const optionShippingCost = shippingOption.amount;

        // Usa ref per avere il valore aggiornato dei punti
        const latestFinalTotal = cartTotal - discount - pointsDiscountRef.current;
        const newTotal = Math.round(latestFinalTotal * 100) + optionShippingCost;

        const updatedDisplayItems = buildDisplayItems(pointsDiscountRef.current, pointsToRedeemRef.current);
        if (optionShippingCost > 0) {
          updatedDisplayItems.push({
            label: shippingOption.label,
            amount: optionShippingCost
          });
        }

        ev.updateWith({
          status: 'success',
          total: {
            label: 'Totale Ordine DreamShop',
            amount: newTotal,
          },
          displayItems: updatedDisplayItems
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
        onPaymentStart?.();

        // Usa ref per avere sempre gli ultimi valori
        const currentUserId = userIdRef.current;
        const currentPointsToRedeemVal = pointsToRedeemRef.current;
        const currentPointsDiscountVal = pointsDiscountRef.current;

        const orderData = {
          cartItems: cart.map(item => {
            const depositInfo = getDepositInfo(item.product as unknown as ProductWithDeposit);

            return {
              product_id: item.product.id,
              variation_id: item.variation_id || null,
              quantity: item.quantity,
              name: item.product.name,
              price: item.product.price,
              enableDeposit: depositInfo.hasDeposit ? 'yes' : 'no',
              depositAmount: depositInfo.hasDeposit ? depositInfo.depositAmount.toString() : undefined,
              depositType: depositInfo.hasDeposit ? depositInfo.depositType : undefined,
              paymentPlanId: depositInfo.hasDeposit ? depositInfo.paymentPlanId : undefined
            };
          }),
          userId: currentUserId,
          paymentMethodId: ev.paymentMethod.id,
          shippingOption: ev.shippingOption,
          discount: discount,
          pointsToRedeem: currentPointsToRedeemVal,
          pointsDiscount: currentPointsDiscountVal,
          billingData: {
            first_name: ev.payerName?.split(' ')[0] || billingData.firstName,
            last_name: ev.payerName?.split(' ').slice(1).join(' ') || billingData.lastName,
            email: ev.payerEmail || billingData.email,
            phone: ev.payerPhone || billingData.phone,
            address_1: ev.shippingAddress?.addressLine?.[0] || billingData.address1,
            address_2: ev.shippingAddress?.addressLine?.[1] || billingData.address2,
            city: ev.shippingAddress?.city || billingData.city,
            state: ev.shippingAddress?.region || billingData.state,
            postcode: ev.shippingAddress?.postalCode || billingData.postcode,
            country: ev.shippingAddress?.country || billingData.country
          },
          shippingData: shippingData ? {
            first_name: ev.shippingAddress?.recipient?.split(' ')[0] || shippingData.firstName,
            last_name: ev.shippingAddress?.recipient?.split(' ').slice(1).join(' ') || shippingData.lastName,
            address_1: ev.shippingAddress?.addressLine?.[0] || shippingData.address1,
            address_2: ev.shippingAddress?.addressLine?.[1] || shippingData.address2,
            city: ev.shippingAddress?.city || shippingData.city,
            state: ev.shippingAddress?.region || shippingData.state,
            postcode: ev.shippingAddress?.postalCode || shippingData.postcode,
            country: ev.shippingAddress?.country || shippingData.country
          } : {
            first_name: ev.shippingAddress?.recipient?.split(' ')[0] || ev.payerName?.split(' ')[0] || billingData.firstName,
            last_name: ev.shippingAddress?.recipient?.split(' ').slice(1).join(' ') || ev.payerName?.split(' ').slice(1).join(' ') || billingData.lastName,
            address_1: ev.shippingAddress?.addressLine?.[0] || billingData.address1,
            address_2: ev.shippingAddress?.addressLine?.[1] || billingData.address2,
            city: ev.shippingAddress?.city || billingData.city,
            state: ev.shippingAddress?.region || billingData.state,
            postcode: ev.shippingAddress?.postalCode || billingData.postcode,
            country: ev.shippingAddress?.country || billingData.country
          }
        };

        const response = await fetch('/api/stripe/payment-request-cart-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderData),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          if (result.requiresAction || result.paymentStatus === 'requires_action') {
            console.warn('[Apple/Google Pay Checkout] Payment requires 3DS authentication - not supported in Payment Request');
            ev.complete('fail');

            const errorMessage = 'Questo pagamento richiede autenticazione aggiuntiva. Per favore usa il checkout standard con carta di credito.';
            setError(errorMessage);
            onPaymentError?.(errorMessage);

            console.log(`[Apple/Google Pay Checkout] Order #${result.order_id} left pending - requires 3DS`);
            return;
          }

          ev.complete('success');
          clearCart();
          router.push(`/checkout/success?payment_intent=${result.paymentIntentId}&payment_method=stripe`);

        } else {
          throw new Error(result.error || 'Errore durante la creazione dell\'ordine');
        }
      } catch (error) {
        console.error('Errore durante il pagamento checkout:', error);
        const errorMessage = error instanceof Error ? error.message : 'Errore durante il pagamento';
        setError(errorMessage);
        onPaymentError?.(errorMessage);
        ev.complete('fail');
      } finally {
        setIsProcessing(false);
      }
    });

    // Cleanup: non resettiamo paymentRequest a null per evitare flickering
  }, [
    stripe,
    hasItems,
    cartKey,
    cart,
    discount,
    cartTotal,
    shippingCost,
    shippingMethodId,
    shippingMethodTitle,
    shippingMethodDescription,
    selectedShippingMethod,
    userId,
    billingData,
    shippingData,
    clearCart,
    router,
    onPaymentStart,
    onPaymentError
  ]);

  // useEffect 2: Aggiorna il Payment Request esistente quando cambiano i punti
  // Usa paymentRequest.update() invece di ricrearlo (Stripe limita canMakePayment a una sola chiamata)
  useEffect(() => {
    if (!paymentRequestRef.current) return;

    const currentFinalTotal = cartTotal - discount - pointsDiscount;
    if (currentFinalTotal <= 0) return;

    const displayItems = buildDisplayItems(pointsDiscount, pointsToRedeem);
    const shippingAmount = Math.round(shippingCost * 100);
    const totalWithShipping = Math.round(currentFinalTotal * 100) + shippingAmount;

    paymentRequestRef.current.update({
      total: {
        label: 'Totale Ordine DreamShop',
        amount: totalWithShipping,
      },
      displayItems: displayItems,
    });
  }, [pointsToRedeem, pointsDiscount, cartTotal, discount, shippingCost]);

  // Non mostrare se non ci sono items nel carrello
  if (!hasItems || finalTotal <= 0) {
    return null;
  }

  return (
    <div className={`apple-google-pay-checkout ${className}`}>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">❌ {error}</p>
        </div>
      )}
      
      {/* Debug Info per sviluppo */}
      {process.env.NODE_ENV === 'development' && debugInfo && !paymentRequest && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-700 text-sm">🔍 {debugInfo}</p>
          <p className="text-yellow-600 text-xs mt-1">
            Disponibile solo su Safari (iOS/Mac) o Chrome con carte salvate
          </p>
        </div>
      )}
      
      {/* Pulsanti Apple Pay / Google Pay */}
      {paymentRequest && (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-3">Pagamento veloce</p>
          </div>
          
          <PaymentRequestButtonElement
            options={{
              paymentRequest,
              style: {
                paymentRequestButton: {
                  type: 'buy',
                  theme: 'dark',
                  height: '48px',
                },
              },
            }}
          />
          
          {isProcessing && (
            <div className="flex items-center justify-center py-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600 mr-2"></div>
              <span className="text-sm text-gray-600">Elaborazione ordine...</span>
            </div>
          )}
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-500">oppure paga con carta</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}