'use client';

import React, { useState, useEffect } from 'react';
import { useStripe } from '@stripe/react-stripe-js';
import { Product } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

type PaymentRequest = ReturnType<NonNullable<ReturnType<typeof useStripe>>['paymentRequest']>;

interface PaymentRequestButtonProps {
  product: Product;
  quantity: number;
  enableDeposit?: 'yes' | 'no';
}

export default function PaymentRequestButton({ 
  product, 
  quantity, 
  enableDeposit = 'no' 
}: PaymentRequestButtonProps) {
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const { user } = useAuth();
  const router = useRouter();
  const stripe = useStripe();

  // Verifica se il prodotto è valido per l'acquisto
  const hasValidPrice = product.price && parseFloat(product.price) > 0;
  const isInStock = product.stock_status === 'instock' && hasValidPrice;

  useEffect(() => {
    if (!stripe || !isInStock) {
      return;
    }

    // Calcola il prezzo totale
    const unitPrice = parseFloat(product.sale_price || product.price || '0');
    const totalAmount = Math.round(unitPrice * quantity * 100); // Converti in centesimi

    // Crea il payment request
    const pr = stripe.paymentRequest({
      country: 'IT',
      currency: 'eur',
      total: {
        label: `${product.name} x${quantity}`,
        amount: totalAmount,
      },
      requestPayerName: true,
      requestPayerEmail: true,
      requestPayerPhone: true,
      requestShipping: true,
      shippingOptions: [
        {
          id: 'standard',
          label: 'Spedizione Standard',
          detail: '5-7 giorni lavorativi',
          amount: 0, // Spedizione gratuita per ora
        },
      ],
    });

    // Controlla se Apple Pay/Google Pay sono disponibili
    pr.canMakePayment().then(result => {
      console.log('Payment Request availability check:', result);
      console.log('Browser:', navigator.userAgent);
      console.log('HTTPS:', window.location.protocol === 'https:');
      
      if (result) {
        setPaymentRequest(pr);
        setDebugInfo('Payment Request disponibile');
      } else {

        
        const browserInfo = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') ? 'Safari' :
                           navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Altri';
        const httpsInfo = window.location.protocol === 'https:' ? 'HTTPS ✅' : 'HTTP ❌';
        
        setDebugInfo(`Payment Request non disponibile. Browser: ${browserInfo}, Protocollo: ${httpsInfo}`);
      }
    }).catch(error => {
      console.error('Errore nel check Payment Request:', error);
    });

    // Gestisce il click del pulsante
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pr.on('paymentmethod', async (ev: any) => {
      try {
        setIsProcessing(true);
        setError(null);

        // Crea l'ordine nel backend
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
            paymentMethodId: ev.paymentMethod.id,
            billingData: {
              first_name: ev.payerName?.split(' ')[0] || '',
              last_name: ev.payerName?.split(' ').slice(1).join(' ') || '',
              email: ev.payerEmail || '',
              phone: ev.payerPhone || '',
              address_1: ev.shippingAddress?.line1 || '',
              address_2: ev.shippingAddress?.line2 || '',
              city: ev.shippingAddress?.city || '',
              state: ev.shippingAddress?.state || '',
              postcode: ev.shippingAddress?.postal_code || '',
              country: ev.shippingAddress?.country || 'IT'
            },
            shippingData: {
              first_name: ev.shippingAddress?.recipient?.split(' ')[0] || ev.payerName?.split(' ')[0] || '',
              last_name: ev.shippingAddress?.recipient?.split(' ').slice(1).join(' ') || ev.payerName?.split(' ').slice(1).join(' ') || '',
              address_1: ev.shippingAddress?.line1 || '',
              address_2: ev.shippingAddress?.line2 || '',
              city: ev.shippingAddress?.city || '',
              state: ev.shippingAddress?.state || '',
              postcode: ev.shippingAddress?.postal_code || '',
              country: ev.shippingAddress?.country || 'IT'
            }
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Conferma il pagamento
          const { error: confirmError } = await stripe.confirmCardPayment(result.clientSecret);
          
          if (confirmError) {
            throw new Error(confirmError.message);
          }

          // Completa il payment request
          ev.complete('success');
          
          // Reindirizza alla pagina di successo
          router.push(`/checkout/success?order_id=${result.order_id}`);
        } else {
          throw new Error(result.error || 'Errore durante la creazione dell\'ordine');
        }
      } catch (error) {
        console.error('Errore durante il pagamento:', error);
        setError(error instanceof Error ? error.message : 'Errore durante il pagamento');
        ev.complete('fail');
      } finally {
        setIsProcessing(false);
      }
    });

    // Gestisce gli errori di shipping
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pr.on('shippingaddresschange', (ev: any) => {
      ev.updateWith({ status: 'success' });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pr.on('shippingoptionchange', (ev: any) => {
      ev.updateWith({ status: 'success' });
    });

  }, [stripe, product, quantity, enableDeposit, user, router, isInStock]);

  if (!isInStock) {
    return null;
  }

  return (
    <div className="mb-4">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      
      <div className="space-y-3">
        {/* Debug Info */}
        {debugInfo && !paymentRequest && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-yellow-700 text-sm">🔍 Debug: {debugInfo}</p>
            <p className="text-yellow-600 text-xs mt-1">
              Per testare Apple Pay: usa Safari su Mac/iOS con Touch ID/Face ID configurato
            </p>
          </div>
        )}
        
        {/* Payment Request Button */}
        <div 
          id="payment-request-button"
          onClick={() => {
            if (paymentRequest && !isProcessing) {
              paymentRequest.show();
            }
          }}
          className={`
            w-full h-12 bg-black text-white rounded-lg 
            flex items-center justify-center cursor-pointer
            hover:bg-gray-800 transition-colors
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
            ${paymentRequest ? 'block' : 'hidden'}
          `}
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              <span>Elaborazione...</span>
            </>
          ) : (
            <div className="flex items-center">
              {/* Apple Pay Icon */}
              <svg className="w-8 h-8 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.365 8.837c-.011 2.438 2.15 3.642 2.246 3.694-.019.06-.351 1.201-1.158 2.379-.7.985-1.427 1.969-2.57 1.988-1.122.02-1.483-.666-2.765-.666-1.282 0-1.684.646-2.745.686-1.102.04-1.933-1.062-2.636-2.045-1.437-2.008-2.535-5.676-1.061-8.148.73-1.226 2.036-2.003 3.454-2.023 1.08-.02 2.099.727 2.765.727.666 0 1.912-.9 3.22-.768.548.023 2.088.222 3.077 1.666-.08.05-1.836 1.072-1.827 3.21z"/>
                <path d="M13.44 5.685c.584-.7.978-1.674.871-2.643-.843.034-1.862.562-2.468 1.27-.543.631-.1.016-1.612 2.01-.894-.027-1.81-.538-2.27-1.27.584-.631 1.51-1.062 2.468-1.27.894.027 1.612.538 2.011 1.27z"/>
              </svg>
              <span className="font-medium text-lg">Pay</span>
              
              {/* Separatore */}
              <div className="mx-3 h-6 w-px bg-gray-400"></div>
              
              {/* Google Pay Icon */}
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10.55 17.9h2.9v-7.35h-2.9V17.9zM20.87 12.25c-.05-.27-.12-.53-.21-.78h-9.11v1.49h5.19c-.22 1.18-.89 2.18-1.89 2.85v2.36h3.06c1.78-1.64 2.81-4.05 2.96-5.92z"/>
                <path d="M11.45 19.9c2.55 0 4.69-.84 6.25-2.29l-3.06-2.36c-.84.56-1.91.89-3.19.89-2.45 0-4.52-1.66-5.26-3.89H2.88v2.44c1.56 3.09 4.76 5.21 8.57 5.21z"/>
                <path d="M6.19 13.25c-.19-.56-.29-1.16-.29-1.78s.1-1.22.29-1.78V7.25H2.88C2.32 8.38 2 9.65 2 11.47s.32 3.09.88 4.22l3.31-2.44z"/>
                <path d="M11.45 4.7c1.38 0 2.62.47 3.59 1.4l2.69-2.69C16.14 1.91 13.99 1 11.45 1 7.64 1 4.44 3.12 2.88 6.21l3.31 2.44c.74-2.23 2.81-3.95 5.26-3.95z"/>
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}