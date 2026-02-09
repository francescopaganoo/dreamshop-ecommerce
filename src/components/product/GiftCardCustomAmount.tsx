'use client';

import { useState, useEffect } from 'react';

interface GiftCardCustomAmountProps {
  productId: number;
  onAmountChange: (amount: number | undefined) => void;
}

export default function GiftCardCustomAmount({ productId, onAmountChange }: GiftCardCustomAmountProps) {
  const [giftCardProductId, setGiftCardProductId] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string>('');

  // Recupera l'ID del prodotto gift card dalle impostazioni WordPress
  useEffect(() => {
    const fetchGiftCardProductId = async () => {
      try {
        // Prova prima l'endpoint gift card personalizzato
        const response = await fetch('/api/gift-cards/config');

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

  // Se questo non è il prodotto gift card, non mostrare il componente
  if (!giftCardProductId || productId !== giftCardProductId) {
    return null;
  }

  const handleAmountChange = (value: string) => {
    const numValue = parseFloat(value) || undefined;
    setCustomAmount(numValue);

    // Valida l'importo
    if (numValue && numValue < 5) {
      setError('L\'importo minimo è di €5');
    } else if (numValue && numValue > 500) {
      setError('L\'importo massimo è di €500');
    } else {
      setError('');
    }

    onAmountChange(numValue);
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-70 rounded-xl p-6 mb-6 border border-gray-200">
      <div className="flex items-center mb-4">
        <div className="bg-yellow-500 p-2 rounded-lg mr-3">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900">Importo Personalizzato</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="custom-amount" className="block text-sm font-medium text-gray-700 mb-2">
            Inserisci importo personalizzato <span className="text-gray-400">(opzionale)</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">€</span>
            </div>
            <input
              type="number"
              id="custom-amount"
              min="5"
              max="500"
              step="1"
              value={customAmount || ''}
              onChange={(e) => handleAmountChange(e.target.value)}
              className={`w-full pl-7 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-colors ${
                error ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Es. 25"
            />
          </div>
          {error && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Importo minimo: €5 - Importo massimo: €500. <br />
            Lascia vuoto per utilizzare le variazioni del prodotto.
          </p>
        </div>
      </div>
    </div>
  );
}