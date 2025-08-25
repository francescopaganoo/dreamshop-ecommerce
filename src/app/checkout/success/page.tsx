'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getOrder } from '../../../lib/api';

// Client component that uses useSearchParams
function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  
  // Define a type for order details
  interface OrderDetails {
    id: number;
    date_created: string;
    total: string;
    payment_method_title: string;
    line_items: Array<{
      id: number;
      name: string;
      quantity: number;
      total: string;
    }>;
    billing: {
      first_name: string;
      last_name: string;
      address_1: string;
      address_2?: string;
      postcode: string;
      city: string;
      state: string;
      country: string;
      email: string;
      phone?: string;
    };
    shipping: {
      first_name: string;
      last_name: string;
      address_1: string;
      address_2?: string;
      postcode: string;
      city: string;
      state: string;
      country: string;
    };
  }
  
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchOrderDetails() {
      if (!orderId) {
        setError('ID ordine non trovato');
        setLoading(false);
        return;
      }
      
      try {
        const order = await getOrder(parseInt(orderId, 10));
        setOrderDetails(order as OrderDetails);
      } catch (err) {
        console.error('Error fetching order details:', err);
        setError('Impossibile recuperare i dettagli dell\'ordine');
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrderDetails();
  }, [orderId]);
  
  // Format price with currency symbol
  const formatPrice = (price: string) => {
    return `€${parseFloat(price).toFixed(2)}`;
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('it-IT', options);
  };
  
  return (
    <div className="min-h-screen flex flex-col">
      
      <main className="flex-grow py-8 bg-white">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-4 text-gray-600">Caricamento dettagli ordine...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-red-50 rounded-lg">
              <h2 className="text-2xl font-semibold text-red-700 mb-4">Si è verificato un errore</h2>
              <p className="text-gray-700 mb-6">{error}</p>
              <Link 
                href="/"
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Torna alla Home
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6 md:p-8 max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 text-green-600 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Ordine Confermato!</h1>
                <p className="text-gray-600">
                  Grazie per il tuo ordine. Ti abbiamo inviato una email di conferma.
                </p>
              </div>
              
              {orderDetails && (
                <div className="border-t border-gray-200 pt-6">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-2 text-gray-700">Dettagli Ordine</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Numero Ordine:</p>
                        <p className="font-medium text-gray-600">#{orderDetails.id}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Data:</p>
                        <p className="font-medium text-gray-600">{formatDate(orderDetails.date_created)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Totale:</p>
                        <p className="font-medium text-gray-600">{formatPrice(orderDetails.total)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Metodo di Pagamento:</p>
                        <p className="font-medium text-gray-600">{orderDetails.payment_method_title}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-2 text-gray-700">Prodotti Acquistati</h2>
                    <div className="space-y-3">
                      {orderDetails.line_items.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <div>
                            <span className="font-medium text-gray-600">{item.name}</span>
                            <span className="text-gray-600"> × {item.quantity}</span>
                          </div>
                          <span>{formatPrice(item.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <h2 className="text-xl font-semibold mb-2 text-gray-700">Indirizzo di Fatturazione</h2>
                      <address className="not-italic text-gray-600">
                        {orderDetails.billing.first_name} {orderDetails.billing.last_name}<br />
                        {orderDetails.billing.address_1}<br />
                        {orderDetails.billing.address_2 && <>{orderDetails.billing.address_2}<br /></>}
                        {orderDetails.billing.postcode} {orderDetails.billing.city}, {orderDetails.billing.state}<br />
                        {orderDetails.billing.country}<br />
                        {orderDetails.billing.email}<br />
                        {orderDetails.billing.phone}
                      </address>
                    </div>
                    
                    <div>
                      <h2 className="text-xl font-semibold mb-2 text-gray-700">Indirizzo di Spedizione</h2>
                      <address className="not-italic text-gray-600">
                        {orderDetails.shipping.first_name} {orderDetails.shipping.last_name}<br />
                        {orderDetails.shipping.address_1}<br />
                        {orderDetails.shipping.address_2 && <>{orderDetails.shipping.address_2}<br /></>}
                        {orderDetails.shipping.postcode} {orderDetails.shipping.city}, {orderDetails.shipping.state}<br />
                        {orderDetails.shipping.country}
                      </address>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="text-center mt-8">
                <Link 
                  href="/"
                  className="bg-bred-500 text-white px-6 py-3 rounded-md font-medium hover:bg-bred-600 transition-colors"
                >
                  Continua lo Shopping
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
      
    </div>
  );
}

// Main page component with Suspense boundary
export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col">
        <main className="flex-grow py-8 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-4 text-gray-600">Caricamento dettagli ordine...</p>
            </div>
          </div>
        </main>
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
