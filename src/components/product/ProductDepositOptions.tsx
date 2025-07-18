'use client';

import React, { useState, useEffect } from 'react';
import { getProductDepositOptions, ProductDepositOptions } from '@/lib/deposits';
import { Product } from '@/lib/api';

interface ProductDepositOptionsProps {
  product: Product;
  onDepositOptionChange: (enableDeposit: 'yes' | 'no') => void;
}

export default function ProductDepositOptionsComponent({ product, onDepositOptionChange }: ProductDepositOptionsProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [depositOptions, setDepositOptions] = useState<ProductDepositOptions | null>(null);
  const [selectedOption, setSelectedOption] = useState<'yes' | 'no'>('no'); // Default: pagamento completo

  useEffect(() => {
    const fetchDepositOptions = async () => {
      try {
        setLoading(true);
        const options = await getProductDepositOptions(product.id);
        setDepositOptions(options);
        
        // Se l'acconto è obbligatorio, imposta l'opzione selezionata su "yes"
        if (options.deposit_forced) {
          setSelectedOption('yes');
          onDepositOptionChange('yes');
        }
      } catch (error) {
        console.error('Errore nel recupero delle opzioni di acconto:', error);
        setError('Impossibile caricare le opzioni di acconto');
      } finally {
        setLoading(false);
      }
    };

    fetchDepositOptions();
  }, [product.id, onDepositOptionChange]);

  // Se c'è un errore o stiamo caricando, non mostrare nulla
  if (loading) {
    return (
      <div className="mb-6 animate-pulse">
        <div className="h-5 w-1/3 bg-gray-200 rounded mb-2"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // In ambiente di sviluppo, mostra informazioni di debug
  if (process.env.NODE_ENV === 'development' && (error || !depositOptions || !depositOptions.deposit_enabled)) {
    return (
      <div className="mb-6 border border-amber-300 bg-amber-50 p-4 rounded-md">
        <h3 className="text-amber-800 font-semibold mb-2">Info Sviluppo: Acconto non disponibile</h3>
        {error && <p className="text-red-600 mb-2">Errore: {error}</p>}
        {depositOptions && (
          <div>
            <p className="text-amber-700">Prodotto ID: {product.id}</p>
            <p className="text-amber-700">Acconto abilitato: {depositOptions.deposit_enabled ? 'Sì' : 'No'}</p>
            {depositOptions.message && <p className="text-amber-700">Messaggio: {depositOptions.message}</p>}
            <pre className="mt-2 text-xs bg-amber-100 p-2 rounded overflow-x-auto">
              {JSON.stringify(depositOptions, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }
  
  // Temporaneamente: Mostra sempre informazioni di debug
  if (error || !depositOptions || !depositOptions.deposit_enabled) {
    // Aggiungiamo più informazioni di debug
    console.log('ProductDepositOptions non mostrato:', { 
      error, 
      hasDepositOptions: !!depositOptions,
      depositEnabled: depositOptions?.deposit_enabled,
      productId: product.id
    });
    
    // Mostra informazioni anche in produzione per debug
    return (
      <div className="mb-6 border border-amber-300 bg-amber-50 p-4 rounded-md">
        <h3 className="text-amber-800 font-semibold mb-2">Debug: Acconto non disponibile</h3>
        {error && <p className="text-red-600 mb-2">Errore: {error}</p>}
        {depositOptions && (
          <div>
            <p className="text-amber-700">Prodotto ID: {product.id}</p>
            <p className="text-amber-700">Acconto abilitato: {depositOptions.deposit_enabled ? 'Sì' : 'No'}</p>
            {depositOptions.message && <p className="text-amber-700">Messaggio: {depositOptions.message}</p>}
            <pre className="mt-2 text-xs bg-amber-100 p-2 rounded overflow-x-auto">
              {JSON.stringify(depositOptions, null, 2)}
            </pre>
          </div>
        )}
        {!depositOptions && (
          <p className="text-amber-700">Nessuna opzione di acconto ricevuta dall&apos;API</p>
        )}
      </div>
    );
  }

  const handleOptionChange = (option: 'yes' | 'no') => {
    setSelectedOption(option);
    onDepositOptionChange(option);
  };

  return (
    <div className="mb-6 border border-gray-200 rounded-md p-4 bg-gray-50">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Opzioni di pagamento</h3>
      
      <div className="space-y-3">
        {/* Opzione di pagamento completo */}
        {!depositOptions.deposit_forced && (
          <label className="flex items-start cursor-pointer">
            <input
              type="radio"
              name="depositOption"
              value="no"
              checked={selectedOption === 'no'}
              onChange={() => handleOptionChange('no')}
              className="mr-2 mt-1"
            />
            <div>
              <span className="font-medium">Pagamento completo</span>
              <p className="text-sm text-gray-600">
                Paga l&apos;intero importo: <span dangerouslySetInnerHTML={{ __html: depositOptions.formatted_product_price }} />
              </p>
            </div>
          </label>
        )}
        
        {/* Opzione di acconto */}
        <label className="flex items-start cursor-pointer">
          <input
            type="radio"
            name="depositOption"
            value="yes"
            checked={selectedOption === 'yes'}
            onChange={() => handleOptionChange('yes')}
            className="mr-2 mt-1"
          />
          <div>
            <span className="font-medium">Paga con acconto</span>
            <p className="text-sm text-gray-600">
              Acconto iniziale: <span dangerouslySetInnerHTML={{ __html: depositOptions.formatted_deposit_value }} />
              <br />
              Saldo: <span dangerouslySetInnerHTML={{ __html: depositOptions.formatted_second_payment }} />
            </p>
            {depositOptions.payment_plan && (
              <div className="p-3 rounded-md bg-gray-50 border border-gray-100">
                <h4 className="font-semibold">{depositOptions.payment_plan.name}</h4>
                <p className="text-gray-600">{depositOptions.payment_plan.description}</p>
                {depositOptions.payment_plan.schedule && (
                  <div className="mt-2 bg-white rounded-md p-3 border border-gray-100">
                    <h5 className="font-medium text-sm mb-2 pb-1 border-b border-gray-100">Piano Rateale: Acconto {depositOptions.deposit_type === 'percent' ? `${Math.round(depositOptions.deposit_amount)}%` : ''} + {depositOptions.payment_plan.schedule?.length || 0} Rate</h5>
                    
                    {/* Acconto iniziale con stile migliorato */}
                    <div className="mb-2 p-1.5 bg-green-50 rounded-md border border-green-100">
                      <div className="text-sm font-medium text-green-800">
                        <span className="flex items-center justify-between">
                          <span>
                            <strong>Acconto iniziale {depositOptions.deposit_type === 'percent' && `(${Math.round(depositOptions.deposit_amount)}%)`}:</strong>
                          </span>
                          {depositOptions.deposit_type === 'percent' ? (
                            <span>
                              <span dangerouslySetInnerHTML={{ __html: depositOptions.formatted_deposit_value }} />
                            </span>
                          ) : (
                            <span dangerouslySetInnerHTML={{ __html: depositOptions.formatted_deposit_value }} />
                          )}
                        </span>
                        <span className="text-xs text-green-600 mt-1">
                          {depositOptions.deposit_type === 'percent' && (
                            <>
                              <strong>{Math.round(depositOptions.deposit_amount)}%</strong> del prezzo totale (<span dangerouslySetInnerHTML={{ __html: depositOptions.formatted_product_price }} />)
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    
                    {/* Elenco delle rate */}
                    {depositOptions.payment_plan.schedule.length > 0 && (
                      <div>
                        <h6 className="text-xs font-medium mb-1 text-gray-700">Rate mensili successive:</h6>
                        <ul className="list-disc pl-5 space-y-0.5">
                          {depositOptions.payment_plan.schedule.map((item, index) => {
                            // Verifica se è una percentuale usando il nuovo campo is_percent
                            const isPercentage = item.is_percent === true || 
                                               (typeof item.percentage === 'number' && item.percentage > 0) ||
                                               (typeof item.amount === 'string' && item.amount.includes('%'));
                            
                            const productPrice = typeof depositOptions.product_price === 'string' 
                              ? parseFloat(depositOptions.product_price) 
                              : Number(depositOptions.product_price);
                              
                            // Usa percentage se disponibile, altrimenti estrai il valore numerico da amount
                            const percentValue = typeof item.percentage === 'number' ? item.percentage :
                                              (typeof item.value === 'number' ? item.value : null);
                                              
                            // Calcola l'importo in euro basato sulla percentuale
                            const calculatedAmount = isPercentage && percentValue
                              ? (productPrice * percentValue / 100).toFixed(2)
                              : null;
                              
                            return (
                              <li key={index} className="text-xs flex justify-between">
                                <div>
                                  <strong className="text-gray-700">Rata {index + 1}:</strong> dopo {item.interval_amount} {item.interval_unit === 'month' ? 'mesi' : item.interval_unit}
                                </div>
                                <div>
                                  {isPercentage ? (
                                    <span className="text-gray-700 font-medium">
                                      {/* Mostra prima la percentuale, poi l'importo calcolato tra parentesi */}
                                      <span className="text-blue-700">{typeof percentValue === 'number' ? `${Math.round(percentValue)}%` : item.amount}</span>
                                      {calculatedAmount && (
                                        <span className="text-gray-500 ml-1">({calculatedAmount}€)</span>
                                      )}
                                    </span>
                                  ) : item.formatted_amount ? (
                                    <span className="text-gray-700">
                                      <span dangerouslySetInnerHTML={{ __html: item.formatted_amount }} />
                                    </span>
                                  ) : item.amount ? (
                                    <span className="text-gray-700"> {item.amount}</span>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </label>
      </div>
    </div>
  );
}
