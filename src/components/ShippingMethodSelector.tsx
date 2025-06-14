import React, { useState, useEffect } from 'react';
import { getShippingMethods, ShippingMethod, ShippingAddress } from '../lib/api';

interface ShippingMethodSelectorProps {
  shippingAddress: ShippingAddress;
  cartTotal: number;
  onMethodSelect: (method: ShippingMethod) => void;
}

export default function ShippingMethodSelector({ 
  shippingAddress, 
  cartTotal, 
  onMethodSelect 
}: ShippingMethodSelectorProps) {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<ShippingMethod | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShippingMethods = async () => {
      // Verifica che l'indirizzo sia completo
      if (!shippingAddress || !shippingAddress.country) {
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        const availableMethods = await getShippingMethods(shippingAddress, cartTotal);
        
        setMethods(availableMethods);
        
        // Seleziona automaticamente il primo metodo disponibile
        if (availableMethods.length > 0) {
          setSelectedMethod(availableMethods[0]);
          onMethodSelect(availableMethods[0]);
        }
      } catch (err) {
        console.error('Errore nel recupero dei metodi di spedizione:', err);
        setError('Impossibile recuperare i metodi di spedizione. Riprova più tardi.');
        
        // Fallback: metodo di spedizione standard
        const defaultMethod = {
          id: 'flat_rate',
          title: 'Spedizione standard',
          description: 'Consegna in 3-5 giorni lavorativi',
          cost: 7.00
        };
        
        setMethods([defaultMethod]);
        setSelectedMethod(defaultMethod);
        onMethodSelect(defaultMethod);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShippingMethods();
  }, [shippingAddress, cartTotal, onMethodSelect]);

  const handleMethodChange = (method: ShippingMethod) => {
    setSelectedMethod(method);
    onMethodSelect(method);
  };

  if (isLoading) {
    return (
      <div className="my-4 p-4 bg-gray-50 rounded-md">
        <p className="text-gray-500 text-center">Caricamento metodi di spedizione...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-4 p-4 bg-red-50 rounded-md">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <div className="my-4 p-4 bg-yellow-50 rounded-md">
        <p className="text-yellow-700">
          Nessun metodo di spedizione disponibile per questo indirizzo.
          Verifica di aver inserito correttamente tutti i dati.
        </p>
      </div>
    );
  }

  return (
    <div className="my-4">
      <h3 className="text-lg font-semibold mb-3 text-gray-700">Metodo di Spedizione</h3>
      <div className="space-y-3">
        {methods.map((method) => (
          <div key={method.id} className="flex items-start p-3 border rounded-md hover:bg-gray-50">
            <input
              type="radio"
              id={`shipping-${method.id}`}
              name="shipping-method"
              className="mt-1 mr-3"
              checked={selectedMethod?.id === method.id}
              onChange={() => handleMethodChange(method)}
            />
            <label htmlFor={`shipping-${method.id}`} className="flex-grow cursor-pointer">
              <div className="flex justify-between">
                <span className="font-medium">{method.title}</span>
                <span className="font-medium">
                  {method.free_shipping ? 'Gratuita' : `€${method.cost.toFixed(2)}`}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{method.description}</p>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
