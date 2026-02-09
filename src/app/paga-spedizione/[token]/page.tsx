'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { getStripe } from '@/lib/stripe';
import { paypalOptions } from '@/lib/paypal';
import { ResinShippingFee, getResinShippingFeeByToken } from '@/lib/resinShipping';

type PageState = 'loading' | 'ready' | 'processing' | 'success' | 'error' | 'already_paid' | 'not_found';

// Stripe checkout form for public payment page
const PublicStripeForm = ({
  shippingFee,
  token,
  onSuccess,
  onError
}: {
  shippingFee: ResinShippingFee;
  token: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCardReady, setIsCardReady] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || isProcessing) return;

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Elemento carta non disponibile');

      let secret = clientSecret;

      if (!secret) {
        const response = await fetch(`/api/resin-shipping/${token}/stripe-pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Errore: ${response.status}`);
        }

        const data = await response.json();
        if (data.success && data.clientSecret) {
          secret = data.clientSecret;
          setClientSecret(secret);
        } else {
          throw new Error('Client secret non trovato');
        }
      }

      if (!secret) throw new Error('Impossibile ottenere il client secret');

      const result = await stripe.confirmCardPayment(secret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: 'Cliente Dreamshop' },
        }
      });

      if (result.error) {
        throw new Error(result.error.message || 'Errore durante il pagamento');
      }

      if (result.paymentIntent?.status === 'succeeded') {
        // Poll for webhook processing
        let processed = false;
        let attempts = 0;

        while (!processed && attempts < 30) {
          await new Promise(r => setTimeout(r, 1000));
          attempts++;

          try {
            const check = await fetch(`/api/stripe/get-resin-shipping-status?payment_intent_id=${result.paymentIntent.id}`);
            if (check.ok) {
              const data = await check.json();
              if (data.success && data.processed) processed = true;
            }
          } catch { /* continue */ }
        }

        if (!processed) {
          throw new Error(
            'Il pagamento è stato addebitato ma si è verificato un errore nella conferma. ' +
            'Contatta il supporto se la spedizione non viene aggiornata. ' +
            `Codice: ${result.paymentIntent.id}`
          );
        }

        onSuccess();
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Errore durante il pagamento';
      setPaymentError(msg);
      onError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <label className="block text-gray-700 mb-2 font-medium">Dettagli Carta</label>
        <div className="border-2 rounded-lg p-4 bg-white">
          <CardElement
            options={{
              hidePostalCode: true,
              style: {
                base: { fontSize: '16px', color: '#424770', '::placeholder': { color: '#aab7c4' } },
                invalid: { color: '#9e2146' },
              },
            }}
            onChange={(e) => setIsCardReady(e.complete)}
          />
        </div>
      </div>

      {paymentError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {paymentError}
        </div>
      )}

      <button
        type="submit"
        disabled={!isCardReady || isProcessing}
        className="w-full bg-gray-900 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Elaborazione in corso...
          </>
        ) : (
          `Paga €${shippingFee.shipping_amount}`
        )}
      </button>
    </form>
  );
};

// PayPal wrapper for public payment
const PublicPayPalWrapper = ({
  shippingFee,
  token,
  onSuccess,
  onError
}: {
  shippingFee: ResinShippingFee;
  token: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}) => {
  const [isLoading, setIsLoading] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createOrder = async (_data: unknown, actions: any) => {
    return actions.order.create({
      purchase_units: [{
        amount: { currency_code: 'EUR', value: parseFloat(shippingFee.shipping_amount).toFixed(2) },
        description: `Spedizione resina per ordine #${shippingFee.order_number}`
      }]
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onApprove = async (data: unknown, actions: any) => {
    setIsLoading(true);
    try {
      if (!data || typeof data !== 'object' || !('orderID' in data)) {
        throw new Error('Dati PayPal non validi');
      }

      const paypalData = data as { orderID: string };
      const captureResult = await actions.order.capture();

      const transactionId = captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.id || paypalData.orderID;
      const amountValue = captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
      const actualAmount = amountValue ? parseFloat(amountValue) : 0;

      if (!actualAmount || actualAmount <= 0) {
        throw new Error('Impossibile verificare l\'importo pagato');
      }

      const response = await fetch(`/api/resin-shipping/${token}/complete-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: 'paypal',
          transactionId,
          paypalOrderId: paypalData.orderID,
          expectedTotal: actualAmount
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nel completamento del pagamento');
      }

      onSuccess();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Errore PayPal';
      onError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {isLoading && (
        <div className="flex justify-center items-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
        </div>
      )}
      <PayPalScriptProvider options={paypalOptions}>
        <PayPalButtons
          createOrder={createOrder}
          onApprove={onApprove}
          onError={(err) => { console.error('Errore PayPal:', err); onError('Errore PayPal'); }}
          style={{ layout: 'vertical', shape: 'rect' }}
          disabled={isLoading}
        />
      </PayPalScriptProvider>
    </div>
  );
};

// Main public payment page
export default function PagaSpedizionePage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [shippingFee, setShippingFee] = useState<ResinShippingFee | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getResinShippingFeeByToken(token);
        setShippingFee(data);

        if (data.payment_status === 'paid') {
          setPageState('already_paid');
        } else {
          setPageState('ready');
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : '';
        if (msg === 'NOT_FOUND') {
          setPageState('not_found');
        } else {
          setPageState('error');
          setErrorMessage('Impossibile caricare i dettagli della spedizione. Riprova.');
        }
      }
    };

    if (token) {
      fetchData();
    }
  }, [token]);

  const handleSuccess = () => {
    setPageState('success');
  };

  const handleError = (message: string) => {
    setErrorMessage(message);
  };

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento in corso...</p>
        </div>
      </div>
    );
  }

  // Not found
  if (pageState === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-red-500 mb-4">
            <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link non valido</h1>
          <p className="text-gray-600">Questo link di pagamento non è valido o è scaduto.</p>
        </div>
      </div>
    );
  }

  // Already paid
  if (pageState === 'already_paid' && shippingFee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-green-500 mb-4">
            <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Spedizione già pagata</h1>
          <p className="text-gray-600 mb-4">
            La spedizione per l&apos;ordine <strong>#{shippingFee.order_number}</strong> è già stata pagata.
          </p>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">{shippingFee.product_name}</p>
            <p className="text-lg font-bold text-green-600">&euro;{shippingFee.shipping_amount}</p>
            {shippingFee.paid_at && (
              <p className="text-xs text-gray-400 mt-1">
                Pagato il {new Date(shippingFee.paid_at).toLocaleDateString('it-IT')}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Success
  if (pageState === 'success' && shippingFee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-green-500 mb-4">
            <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagamento completato!</h1>
          <p className="text-gray-600 mb-4">
            La spedizione per l&apos;ordine <strong>#{shippingFee.order_number}</strong> è stata pagata con successo.
          </p>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">{shippingFee.product_name}</p>
            <p className="text-lg font-bold text-green-600">&euro;{shippingFee.shipping_amount}</p>
          </div>
          <p className="text-sm text-gray-500 mt-4">Grazie per aver scelto DreamShop!</p>
        </div>
      </div>
    );
  }

  // Error state
  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-red-500 mb-4">
            <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Errore</h1>
          <p className="text-gray-600">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  // Ready state - show payment form
  if (!shippingFee) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">DreamShop</h1>
          <p className="text-gray-500 mt-1">Pagamento Spedizione</p>
        </div>

        {/* Order details card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
          <div className="bg-gray-900 px-6 py-4">
            <h2 className="text-white font-semibold text-lg">Dettagli Spedizione</h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Ordine</span>
                <span className="font-medium text-gray-900">#{shippingFee.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Prodotto</span>
                <span className="font-medium text-gray-900 text-right max-w-[200px]">{shippingFee.product_name}</span>
              </div>
              <hr />
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Costo Spedizione</span>
                <span className="text-2xl font-bold text-gray-900">&euro;{shippingFee.shipping_amount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment method selection */}
        {!paymentMethod ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Scegli il metodo di pagamento</h3>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setPaymentMethod('stripe')}
                className="flex items-center justify-center space-x-3 p-4 border-2 rounded-lg hover:border-gray-900 hover:bg-gray-50 transition-all"
              >
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="#000">
                  <path d="M10.5 13.5h2.7c.3 0 .5-.2.5-.5v-1c0-.3-.2-.5-.5-.5h-2.7c-.3 0-.5.2-.5.5v1c0 .3.2.5.5.5zm-6.8-3.5c-.5 0-.7.2-.7.7v3.6c0 .5.2.7.7.7h16.6c.5 0 .7-.2.7-.7v-3.6c0-.5-.2-.7-.7-.7H3.7zm16.6-3H3.7c-.5 0-.7.2-.7.7v.4c0 .4.2.6.7.6h16.6c.5 0 .7-.2.7-.7v-.3c0-.5-.2-.7-.7-.7zm0 10.9H3.7c-.5 0-.7.2-.7.7v.3c0 .5.2.7.7.7h16.6c.5 0 .7-.2.7-.7v-.3c0-.5-.2-.7-.7-.7z"/>
                </svg>
                <span className="font-medium text-gray-700">Carta di Credito/Debito</span>
              </button>

              <button
                onClick={() => setPaymentMethod('paypal')}
                className="flex items-center justify-center space-x-3 p-4 border-2 rounded-lg hover:border-gray-900 hover:bg-gray-50 transition-all"
              >
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="#003087">
                  <path d="M4.4 22.48h-3.64c-0.24 0-0.44-0.080-0.56-0.28-0.16-0.16-0.2-0.4-0.16-0.6l2.4-14.56c0.040-0.36 0.36-0.64 0.72-0.64h6.76c0.040 0 1.68-0.040 2.8 1.040 0.72 0.68 1.080 1.68 1.080 2.88 0 3.44-2.48 5.84-6 5.84h-1.76l-0.88 5.68c-0.080 0.36-0.4 0.64-0.76 0.64zM1.64 20.96h2.12l0.88-5.68c0.040-0.36 0.36-0.64 0.76-0.64h2.4c2.24 0 4.48-1.36 4.48-4.36 0-0.8-0.2-1.4-0.64-1.8-0.68-0.68-1.72-0.64-1.76-0.64h-6.12l-2.12 13.12z"></path>
                </svg>
                <span className="font-medium text-gray-700">PayPal</span>
              </button>
            </div>
          </div>
        ) : paymentMethod === 'stripe' ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Pagamento con Carta</h3>
              <button onClick={() => setPaymentMethod(null)} className="text-sm text-gray-500 hover:text-gray-700">
                Cambia metodo
              </button>
            </div>
            <Elements stripe={getStripe()}>
              <PublicStripeForm
                shippingFee={shippingFee}
                token={token}
                onSuccess={handleSuccess}
                onError={handleError}
              />
            </Elements>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Pagamento con PayPal</h3>
              <button onClick={() => setPaymentMethod(null)} className="text-sm text-gray-500 hover:text-gray-700">
                Cambia metodo
              </button>
            </div>
            <PublicPayPalWrapper
              shippingFee={shippingFee}
              token={token}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </div>
        )}

        {errorMessage && pageState === 'ready' && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-400">
            Pagamento sicuro gestito da Stripe e PayPal.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            &copy; {new Date().getFullYear()} DreamShop. Tutti i diritti riservati.
          </p>
        </div>
      </div>
    </div>
  );
}
