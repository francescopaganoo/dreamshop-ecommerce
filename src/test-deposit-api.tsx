'use client';

import React, { useState } from 'react';
import { getProductDepositOptions, ProductDepositOptions } from '@/lib/deposits';
import { testPluginDebugEndpoint, testPluginFilterEndpoint } from '@/lib/api';

export default function TestDepositAPI() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [depositData, setDepositData] = useState<ProductDepositOptions | null>(null);
  const [productId, setProductId] = useState<string>('175890');

  // Plugin test state
  const [pluginLoading, setPluginLoading] = useState<boolean>(false);
  const [pluginError, setPluginError] = useState<string | null>(null);
  const [pluginDebugData, setPluginDebugData] = useState<unknown>(null);
  const [pluginFilterData, setPluginFilterData] = useState<unknown>(null);

  const testApiCall = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log(`Testando API per il prodotto ID: ${productId}`);
      const result = await getProductDepositOptions(parseInt(productId, 10));
      console.log('Risultato API:', result);
      setDepositData(result);
    } catch (error: unknown) {
      console.error('Errore durante il test API:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Errore sconosciuto');
      }
    } finally {
      setLoading(false);
    }
  };

  const testPluginDebug = async () => {
    try {
      setPluginLoading(true);
      setPluginError(null);
      console.log(`🔍 Testando Plugin Debug per prodotto ID: ${productId}`);
      const result = await testPluginDebugEndpoint(parseInt(productId, 10));
      console.log('🎉 Risultato Plugin Debug:', result);
      setPluginDebugData(result);
    } catch (error: unknown) {
      console.error('❌ Errore durante il test Plugin Debug:', error);
      if (error instanceof Error) {
        setPluginError(error.message);
      } else {
        setPluginError('Errore sconosciuto');
      }
    } finally {
      setPluginLoading(false);
    }
  };

  const testPluginFilter = async () => {
    try {
      setPluginLoading(true);
      setPluginError(null);
      console.log('🔍 Testando Plugin Filter...');
      const result = await testPluginFilterEndpoint({
        page: 1,
        per_page: 5
      });
      console.log('🎉 Risultato Plugin Filter:', result);
      setPluginFilterData(result);
    } catch (error: unknown) {
      console.error('❌ Errore durante il test Plugin Filter:', error);
      if (error instanceof Error) {
        setPluginError(error.message);
      } else {
        setPluginError('Errore sconosciuto');
      }
    } finally {
      setPluginLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Test API & Plugin DreamShop</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Test API Depositi */}
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">Test API Depositi</h2>

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
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Caricamento...' : 'Testa API Depositi'}
            </button>
          </div>

          {error && <div className="text-red-500 mb-2">Errore: {error}</div>}

          {depositData && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Risultato API Depositi:</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-64 text-xs">
                {JSON.stringify(depositData, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Test Plugin */}
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">🔌 Test Plugin Advanced Filters</h2>

          <div className="mb-4 space-y-2">
            <button
              onClick={testPluginDebug}
              disabled={pluginLoading}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {pluginLoading ? 'Caricamento...' : `🔍 Debug Prodotto ${productId}`}
            </button>

            <button
              onClick={testPluginFilter}
              disabled={pluginLoading}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
            >
              {pluginLoading ? 'Caricamento...' : '📊 Test Filter Endpoint'}
            </button>
          </div>

          {pluginError && <div className="text-red-500 mb-2">❌ Errore Plugin: {pluginError}</div>}
        </div>
      </div>

      {/* Plugin Results */}
      {pluginDebugData != null && (
        <div className="mt-6 border rounded-lg p-4">
          <h3 className="text-xl font-semibold mb-3">🔍 Debug Prodotto {productId} - Struttura Completa:</h3>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96 text-xs">
            {JSON.stringify(pluginDebugData, null, 2)}
          </pre>
        </div>
      )}

      {pluginFilterData != null && (
        <div className="mt-6 border rounded-lg p-4">
          <h3 className="text-xl font-semibold mb-3">📊 Test Filter Endpoint:</h3>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96 text-xs">
            {JSON.stringify(pluginFilterData, null, 2)}
          </pre>
        </div>
      )}

      {/* Istruzioni */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2 text-blue-800">📋 Istruzioni:</h3>
        <div className="text-blue-700 space-y-2">
          <p><strong>1. Debug Prodotto:</strong> Analizza la struttura completa del prodotto {productId} per capire come sono organizzati gli attributi.</p>
          <p><strong>2. Test Filter:</strong> Testa il nuovo endpoint di filtering del plugin.</p>
          <p><strong>3. Console:</strong> Apri gli strumenti per sviluppatori (F12) per vedere i log dettagliati delle chiamate API.</p>
        </div>
      </div>
    </div>
  );
}
