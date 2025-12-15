'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../../../context/AuthContext';


// Interfaccia per le note cliente
interface OrderNote {
  id: number;
  author: string;
  date_created: string;
  note: string;
  customer_note: boolean;
}

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
    image?: {
      id: number;
      src: string;
      alt: string;
    };
  }>;
  customer_notes?: OrderNote[];
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
                           order.status === 'partial-payment' ? 'Acconto Pagato' :
                           order.status}
                        </span>
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Metodo di pagamento</p>
                      <p className="font-medium text-gray-600">{order.payment_method_title}</p>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-4 text-gray-600">Prodotti</h3>
                  <div className="space-y-4">
                    {order.line_items.map(item => (
                      <div key={item.id} className="flex items-center p-4 bg-gray-50 rounded-lg">
                        {/* Product Image */}
                        <div className="w-16 h-16 mr-4 flex-shrink-0">
                          {item.image ? (
                            <Image
                              src={item.image.src}
                              alt={item.image.alt || item.name}
                              width={64}
                              height={64}
                              className="w-full h-full object-cover rounded-md"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 rounded-md flex items-center justify-center">
                              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        
                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{item.name}</h4>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm text-gray-600">Quantità: {item.quantity}</span>
                            <span className="font-semibold text-gray-900">{order.currency_symbol}{item.total}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Order Totals */}
                  <div className="mt-6 border-t border-gray-200 pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotale</span>
                        <span>{order.currency_symbol}{(parseFloat(order.total) - parseFloat(order.shipping_total)).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Spedizione</span>
                        <span>{order.currency_symbol}{order.shipping_total}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                        <span>Totale</span>
                        <span>{order.currency_symbol}{order.total}</span>
                      </div>
                    </div>
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

                {/* Note Cliente */}
                {order.customer_notes && order.customer_notes.length > 0 && (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-600">Note ordine</h2>
                    <div className="space-y-4">
                      {order.customer_notes.map(note => (
                        <div key={note.id} className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                          <p className="text-gray-700 whitespace-pre-wrap">{note.note}</p>
                          <p className="text-sm text-gray-500 mt-2">
                            {formatDate(note.date_created)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
