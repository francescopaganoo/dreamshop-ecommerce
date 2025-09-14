'use client';

import React, { useState, useEffect } from 'react';
import { PaymentRequestButtonElement, useStripe } from '@stripe/react-stripe-js';
import { useCart } from '@/context/CartContext';
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
}

export default function AppleGooglePayCheckout({
  billingData,
  shippingData,
  onPaymentStart,
  onPaymentError,
  className = ''
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

  // Verifica se il carrello è valido
  const hasItems = cart.length > 0;
  const cartTotal = getCartTotal();
  const finalTotal = cartTotal - discount;

  useEffect(() => {
    if (!stripe || !hasItems || finalTotal <= 0) {
      return;
    }



    // Prepara gli item del carrello per il display
    const displayItems = cart.map(item => ({
      label: `${item.product.name} x${item.quantity}`,
      amount: Math.round(parseFloat(item.product.price || '0') * item.quantity * 100)
    }));

    // Aggiungi sconto se presente
    if (discount > 0) {
      displayItems.push({
        label: 'Sconto',
        amount: -Math.round(discount * 100)
      });
    }

    // Crea il payment request
    const pr = stripe.paymentRequest({
      country: 'IT',
      currency: 'eur',
      total: {
        label: 'Totale Ordine DreamShop',
        amount: Math.round(finalTotal * 100),
      },
      displayItems: displayItems,
      requestPayerName: true,
      requestPayerEmail: true,
      requestShipping: true,
      shippingOptions: [
        {
          id: 'standard',
          label: 'Spedizione Standard',
          detail: '5-7 giorni lavorativi',
          amount: 0, // Spedizione gratuita
        },
        {
          id: 'express',
          label: 'Spedizione Express',
          detail: '2-3 giorni lavorativi',
          amount: 500, // €5.00 in centesimi
        }
      ],
    });

    // Controlla disponibilità
    pr.canMakePayment().then(result => {
      
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

    // Gestisce il cambio del metodo di spedizione
    pr.on('shippingoptionchange', (ev) => {
      const shippingOption = ev.shippingOption;
      const shippingCost = shippingOption.amount;
      
      // Aggiorna il totale includendo i costi di spedizione
      const newTotal = Math.round(finalTotal * 100) + shippingCost;
      
      const updatedDisplayItems = [...displayItems];
      if (shippingCost > 0) {
        updatedDisplayItems.push({
          label: shippingOption.label,
          amount: shippingCost
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
    });

    // Gestisce il pagamento
    pr.on('paymentmethod', async (ev) => {
      try {
        setIsProcessing(true);
        setError(null);
        onPaymentStart?.();

        console.log('Payment method ricevuto:', ev.paymentMethod);

        // Prepara i dati per l'API
        const orderData = {
          cartItems: cart.map(item => ({
            product_id: item.product.id,
            variation_id: item.variation_id || null,
            quantity: item.quantity,
            name: item.product.name,
            price: item.product.price
          })),
          userId: user?.id || 0,
          paymentMethodId: ev.paymentMethod.id,
          shippingOption: ev.shippingOption,
          discount: discount,
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

        // Chiama l'API per processare l'ordine del carrello
        const response = await fetch('/api/stripe/payment-request-cart-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderData),
        });

        const result = await response.json();
        console.log('Risultato ordine carrello:', result);

        if (response.ok && result.success) {
          // Pagamento completato con successo
          console.log('✅ Ordine carrello completato:', result.order_id);
          
          ev.complete('success');
          
          // Svuota il carrello
          clearCart();
          
          // Reindirizza alla pagina di successo
          router.push(`/checkout/success?order_id=${result.order_id}`);
          
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

  }, [stripe, cart, finalTotal, hasItems, billingData, shippingData, user, discount, clearCart, router, onPaymentStart, onPaymentError]);

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