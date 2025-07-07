'use client';

import React, { useState, useEffect } from 'react';
import { getProductDepositOptions } from '@/lib/deposits';

export default function TestDepositAPI() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [depositData, setDepositData] = useState<any>(null);
  const [productId, setProductId] = useState<string>('1');

  const testApiCall = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log(`Testando API per il prodotto ID: ${productId}`);
      const result = await getProductDepositOptions(parseInt(productId, 10));
      console.log('Risultato API:', result);
      setDepositData(result);
    } catch (error: any) {
      console.error('Errore durante il test API:', error);
      setError(error.message || 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Test API Depositi</h1>
      
      <div className="mb-4">
        <label className="block mb-2">
          ID Prodotto:
          <input 
            type="text" 
            value={productId} 
            onChange={(e) => setProductId(e.target.value)}
            className="ml-2 px-2 py-1 border border-gray-300 rounded"
          />
        </label>
        
        <button 
          onClick={testApiCall}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Testa API
        </button>
      </div>
      
      {loading && <div>Caricamento in corso...</div>}
      {error && <div className="text-red-500">Errore: {error}</div>}
      
      {depositData && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Risultato:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(depositData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
