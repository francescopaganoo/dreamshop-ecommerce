'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  getGiftCardBalance, 
  generateGiftCardCoupon,
  validateGiftCardCoupon,
  GiftCardBalance as GiftCardBalanceType 
} from '@/lib/gift-cards';

interface GiftCardCartWidgetProps {
  cartTotal: number;
  onCouponGenerated?: (couponCode: string, discount: number) => void;
  className?: string;
}

export default function GiftCardCartWidget({ 
  cartTotal, 
  onCouponGenerated,
  className = '' 
}: GiftCardCartWidgetProps) {
  const { user } = useAuth();
  const [balance, setBalance] = useState<GiftCardBalanceType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Stati per generazione coupon
  const [couponAmount, setCouponAmount] = useState<string>('');
  const [isGeneratingCoupon, setIsGeneratingCoupon] = useState(false);
  const [generatedCoupon, setGeneratedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  
  // Stati per coupon generato
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);

  // Carica saldo gift card
  const loadBalance = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('woocommerce_token');
      if (!token) {
        throw new Error('Token non trovato');
      }

      const balanceData = await getGiftCardBalance(user.id, token);
      setBalance(balanceData);
    } catch (err) {
      console.error('Errore nel caricamento del saldo gift card:', err);
      setError(err instanceof Error ? err.message : 'Errore nel caricamento del saldo');
    } finally {
      setIsLoading(false);
    }
  };

  // Genera coupon per il carrello
  const handleGenerateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !balance) return;

    const amount = parseFloat(couponAmount);
    if (isNaN(amount) || amount <= 0) {
      setCouponError('Inserisci un importo valido');
      return;
    }

    if (amount > balance.balance) {
      setCouponError('Importo superiore al saldo disponibile');
      return;
    }

    // Suggerisci l'importo massimo utilizzabile (saldo o totale carrello)
    const maxUsableAmount = Math.min(balance.balance, cartTotal);
    if (amount > maxUsableAmount) {
      setCouponError(`Importo massimo utilizzabile: €${maxUsableAmount.toFixed(2)}`);
      return;
    }

    try {
      setIsGeneratingCoupon(true);
      setCouponError(null);
      
      const token = localStorage.getItem('woocommerce_token');
      if (!token) {
        throw new Error('Token non trovato');
      }

      const result = await generateGiftCardCoupon(user.id, amount, token);
      
      // Valida il coupon appena generato
      const validation = await validateGiftCardCoupon(result.coupon_code, cartTotal);
      
      setGeneratedCoupon(result.coupon_code);
      setAppliedCouponCode(result.coupon_code);
      setAppliedDiscount(validation.discount_amount);
      setCouponAmount('');
      
      // Aggiorna il saldo
      setBalance(prev => prev ? {
        ...prev,
        balance: result.new_balance,
        formatted_balance: result.formatted_new_balance
      } : null);

      // Notifica il componente padre
      if (onCouponGenerated) {
        onCouponGenerated(result.coupon_code, validation.discount_amount);
      }
    } catch (err) {
      console.error('Errore nella generazione del coupon:', err);
      setCouponError(err instanceof Error ? err.message : 'Errore nella generazione del coupon');
    } finally {
      setIsGeneratingCoupon(false);
    }
  };

  // Copia coupon negli appunti
  const copyCouponToClipboard = async (couponCode: string) => {
    try {
      await navigator.clipboard.writeText(couponCode);
      // Potresti aggiungere un toast notification qui
    } catch (err) {
      console.error('Errore nella copia:', err);
    }
  };

  // Applica automaticamente il coupon migliore
  const applyOptimalCoupon = async () => {
    if (!user || !balance || balance.balance <= 0) return;

    const optimalAmount = Math.min(balance.balance, cartTotal);
    if (optimalAmount <= 0) return;

    try {
      setIsGeneratingCoupon(true);
      setCouponError(null);
      
      const token = localStorage.getItem('woocommerce_token');
      if (!token) {
        throw new Error('Token non trovato');
      }

      const result = await generateGiftCardCoupon(user.id, optimalAmount, token);
      const validation = await validateGiftCardCoupon(result.coupon_code, cartTotal);
      
      setGeneratedCoupon(result.coupon_code);
      setAppliedCouponCode(result.coupon_code);
      setAppliedDiscount(validation.discount_amount);
      
      // Aggiorna il saldo
      setBalance(prev => prev ? {
        ...prev,
        balance: result.new_balance,
        formatted_balance: result.formatted_new_balance
      } : null);

      if (onCouponGenerated) {
        onCouponGenerated(result.coupon_code, validation.discount_amount);
      }
    } catch (err) {
      console.error('Errore nella generazione del coupon ottimale:', err);
      setCouponError(err instanceof Error ? err.message : 'Errore nella generazione del coupon');
    } finally {
      setIsGeneratingCoupon(false);
    }
  };

  // Rimuovi coupon applicato
  const removeCoupon = () => {
    setGeneratedCoupon(null);
    setAppliedCouponCode(null);
    setAppliedDiscount(0);
    
    // Ricarica il saldo (potrebbe essere cambiato)
    loadBalance();
    
    if (onCouponGenerated) {
      onCouponGenerated('', 0);
    }
  };

  // Carica dati iniziali
  useEffect(() => {
    if (user) {
      loadBalance();
    }
  }, [user]);

  // Non mostrare se utente non autenticato
  if (!user) {
    return null;
  }

  // Non mostrare se nessun saldo
  if (balance && balance.balance <= 0) {
    return null;
  }

  return (
    <div className={`gift-card-cart-widget ${className}`}>
      <div className="border-t pt-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"></path>
            </svg>
            Gift Card
          </h3>
          <button
            onClick={loadBalance}
            disabled={isLoading}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
          >
            {isLoading ? 'Aggiornamento...' : 'Aggiorna'}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-red-600 text-center py-2 text-sm">
            <p>{error}</p>
            <button
              onClick={loadBalance}
              className="mt-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Riprova
            </button>
          </div>
        ) : balance && balance.balance > 0 ? (
          <>
            {/* Saldo disponibile */}
            <div className="bg-blue-50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 font-medium">Saldo disponibile</p>
                  <p className="text-lg font-bold text-blue-800">{balance.formatted_balance}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-600">Massimo utilizzabile</p>
                  <p className="text-sm font-semibold text-blue-700">
                    €{Math.min(balance.balance, cartTotal).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Coupon applicato */}
            {appliedCouponCode && appliedDiscount > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-800 font-medium text-sm">Coupon applicato</p>
                    <code className="bg-white px-2 py-1 rounded border text-green-700 font-mono text-sm">
                      {appliedCouponCode}
                    </code>
                    <p className="text-green-600 text-sm mt-1">
                      Sconto: €{appliedDiscount.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyCouponToClipboard(appliedCouponCode)}
                      className="text-green-600 hover:text-green-800 text-xs font-medium"
                    >
                      Copia
                    </button>
                    <button
                      onClick={removeCoupon}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      Rimuovi
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Genera coupon se non ne hai già uno applicato */}
            {!appliedCouponCode && (
              <>
                {/* Pulsante veloce per coupon ottimale */}
                <div className="mb-3">
                  <button
                    onClick={applyOptimalCoupon}
                    disabled={isGeneratingCoupon}
                    className="w-full bg-blue-600 text-white py-2 px-3 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isGeneratingCoupon ? (
                      <span className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Generazione...
                      </span>
                    ) : (
                      `Usa €${Math.min(balance.balance, cartTotal).toFixed(2)} del saldo`
                    )}
                  </button>
                </div>

                {/* Divisore */}
                <div className="flex items-center my-3">
                  <div className="flex-grow border-t border-gray-300"></div>
                  <span className="flex-shrink mx-4 text-gray-400 text-xs">oppure</span>
                  <div className="flex-grow border-t border-gray-300"></div>
                </div>

                {/* Form importo personalizzato */}
                <form onSubmit={handleGenerateCoupon} className="space-y-3">
                  <div>
                    <input
                      type="number"
                      min="0.01"
                      max={Math.min(balance.balance, cartTotal)}
                      step="0.01"
                      placeholder={`Importo personalizzato (max €${Math.min(balance.balance, cartTotal).toFixed(2)})`}
                      value={couponAmount}
                      onChange={(e) => {
                        setCouponAmount(e.target.value);
                        setCouponError(null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isGeneratingCoupon}
                    />
                  </div>
                  
                  {couponError && (
                    <p className="text-red-600 text-sm">{couponError}</p>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isGeneratingCoupon || !couponAmount}
                    className="w-full bg-gray-600 text-white py-2 px-3 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isGeneratingCoupon ? 'Generazione...' : 'Genera Coupon'}
                  </button>
                </form>
              </>
            )}

            {/* Coupon appena generato (se non applicato) */}
            {generatedCoupon && !appliedCouponCode && (
              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-800 font-medium text-sm">Nuovo coupon generato</p>
                    <code className="bg-white px-2 py-1 rounded border text-yellow-700 font-mono text-sm">
                      {generatedCoupon}
                    </code>
                    <p className="text-yellow-600 text-xs mt-1">
                      Applica questo codice nel campo coupon sopra
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyCouponToClipboard(generatedCoupon)}
                      className="text-yellow-600 hover:text-yellow-800 text-xs font-medium"
                    >
                      Copia
                    </button>
                    <button
                      onClick={() => setGeneratedCoupon(null)}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}