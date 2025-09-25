'use client';

import { useState, useEffect } from 'react';

interface GiftCardFormProps {
  productId: number;
  onDataChange: (data: GiftCardData) => void;
}

export interface GiftCardData {
  recipientEmail: string;
  recipientName: string;
  message: string;
  customAmount?: number;
}

export default function GiftCardForm({ productId, onDataChange }: GiftCardFormProps) {
  const [giftCardProductId, setGiftCardProductId] = useState<number | null>(null);
  const [formData, setFormData] = useState<GiftCardData>({
    recipientEmail: '',
    recipientName: '',
    message: '',
    customAmount: undefined
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});


  // Recupera l'ID del prodotto gift card dalle impostazioni WordPress
  useEffect(() => {
    const fetchGiftCardProductId = async () => {
      try {
        // Prova prima l'endpoint gift card personalizzato
        const response = await fetch(`${process.env.NEXT_PUBLIC_WORDPRESS_URL}wp-json/gift-card/v1/config`, {
          headers: {
            'Authorization': `Basic ${btoa(`${process.env.NEXT_PUBLIC_WC_CONSUMER_KEY}:${process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET}`)}`
          }
        });

        if (response.ok) {
          const config = await response.json();
          if (config.success && config.data.gift_card_product_id) {
            setGiftCardProductId(parseInt(config.data.gift_card_product_id));
            return;
          }
        }

        // Fallback: prova a recuperare dall'endpoint options
        const optionsResponse = await fetch(`${process.env.NEXT_PUBLIC_WORDPRESS_URL}wp-json/wp/v2/settings`);
        if (optionsResponse.ok) {
          const options = await optionsResponse.json();
          const giftCardId = options.gift_card_product_id;
          if (giftCardId) {
            setGiftCardProductId(parseInt(giftCardId));
            return;
          }
        }

        // Ultimo fallback: ID del prodotto gift card dal server
        setGiftCardProductId(176703);

      } catch {
        // Fallback silenzioso
      }
    };

    fetchGiftCardProductId();
  }, []);

  // Se questo non è il prodotto gift card, non mostrare il form
  if (!giftCardProductId || productId !== giftCardProductId) {
    return null;
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInputChange = (field: keyof GiftCardData, value: string | number | boolean) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Valida in tempo reale
    const newErrors = { ...errors };

    if (field === 'recipientEmail') {
      if (!value) {
        newErrors.recipientEmail = 'Email del destinatario è obbligatoria';
      } else if (!validateEmail(value as string)) {
        newErrors.recipientEmail = 'Inserisci un indirizzo email valido';
      } else {
        delete newErrors.recipientEmail;
      }
    }

    if (field === 'message' && (value as string).length > 500) {
      newErrors.message = 'Il messaggio non può superare i 500 caratteri';
      newFormData.message = (value as string).substring(0, 500);
    } else if (field === 'message') {
      delete newErrors.message;
    }

    if (field === 'customAmount') {
      const amount = value as number;
      if (amount && amount < 5) {
        newErrors.customAmount = 'L\'importo minimo è di €5';
      } else if (amount && amount > 500) {
        newErrors.customAmount = 'L\'importo massimo è di €500';
      } else {
        delete newErrors.customAmount;
      }
    }

    setErrors(newErrors);
    onDataChange(newFormData);
  };

  const isFormValid = () => {
    const isEmailValid = formData.recipientEmail && validateEmail(formData.recipientEmail);
    const isAmountValid = !formData.customAmount || (formData.customAmount >= 5 && formData.customAmount <= 500);
    const hasNoErrors = Object.keys(errors).length === 0;

    return isEmailValid && isAmountValid && hasNoErrors;
  };

  return (
    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 mb-8 border border-yellow-200">
      <div className="flex items-center mb-4">
        <div className="bg-yellow-500 p-2 rounded-lg mr-3">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900">Dettagli Gift Card</h3>
      </div>

      <div className="space-y-6">
        {/* Email destinatario */}
        <div>
          <label htmlFor="recipient-email" className="block text-sm font-medium text-gray-700 mb-2">
            Email destinatario <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="recipient-email"
            value={formData.recipientEmail}
            onChange={(e) => handleInputChange('recipientEmail', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-colors ${
              errors.recipientEmail ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="Inserisci l'email del destinatario"
            required
          />
          {errors.recipientEmail && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {errors.recipientEmail}
            </p>
          )}
        </div>

        {/* Nome destinatario */}
        <div>
          <label htmlFor="recipient-name" className="block text-sm font-medium text-gray-700 mb-2">
            Nome destinatario <span className="text-gray-400">(opzionale)</span>
          </label>
          <input
            type="text"
            id="recipient-name"
            value={formData.recipientName}
            onChange={(e) => handleInputChange('recipientName', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-colors"
            placeholder="Nome del destinatario"
          />
        </div>

        {/* Messaggio personalizzato */}
        <div>
          <label htmlFor="gift-message" className="block text-sm font-medium text-gray-700 mb-2">
            Messaggio personalizzato <span className="text-gray-400">(opzionale)</span>
          </label>
          <textarea
            id="gift-message"
            rows={4}
            value={formData.message}
            onChange={(e) => handleInputChange('message', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-colors resize-none ${
              errors.message ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="Scrivi un messaggio speciale per il destinatario..."
            maxLength={500}
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500">
              {formData.message.length}/500 caratteri
            </span>
            {errors.message && (
              <p className="text-sm text-red-600 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.message}
              </p>
            )}
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">Come funziona:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-600">
                <li>Il destinatario riceverà una email con il codice della gift card</li>
                <li>Potrà utilizzare il codice per i suoi acquisti sul nostro sito</li>
                <li>La gift card scade dopo 1 anno dalla data di emissione</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Indicatore validazione */}
        {!isFormValid() && formData.recipientEmail && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-amber-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm font-medium text-amber-800">
                Completa tutti i campi obbligatori per procedere
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}