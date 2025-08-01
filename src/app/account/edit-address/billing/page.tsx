'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { BillingAddress, saveBillingAddress, getUserAddresses } from '@/lib/api';

export default function EditBillingAddressPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  
  const [address, setAddress] = useState<BillingAddress>({
    first_name: '',
    last_name: '',
    company: '',
    address_1: '',
    address_2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'IT',
    email: '',
    phone: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(true);

  // Reindirizza l'utente se non è autenticato
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Carica l'indirizzo esistente se presente
  useEffect(() => {
    const loadAddress = async () => {
      if (!user) return;

      try {
        const token = localStorage.getItem('woocommerce_token');
        if (!token) {
          setIsLoadingAddress(false);
          return;
        }

        const addresses = await getUserAddresses(token);
        if (addresses.billing) {
          setAddress(addresses.billing);
        }
      } catch (error) {
        console.error('Errore nel caricamento dell\'indirizzo:', error);
      } finally {
        setIsLoadingAddress(false);
      }
    };

    if (user) {
      loadAddress();
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAddress(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem('woocommerce_token');
      if (!token) {
        throw new Error('Token di autenticazione non trovato');
      }

      await saveBillingAddress(address, token);
      setSuccess(true);
      
      // Reindirizza alla pagina degli indirizzi dopo 2 secondi
      setTimeout(() => {
        router.push('/account?tab=addresses');
      }, 2000);
      
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
      setError(error instanceof Error ? error.message : 'Errore nel salvataggio dell\'indirizzo');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isLoadingAddress) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-grow py-8 bg-white">
          <div className="container mx-auto px-4">
            <p className="text-center text-gray-600">Caricamento in corso...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow py-8 bg-white">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="mb-6">
            <Link href="/account?tab=addresses" className="text-bred-500 hover:text-bred-700 text-sm">
              ← Torna agli indirizzi
            </Link>
          </div>
          
          <h1 className="text-3xl font-bold mb-8 text-gray-900">Indirizzo di fatturazione</h1>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
              Indirizzo salvato con successo! Ti stiamo reindirizzando...
            </div>
          )}
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={address.first_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Cognome *
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={address.last_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                  Azienda (opzionale)
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={address.company || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                />
              </div>
              
              <div>
                <label htmlFor="address_1" className="block text-sm font-medium text-gray-700 mb-2">
                  Indirizzo *
                </label>
                <input
                  type="text"
                  id="address_1"
                  name="address_1"
                  value={address.address_1}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                />
              </div>
              
              <div>
                <label htmlFor="address_2" className="block text-sm font-medium text-gray-700 mb-2">
                  Appartamento, suite, ecc. (opzionale)
                </label>
                <input
                  type="text"
                  id="address_2"
                  name="address_2"
                  value={address.address_2 || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                    Città *
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={address.city}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                    Provincia *
                  </label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={address.state}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="postcode" className="block text-sm font-medium text-gray-700 mb-2">
                    CAP *
                  </label>
                  <input
                    type="text"
                    id="postcode"
                    name="postcode"
                    value={address.postcode}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                  Paese *
                </label>
                <select
                  id="country"
                  name="country"
                  value={address.country}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                >
                  <option value="IT">Italia</option>
                  <option value="FR">Francia</option>
                  <option value="DE">Germania</option>
                  <option value="ES">Spagna</option>
                  <option value="GB">Regno Unito</option>
                </select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={address.email || ''}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Telefono (opzionale)
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={address.phone || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-bred-500 text-white px-6 py-2 rounded-md hover:bg-bred-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Salvataggio...' : 'Salva indirizzo'}
                </button>
                
                <Link
                  href="/account?tab=addresses"
                  className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600"
                >
                  Annulla
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}