'use client';

import React, { useState, useEffect } from 'react';
import { PaymentRequestButtonElement, useStripe } from '@stripe/react-stripe-js';
import { Product } from '@/lib/api';
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
        const response = await fetch(`/api/products/${product.id}/deposit-options`);
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
  }, [product.id, enableDeposit]);

  useEffect(() => {
    if (!stripe || !isInStock) {
      return;
    }


    // Calcola il prezzo totale
    const unitPrice = parseFloat(product.sale_price || product.price || '0');
    let totalAmount = unitPrice * quantity;

    // Se l'acconto è abilitato, calcola l'importo dell'acconto
    if (enableDeposit === 'yes' && depositOptions) {
      const depositAmount = parseFloat(depositOptions.depositAmount);
      if (depositOptions.depositType === 'percent') {
        // Calcola la percentuale dell'acconto
        totalAmount = totalAmount * (depositAmount / 100);
      } else {
        // Acconto fisso
        totalAmount = depositAmount * quantity;
      }
    }

    totalAmount = Math.round(totalAmount * 100); // Converti in centesimi

    // Crea il payment request con configurazione semplificata
    const pr = stripe.paymentRequest({
      country: 'IT',
      currency: 'eur',
      total: {
        label: `${product.name} x${quantity}`,
        amount: totalAmount,
      },
      requestPayerName: true,
      requestPayerEmail: true,
      requestShipping: true,
      shippingOptions: [
        {
          id: 'standard',
          label: 'Spedizione Standard',
          detail: '5-7 giorni lavorativi',
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
          // Pagamento già confermato dal backend

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

  }, [stripe, product, quantity, enableDeposit, depositOptions, user, router, isInStock, variationId, variationAttributes]);

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