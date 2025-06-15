'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../context/AuthContext';
import Header from '../../../../components/Header';
import Footer from '../../../../components/Footer';

// Interfaccia per l'ordine
interface Order {
  id: number;
  number: string;
  status: string;
  date_created: string;
  total: string;
  currency_symbol: string;
  shipping_total: string;
  payment_method_title: string;
  billing: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items: Array<{
    id: number;
    name: string;
    quantity: number;
    price: number;
    total: string;
    product_id: number;
  }>;
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  
  const { isAuthenticated, isLoading } = useAuth();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Reindirizza l'utente se non è autenticato
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);
  
  // Carica i dettagli dell'ordine
  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;
      
      setIsLoadingOrder(true);
      setError(null);
      
      try {
        const token = localStorage.getItem('woocommerce_token');
        
        if (!token) {
          throw new Error('Token non trovato');
        }
        
        const response = await fetch(`/api/orders/${orderId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Ordine non trovato');
          } else {
            throw new Error('Errore nel caricamento dell\'ordine');
          }
        }
        
        const data = await response.json();
        setOrder(data);
      } catch (error: unknown) {
        console.error('Errore durante il caricamento dell\'ordine:', error);
        // Handle the error with proper type checking
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError('Si è verificato un errore durante il caricamento dell\'ordine');
        }
      } finally {
        setIsLoadingOrder(false);
      }
    };
    
    fetchOrder();
  }, [orderId]);
  
  // Formatta la data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Mostra un messaggio di caricamento se l'autenticazione è in corso
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        
        <main className="flex-grow py-8">
          <div className="container mx-auto px-4">
            <p className="text-center text-gray-600">Caricamento in corso...</p>
          </div>
        </main>
        
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-white">
      
      <main className="flex-grow py-8">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <Link href="/account" className="text-bred-500 hover:text-bred-700">
              ← Torna al tuo account
            </Link>
          </div>
          
          <h1 className="text-3xl font-bold mb-8 text-gray-600">
            Ordine #{order?.number}
          </h1>
          
          {error && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}
          
          {isLoadingOrder ? (
            <p className="text-center text-gray-600">Caricamento dettagli ordine...</p>
          ) : order ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Dettagli ordine */}
              <div className="md:col-span-2">
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4 text-gray-600">Dettagli ordine</h2>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-gray-600">Numero ordine</p>
                      <p className="font-medium text-gray-600">#{order.number}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Data</p>
                      <p className="font-medium text-gray-600">{formatDate(order.date_created)}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Stato</p>
                      <p className="font-medium">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'on-hold' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status === 'completed' ? 'Completato' :
                           order.status === 'processing' ? 'In elaborazione' :
                           order.status === 'on-hold' ? 'In attesa' :
                           order.status}
                        </span>
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Metodo di pagamento</p>
                      <p className="font-medium text-gray-600">{order.payment_method_title}</p>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-2 text-gray-600">Prodotti</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="py-2 px-4 text-left text-gray-600">Prodotto</th>
                          <th className="py-2 px-4 text-left text-gray-600">Quantità</th>
                          <th className="py-2 px-4 text-right text-gray-600">Prezzo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.line_items.map(item => (
                          <tr key={item.id} className="border-t">
                            <td className="py-2 px-4 text-gray-600">{item.name}</td>
                            <td className="py-2 px-4 text-gray-600">{item.quantity}</td>
                            <td className="py-2 px-4 text-right text-gray-600">{order.currency_symbol}{item.total}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t">
                        <tr>
                          <td colSpan={2} className="py-2 px-4 text-right font-medium text-gray-600">Subtotale</td>
                          <td className="py-2 px-4 text-right text-gray-600">{order.currency_symbol}{(parseFloat(order.total) - parseFloat(order.shipping_total)).toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td colSpan={2} className="py-2 px-4 text-right font-medium text-gray-600">Spedizione</td>
                          <td className="py-2 px-4 text-right text-gray-600">{order.currency_symbol}{order.shipping_total}</td>
                        </tr>
                        <tr className="border-t">
                          <td colSpan={2} className="py-2 px-4 text-right font-bold text-gray-600">Totale</td>
                          <td className="py-2 px-4 text-right font-bold text-gray-600">{order.currency_symbol}{order.total}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
              
              {/* Indirizzi */}
              <div className="md:col-span-1">
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4 text-gray-600">Indirizzi</h2>
                  
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2 text-gray-600">Indirizzo di fatturazione</h3>
                    <address className="not-italic text-gray-600">
                      {order.billing.first_name} {order.billing.last_name}<br />
                      {order.billing.address_1}<br />
                      {order.billing.address_2 && <>{order.billing.address_2}<br /></>}
                      {order.billing.postcode} {order.billing.city}<br />
                      {order.billing.state}, {order.billing.country}<br />
                      {order.billing.email && <>{order.billing.email}<br /></>}
                      {order.billing.phone && <>{order.billing.phone}<br /></>}
                    </address>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-gray-600">Indirizzo di spedizione</h3>
                    <address className="not-italic text-gray-600">
                      {order.shipping.first_name} {order.shipping.last_name}<br />
                      {order.shipping.address_1}<br />
                      {order.shipping.address_2 && <>{order.shipping.address_2}<br /></>}
                      {order.shipping.postcode} {order.shipping.city}<br />
                      {order.shipping.state}, {order.shipping.country}
                    </address>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center">Nessun dettaglio disponibile per questo ordine.</p>
          )}
        </div>
      </main>
      
    </div>
  );
}
