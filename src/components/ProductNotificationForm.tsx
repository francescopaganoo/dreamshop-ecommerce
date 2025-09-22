'use client';

import { useState } from 'react';
import { FaBell, FaEnvelope, FaUser } from 'react-icons/fa';
import { subscribeToProduct } from '../lib/notifications';

interface ProductNotificationFormProps {
  productId: number;
  productName: string;
}

export default function ProductNotificationForm({ productId, productName }: ProductNotificationFormProps) {
  const [email, setEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Inserisci la tua email' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const result = await subscribeToProduct({
        email: email.trim(),
        product_id: productId,
        customer_name: customerName.trim()
      });

      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Iscrizione completata! Ti avviseremo quando sarà disponibile.' });
        setIsSubscribed(true);
        setEmail('');
        setCustomerName('');
      } else {
        setMessage({ 
          type: 'error', 
          text: result.message || 'Errore durante l\'iscrizione. Riprova più tardi.' 
        });
      }
    } catch (error: unknown) {
      console.error('Error subscribing to notifications:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore di connessione. Riprova più tardi.';
      setMessage({ 
        type: 'error', 
        text: errorMessage
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubscribed) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <FaBell className="h-5 w-5 text-green-500" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-green-800">
              Iscrizione completata!
            </h3>
            <p className="text-sm text-green-600">
              Ti invieremo un&apos;email quando <strong>{productName}</strong> sarà di nuovo disponibile.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <FaBell className="h-5 w-5 text-bred-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">
            Prodotto Non Disponibile
          </h3>
        </div>
        <p className="text-gray-600">
          Inserisci la tua email per ricevere una notifica quando <strong>{productName}</strong> tornerà disponibile.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="notification-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaEnvelope className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="email"
              id="notification-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="la-tua-email@esempio.com"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-bred-500 focus:border-bred-500"
              required
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div>
          <label htmlFor="notification-name" className="block text-sm font-medium text-gray-700 mb-1">
            Nome (opzionale)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaUser className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              id="notification-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Il tuo nome"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-bred-500 focus:border-bred-500"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-md ${message.type === 'success' 
            ? 'bg-green-100 text-green-700 border border-green-200' 
            : 'bg-red-100 text-red-700 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !email.trim()}
          className="w-full bg-bred-500 text-white py-2 px-4 rounded-md hover:bg-bred-700 focus:outline-none focus:ring-2 focus:ring-bred-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Iscrizione in corso...
            </div>
          ) : (
            <>
              <FaBell className="inline-block mr-2" />
              Avvisami quando disponibile
            </>
          )}
        </button>
      </form>

      <p className="text-xs text-gray-500 mt-3">
        Riceverai una sola email quando il prodotto tornerà disponibile. Puoi disiscriverti in qualsiasi momento.
      </p>
    </div>
  );
}