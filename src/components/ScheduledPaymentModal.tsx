import React, { useState } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { getStripe } from '@/lib/stripe';
import { paypalOptions } from '@/lib/paypal';
import { useAuth } from '@/context/AuthContext';

// Componente interno che gestisce il form di pagamento
const CheckoutForm = ({
  orderId,
  orderTotal,
  onClose,
  onSuccess,
  onError
}: {
  orderId: number;
  orderTotal: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { token } = useAuth(); // Usato solo per stripe-pay, non per il polling
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCardElementReady, setIsCardElementReady] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  
  // NON recuperiamo il client secret all'avvio del componente
  // Lo faremo solo quando l'utente preme il pulsante di pagamento
  
  // Gestisce la sottomissione del form
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js non disponibile
      onError('Il sistema di pagamento non è pronto. Riprova tra qualche istante.');
      return;
    }
    
    // Previene conferme di pagamento multiple
    if (isProcessing || paymentCompleted) {
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      // Verifica che l'elemento della carta sia disponibile
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Elemento carta non disponibile');
      }

      // Otteniamo il client secret solo al momento del pagamento
      let secret: string | null = clientSecret;
      
      if (!secret) {
        // Crea un nuovo PaymentIntent solo ora
        const response = await fetch(`/api/scheduled-orders/${orderId}/stripe-pay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Errore nel recupero del client secret: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.clientSecret) {
          secret = data.clientSecret;
          setClientSecret(secret);
        } else {
          console.error('Client secret non trovato nella risposta API');
          throw new Error('Client secret non trovato');
        }
      }

      // A questo punto, se secret è ancora null, lanciamo un errore
      if (!secret) {
        throw new Error('Impossibile ottenere il client secret per il pagamento');
      }

      // Conferma il pagamento con Stripe
      const result = await stripe.confirmCardPayment(secret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: 'Cliente Dreamshop',
          },
        }
      });

      if (result.error) {
        throw new Error(result.error.message || 'Errore durante il pagamento');
      } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {

        // ✅ OBBLIGATORIO: Attendiamo che il webhook Stripe processi il pagamento
        // Il webhook è la UNICA fonte di verità per l'aggiornamento dell'ordine
        // Se il webhook non processa, il pagamento FALLISCE
        console.log('✅ Pagamento confermato su Stripe. Attendiamo conferma webhook...');
        console.log('Payment Intent ID:', result.paymentIntent.id);

        // Polling OBBLIGATORIO per verificare che webhook abbia processato
        let webhookProcessed = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 secondi max (stesso del checkout)

        // Aggiorniamo il messaggio di elaborazione per l'utente
        setPaymentError(null); // Puliamo eventuali errori precedenti

        while (!webhookProcessed && attempts < maxAttempts) {
          try {
            // Attendiamo 1 secondo prima di verificare
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;

            console.log(`Tentativo ${attempts}/${maxAttempts}: Verifica processing webhook...`);

            // Verifichiamo tramite endpoint pubblico dedicato (NO JWT necessario)
            const checkResponse = await fetch(
              `/api/stripe/get-scheduled-order-status?payment_intent_id=${result.paymentIntent.id}`
            );

            if (checkResponse.ok) {
              const data = await checkResponse.json();

              // Status 200 = webhook ha processato con successo
              if (data.success && data.processed) {
                webhookProcessed = true;
                console.log(`✅ Webhook ha processato la rata dopo ${attempts} secondi`);
              }
            } else if (checkResponse.status === 202) {
              // Status 202 = pagamento in elaborazione, continua il polling
              console.log(`Tentativo ${attempts}: Pagamento in elaborazione...`);
            } else {
              // Altri errori (400, 404, 500)
              console.warn(`Tentativo ${attempts}: Errore HTTP ${checkResponse.status}`);
            }
          } catch (pollError) {
            console.warn('Tentativo di verifica webhook fallito:', pollError);
          }
        }

        // ⚠️ CRITICO: Se il webhook NON ha processato, BLOCCHIAMO il completamento
        if (!webhookProcessed) {
          console.error('❌ ERRORE CRITICO: Webhook non ha processato il pagamento entro 30 secondi');
          console.error('Il pagamento è stato addebitato su Stripe ma la rata non è stata aggiornata');
          console.error('Payment Intent ID:', result.paymentIntent.id);

          // Lanciamo un errore per bloccare il flusso
          throw new Error(
            'Impossibile confermare il pagamento. Il tuo pagamento è stato elaborato da Stripe, ' +
            'ma si è verificato un errore nella comunicazione con il server. ' +
            'Ti preghiamo di contattare il supporto se la rata non viene aggiornata automaticamente. ' +
            `Codice pagamento: ${result.paymentIntent.id}`
          );
        }

        // ✅ Se arriviamo qui, il webhook ha processato con successo
        setPaymentCompleted(true);
        onSuccess();
      } else {
        throw new Error(`Stato pagamento non riconosciuto: ${result.paymentIntent?.status || 'sconosciuto'}`);
      }
    } catch (error: unknown) {
      console.error('Errore durante il pagamento:', error);
      const errorMessage = error instanceof Error ? error.message : 'Si è verificato un errore durante il pagamento';
      setPaymentError(errorMessage);
      onError(errorMessage);

      // Se l'errore è relativo al webhook, mostriamo un messaggio più dettagliato
      if (errorMessage.includes('Impossibile confermare il pagamento')) {
        alert(
          '⚠️ ATTENZIONE - Pagamento in Elaborazione\n\n' +
          'Il tuo pagamento è stato addebitato correttamente su Stripe, ' +
          'ma si è verificato un problema tecnico nella conferma dell\'ordine.\n\n' +
          'Per favore:\n' +
          '1. NON effettuare un altro pagamento\n' +
          '2. Attendi qualche minuto e ricarica la pagina\n' +
          '3. Se l\'ordine non si aggiorna, contatta il supporto con questo codice:\n\n' +
          errorMessage.split('Codice pagamento: ')[1]
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-medium">Importo da pagare:</span>
          <span className="text-xl font-bold text-bred-500">{orderTotal}</span>
        </div>
        
        <label className="block text-gray-700 mb-2">
          Dettagli Carta
        </label>
        <div className="border rounded p-3 bg-white">
          <CardElement
            options={{
              hidePostalCode: true, // Rimuoviamo il campo CAP/codice postale
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
            onChange={(event) => {
              setIsCardElementReady(event.complete);
            }}
          />
        </div>
      </div>

      {paymentError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {paymentError}
        </div>
      )}
      
      <div className="flex justify-between space-x-2 mt-4">
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
        >
          Annulla
        </button>
        <button
          type="submit"
          disabled={!isCardElementReady || isProcessing}
          className="bg-bred-500 text-white px-4 py-2 rounded hover:bg-bred-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Elaborazione...
            </>
          ) : 'Paga ora'}
        </button>
      </div>
    </form>
  );
};

// Componente principale che gestisce il modale
const ScheduledPaymentModal = ({ 
  isOpen, 
  onClose, 
  orderId,
  orderTotal,
  onSuccess,
  onError
}: {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  orderTotal: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal' | null>(null);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white bg-opacity-20 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg text-gray-600 font-semibold">Pagamento Rata #{orderId}</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600"
            aria-label="Chiudi modale"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {!paymentMethod ? (
          <div className="p-6">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg text-gray-600 font-medium">Importo da pagare:</span>
                <span className="text-xl font-bold text-bred-500">{orderTotal}</span>
              </div>
              <p className="mb-4 text-gray-700">Scegli il metodo di pagamento:</p>
            </div>
            
            <div className="grid grid-cols-1 gap-4 mb-6">
              <button
                onClick={() => setPaymentMethod('stripe')}
                className="flex items-center justify-center space-x-2 p-4 border-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="#000">
                  <path d="M10.5 13.5h2.7c.3 0 .5-.2.5-.5v-1c0-.3-.2-.5-.5-.5h-2.7c-.3 0-.5.2-.5.5v1c0 .3.2.5.5.5zm-6.8-3.5c-.5 0-.7.2-.7.7v3.6c0 .5.2.7.7.7h16.6c.5 0 .7-.2.7-.7v-3.6c0-.5-.2-.7-.7-.7H3.7zm16.6-3H3.7c-.5 0-.7.2-.7.7v.4c0 .4.2.6.7.6h16.6c.5 0 .7-.2.7-.7v-.3c0-.5-.2-.7-.7-.7zm0 10.9H3.7c-.5 0-.7.2-.7.7v.3c0 .5.2.7.7.7h16.6c.5 0 .7-.2.7-.7v-.3c0-.5-.2-.7-.7-.7z"/>
                </svg>
                <span className="font-medium text-gray-600">Carta di Credito/Debito</span>
              </button>
              
              <button
                onClick={() => setPaymentMethod('paypal')}
                className="flex items-center justify-center space-x-2 p-4 border-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="#003087">
                <path d="M4.4 22.48h-3.64c-0.24 0-0.44-0.080-0.56-0.28-0.16-0.16-0.2-0.4-0.16-0.6l2.4-14.56c0.040-0.36 0.36-0.64 0.72-0.64h6.76c0.040 0 1.68-0.040 2.8 1.040 0.72 0.68 1.080 1.68 1.080 2.88 0 3.44-2.48 5.84-6 5.84h-1.76l-0.88 5.68c-0.080 0.36-0.4 0.64-0.76 0.64zM1.64 20.96h2.12l0.88-5.68c0.040-0.36 0.36-0.64 0.76-0.64h2.4c2.24 0 4.48-1.36 4.48-4.36 0-0.8-0.2-1.4-0.64-1.8-0.68-0.68-1.72-0.64-1.76-0.64h-6.12l-2.12 13.12zM7.040 25.6h-2.84c-0.4 0-0.76-0.32-0.76-0.76s0.32-0.76 0.76-0.76h2.2l0.88-5.68c0.040-0.36 0.36-0.64 0.76-0.64h0.4c1.24 0 5.44-0.32 6.52-4.52 0.12-0.4 0.52-0.64 0.92-0.56 0.4 0.12 0.64 0.52 0.56 0.92-1.040 4.080-4.64 5.6-7.72 5.68l-0.88 5.68c-0.12 0.36-0.44 0.64-0.8 0.64z"></path>                </svg>
                <span className="font-medium text-gray-600">PayPal</span>
              </button>
            </div>
            
            <div className="flex justify-between space-x-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Annulla
              </button>
            </div>
          </div>
        ) : paymentMethod === 'stripe' ? (
          <Elements stripe={getStripe()}>
            <CheckoutForm
              orderId={orderId}
              orderTotal={orderTotal}
              onClose={() => setPaymentMethod(null)}
              onSuccess={onSuccess}
              onError={onError}
            />
          </Elements>
        ) : (
          <div className="p-6">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-medium">Importo da pagare:</span>
                <span className="text-xl font-bold text-bred-500">{orderTotal}</span>
              </div>
              <p className="mb-4 text-gray-600 text-sm">Completa il pagamento con PayPal</p>
            </div>
            
            <div className="mt-6 mb-6">
              <PayPalButtonsWrapper 
                orderId={orderId} 
                orderTotal={orderTotal}
                onSuccess={onSuccess}
                onError={onError}
                onCancel={() => setPaymentMethod(null)}
              />
            </div>
            
            <div className="flex justify-between space-x-2 mt-4">
              <button
                type="button"
                onClick={() => setPaymentMethod(null)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Indietro
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Componente wrapper per i pulsanti PayPal
const PayPalButtonsWrapper = ({ 
  orderId, 
  orderTotal,
  onSuccess,
  onError,
  onCancel
}: {
  orderId: number;
  orderTotal: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  // Utilizziamo useState readonly per paypalError perché non lo modifichiamo in questo componente
  const [paypalError] = useState<string | null>(null);
  const { token } = useAuth();

  // Gestisce la creazione dell'ordine PayPal - usa direttamente le API del SDK PayPal
  // Usiamo type any per actions poiché i tipi PayPal sono complessi e specifici
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createOrder = async (data: unknown, actions: any) => {
    try {
      // Puliamo l'importo da eventuali caratteri di formattazione
      const cleanedAmount = orderTotal.replace(/[^0-9.,]/g, '').replace(',', '.');
      const parsedAmount = parseFloat(cleanedAmount).toFixed(2);
      
      
      // Creiamo l'ordine PayPal direttamente tramite l'SDK
      return actions.order.create({
        purchase_units: [{
          amount: {
            currency_code: 'EUR',
            value: parsedAmount
          },
          description: `Pagamento rata programmata #${orderId}`
        }]
      });
    } catch (error) {
      console.error('Errore nella creazione dell\'ordine PayPal:', error);
      throw error;
    }
  };

  // Gestisce la cattura del pagamento dopo l'approvazione PayPal
  // Usiamo type any per actions poiché i tipi PayPal sono complessi e specifici
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onApprove = async (data: unknown, actions: any) => {
    setIsLoading(true);

    try {
      // Verifichiamo che data sia un oggetto e abbia la proprietà orderID
      if (!data || typeof data !== 'object' || !('orderID' in data)) {
        throw new Error('Dati PayPal non validi');
      }

      const paypalData = data as { orderID: string };

      // Cattura il pagamento usando SDK PayPal (come nel checkout)
      if (!actions.order) {
        throw new Error('Oggetto actions.order non disponibile');
      }

      const captureResult = await actions.order.capture();
      console.log('[PAYPAL-RATE] Pagamento catturato con successo');

      // Estrai l'ID della transazione PayPal
      const transactionId = captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.id || paypalData.orderID;

      // Estrai l'importo effettivamente pagato da PayPal (fonte di verità)
      const amountValue =
        captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ||
        captureResult.purchase_units?.[0]?.amount?.value;

      const actualPaidAmount = amountValue ? parseFloat(amountValue) : 0;

      if (!actualPaidAmount || actualPaidAmount <= 0) {
        throw new Error('Impossibile estrarre l\'importo pagato da PayPal');
      }

      // Notifica backend che il pagamento è stato completato
      const response = await fetch(`/api/scheduled-orders/${orderId}/complete-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentIntentId: paypalData.orderID,  // ID dell'ordine PayPal
          paymentMethod: 'paypal',
          transactionId: transactionId,
          expectedTotal: actualPaidAmount  // Importo reale pagato da PayPal
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Errore nel completamento del pagamento');
      }

      console.log('[PAYPAL-RATE] ✅ Rata aggiornata con successo');
      onSuccess();
    } catch (error: unknown) {
      console.error('[PAYPAL-RATE] Errore durante il pagamento:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore durante il pagamento PayPal';
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="paypal-buttons-container">
      {isLoading && (
        <div className="flex justify-center items-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
        </div>
      )}
      
      {paypalError && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4">
          {paypalError}
        </div>
      )}
      
      <PayPalScriptProvider options={paypalOptions}>
        <PayPalButtons
          createOrder={createOrder}
          onApprove={onApprove}
          onCancel={onCancel}
          onError={(err) => {
            console.error('Errore PayPal:', err);
            onError('Errore durante il checkout con PayPal');
          }}
          style={{ layout: 'vertical', shape: 'rect' }}
          disabled={isLoading}
        />
      </PayPalScriptProvider>
    </div>
  );
};

export default ScheduledPaymentModal;
