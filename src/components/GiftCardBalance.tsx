'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  getGiftCardBalance, 
  getGiftCardTransactions, 
  generateGiftCardCoupon,
  GiftCardBalance as GiftCardBalanceType,
  GiftCardTransaction 
} from '@/lib/gift-cards';

interface GiftCardBalanceProps {
  className?: string;
}

export default function GiftCardBalance({ className = '' }: GiftCardBalanceProps) {
  const { user } = useAuth();
  const [balance, setBalance] = useState<GiftCardBalanceType | null>(null);
  const [transactions, setTransactions] = useState<GiftCardTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransactions, setShowTransactions] = useState(false);
  
  // Generazione coupon
  const [couponAmount, setCouponAmount] = useState<string>('');
  const [isGeneratingCoupon, setIsGeneratingCoupon] = useState(false);
  const [generatedCoupon, setGeneratedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Carica saldo gift card
  const loadBalance = useCallback(async () => {
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
  }, [user]);

  // Carica transazioni
  const loadTransactions = useCallback(async () => {
    if (!user || !showTransactions) return;

    try {
      setIsLoadingTransactions(true);

      const token = localStorage.getItem('woocommerce_token');
      if (!token) {
        throw new Error('Token non trovato');
      }

      const { transactions: transactionsData } = await getGiftCardTransactions(user.id, token, 20);
      setTransactions(transactionsData);
    } catch (err) {
      console.error('Errore nel caricamento delle transazioni:', err);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [user, showTransactions]);

  // Genera coupon
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

    try {
      setIsGeneratingCoupon(true);
      setCouponError(null);
      
      const token = localStorage.getItem('woocommerce_token');
      if (!token) {
        throw new Error('Token non trovato');
      }

      const result = await generateGiftCardCoupon(user.id, amount, token);
      
      setGeneratedCoupon(result.coupon_code);
      setCouponAmount('');
      
      // Aggiorna il saldo
      setBalance(prev => prev ? {
        ...prev,
        balance: result.new_balance,
        formatted_balance: result.formatted_new_balance
      } : null);

      // Ricarica le transazioni se visibili
      if (showTransactions) {
        loadTransactions();
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

  // Carica dati iniziali
  useEffect(() => {
    if (user) {
      loadBalance();
    }
  }, [user, loadBalance]);

  // Carica transazioni quando richieste
  useEffect(() => {
    if (showTransactions) {
      loadTransactions();
    }
  }, [showTransactions, loadTransactions]);

  if (!user) {
    return null;
  }

  return (
    <div className={`gift-card-balance ${className}`}>
      <h2 className="text-xl font-semibold mb-4 text-gray-600">Le tue Gift Card</h2>
      
      {/* Saldo */}
      <div className="bg-bred-50 rounded-lg p-6 mb-6 border border-bred-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-700">Saldo disponibile</h3>
          <button
            onClick={loadBalance}
            disabled={isLoading}
            className="text-bred-500 hover:text-bred-700 text-sm font-medium disabled:opacity-50"
          >
            {isLoading ? 'Aggiornamento...' : 'Aggiorna'}
          </button>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bred-500"></div>
          </div>
        ) : error ? (
          <div className="text-red-600 text-center py-4">
            <p>{error}</p>
            <button
              onClick={loadBalance}
              className="mt-2 text-bred-500 hover:text-bred-700 text-sm font-medium"
            >
              Riprova
            </button>
          </div>
        ) : balance ? (
          <>
            <div className="text-center">
              <div className="text-4xl font-bold text-bred-500 mb-2">
                {balance.formatted_balance}
              </div>
              <p className="text-gray-600 text-sm">
                Disponibile per la generazione di coupon
              </p>
            </div>
            
            {/* Generazione coupon */}
            {balance.balance > 0 && (
              <div className="mt-6 pt-6 border-t border-bred-100">
                <h4 className="text-md font-medium text-gray-700 mb-3">Genera Coupon</h4>
                <form onSubmit={handleGenerateCoupon} className="space-y-3">
                  <div>
                    <input
                      type="number"
                      min="0.01"
                      max={balance.balance}
                      step="0.01"
                      placeholder={`Importo (max €${balance.balance.toFixed(2)})`}
                      value={couponAmount}
                      onChange={(e) => {
                        setCouponAmount(e.target.value);
                        setCouponError(null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                      disabled={isGeneratingCoupon}
                    />
                  </div>
                  
                  {couponError && (
                    <p className="text-red-600 text-sm">{couponError}</p>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isGeneratingCoupon || !couponAmount}
                    className="w-full bg-bred-500 text-white py-2 px-4 rounded-md font-medium hover:bg-bred-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isGeneratingCoupon ? (
                      <span className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Generazione...
                      </span>
                    ) : (
                      'Genera Coupon'
                    )}
                  </button>
                </form>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Nessun saldo gift card disponibile</p>
          </div>
        )}
      </div>

      {/* Coupon generato */}
      {generatedCoupon && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-green-800 font-medium">Coupon generato con successo!</h4>
              <div className="mt-2 flex items-center">
                <code className="bg-white px-3 py-2 rounded border text-lg font-mono text-green-700 mr-3">
                  {generatedCoupon}
                </code>
                <button
                  onClick={() => copyCouponToClipboard(generatedCoupon)}
                  className="text-green-600 hover:text-green-800 text-sm font-medium"
                >
                  Copia
                </button>
              </div>
              <p className="text-green-600 text-sm mt-1">
                Usa questo codice durante il checkout per applicare lo sconto
              </p>
            </div>
            <button
              onClick={() => setGeneratedCoupon(null)}
              className="text-green-600 hover:text-green-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Storico transazioni */}
      <div className="bg-white rounded-lg border">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => setShowTransactions(!showTransactions)}
        >
          <h3 className="text-lg font-medium text-gray-700">Storico Transazioni</h3>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${showTransactions ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>
        
        {showTransactions && (
          <div className="border-t">
            {isLoadingTransactions ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-bred-500"></div>
              </div>
            ) : transactions.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-3 ${
                          transaction.type === 'credit' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {transaction.type_label}
                        </span>
                        <span className="text-sm text-gray-600">{transaction.formatted_date}</span>
                      </div>
                      <p className="text-gray-700 mt-1">{transaction.description}</p>
                      {transaction.coupon_code && (
                        <code className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                          {transaction.coupon_code}
                        </code>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <span className={`font-medium ${
                        transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'credit' ? '+' : '-'}{transaction.formatted_amount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                <p>Nessuna transazione trovata</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}