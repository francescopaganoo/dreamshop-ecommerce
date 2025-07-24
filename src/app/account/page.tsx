'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getScheduledOrders, ScheduledOrder } from '@/lib/deposits';
import { useAuth } from '@/context/AuthContext';
import ScheduledPaymentModal from '@/components/ScheduledPaymentModal';
import { PointsResponse, PointsHistoryItem, getUserPoints } from '@/lib/points';

// Interfaccia per gli ordini
interface Order {
  id: number;
  number: string;
  status: string;
  date_created: string;
  total: string;
  currency_symbol: string;
}

// Nota: L'interfaccia ScheduledOrder è importata da @/lib/deposits

// Client component that uses useSearchParams
function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  
  // Ottieni la tab attiva dai parametri dell'URL o usa 'dashboard' come default
  const defaultTab = searchParams.get('tab') || 'dashboard';
  
  // Stato per la tab attiva
  const [activeTab, setTab] = useState(defaultTab);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  
  // Stati per la paginazione degli ordini
  const [ordersCurrentPage, setOrdersCurrentPage] = useState(1);
  const ordersPerPage = 10; // Numero di ordini per pagina
  
  // Stati per la paginazione delle rate da pagare
  const [scheduledOrdersCurrentPage, setScheduledOrdersCurrentPage] = useState(1);
  const scheduledOrdersPerPage = 10; // Numero di rate per pagina
  
  // Stati per i punti
  const [isLoadingPoints, setIsLoadingPoints] = useState(true);
  const [pointsData, setPointsData] = useState<PointsResponse | null>(null);
  const [pointsError, setPointsError] = useState<string | null>(null);
  
  // Stati per la paginazione della cronologia punti
  const [pointsCurrentPage, setPointsCurrentPage] = useState(1);
  const pointsPerPage = 10; // Numero di voci per pagina nella cronologia punti
  
  // Stati per il modale di pagamento
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentOrderId, setPaymentOrderId] = useState<number | null>(null);
  const [paymentOrderTotal, setPaymentOrderTotal] = useState('');
  
  // Stato per gli ordini pianificati
  const [scheduledOrders, setScheduledOrders] = useState<ScheduledOrder[]>([]);
  const [isLoadingScheduledOrders, setIsLoadingScheduledOrders] = useState(false);
  const [scheduledOrdersError, setScheduledOrdersError] = useState<string | null>(null);
  
  // Reindirizza l'utente se non è autenticato
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);
  
  // Aggiorna la tab attiva quando cambia il parametro nell'URL
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab && ['dashboard', 'orders', 'scheduled-orders', 'addresses', 'account-details', 'points'].includes(currentTab)) {
      setTab(currentTab);
    }
  }, [searchParams, setTab]);
  
  // Carica gli ordini dell'utente
  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) {
        console.log('Utente non disponibile, impossibile caricare gli ordini');
        return;
      }
      
      setIsLoadingOrders(true);
      
      try {
        // Recupera il token dal localStorage
        const token = localStorage.getItem('woocommerce_token');
        
        if (!token) {
          console.error('Token non trovato nel localStorage');
          throw new Error('Token non trovato');
        }
        
        console.log('Recupero ordini per utente:', user.id);
        
        // Aggiungiamo un timestamp per evitare problemi di cache
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/orders/user?_=${timestamp}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Risposta API non valida:', response.status, errorText);
          throw new Error(`Errore nel caricamento degli ordini: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Filtriamo gli ordini per rimuovere quelli con stato "scheduled-payment"
        // in quanto questi sono già visibili nella sezione rate
        // Gli ordini con stato partial-payment vengono mantenuti nella lista principale
        const filteredOrders = data.filter((order: Order) => 
          order.status !== 'scheduled-payment' && 
          order.status !== 'wc-scheduled-payment'
        );
        
        // Se abbiamo ordini dopo il filtro, mostriamo quelli
        // altrimenti mostreremo tutti gli ordini per evitare una pagina vuota
        if (filteredOrders.length > 0) {
          setOrders(filteredOrders);
        } else {
          // Se tutti gli ordini sono scheduled-payment, mostriamo comunque tutti
          // per evitare che la pagina ordini sia vuota
          setOrders(data);
        }
      } catch (error) {
        console.error('Errore durante il caricamento degli ordini:', error);
      } finally {
        setIsLoadingOrders(false);
      }
    };
    
    if (activeTab === 'orders' && user) {
      fetchOrders();
    }
    
    if (activeTab === 'scheduled-orders' && user) {
      const fetchScheduledOrders = async () => {
        if (!user) {
          console.log('Utente non disponibile, impossibile caricare gli ordini pianificati');
          return;
        }
        
        setIsLoadingScheduledOrders(true);
        setScheduledOrdersError(null);
        
        try {
          console.log('Recupero ordini pianificati per utente:', user.id);
          const data = await getScheduledOrders();
          console.log(`Ordini pianificati caricati: ${data.length}`);
          setScheduledOrders(data);
        } catch (error) {
          console.error('Errore durante il caricamento degli ordini pianificati:', error);
          setScheduledOrdersError('Impossibile caricare gli ordini pianificati. Riprova più tardi.');
        } finally {
          setIsLoadingScheduledOrders(false);
        }
      };
      
      fetchScheduledOrders();
    }
    
    if (activeTab === 'points' && user) {
      const fetchPoints = async () => {
        if (!user) {
          console.log('Utente non disponibile, impossibile caricare i punti');
          return;
        }
        
        setIsLoadingPoints(true);
        setPointsError(null);
        
        try {
          // Recupera il token dal localStorage
          const token = localStorage.getItem('woocommerce_token');
          
          if (!token) {
            console.error('Token non trovato nel localStorage');
            throw new Error('Token non trovato');
          }
          
          console.log('Recupero punti per utente:', user.id);
          
          // Chiamata alla funzione per recuperare i punti
          const data = await getUserPoints(user.id, token);
          setPointsData(data);
        } catch (error) {
          console.error('Errore durante il caricamento dei punti:', error);
          setPointsError('Impossibile caricare i punti. Riprova più tardi.');
        } finally {
          setIsLoadingPoints(false);
        }
      };
      fetchPoints();
    }
  }, [activeTab, user]);
  
  // Gestisce il logout
  const handleLogout = () => {
    logout();
    router.push('/');
  };
  
  // Formatta la data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  
  // Gestisce il processo di pagamento
  const handlePayment = (orderId: number) => {
    // Trova l'ordine selezionato per ottenere il totale
    const selectedOrder = scheduledOrders.find(order => order.id === orderId);
    if (selectedOrder) {
      setPaymentOrderId(orderId);
      setPaymentOrderTotal(selectedOrder.formatted_total || selectedOrder.total);
      setIsPaymentModalOpen(true);
    } else {
      console.error('Ordine non trovato:', orderId);
      alert('Impossibile trovare i dettagli dell\'ordine. Riprova più tardi.');
    }
  };

  // Gestisce la chiusura del modale di pagamento
  const handleClosePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setPaymentOrderId(null);
  };

  // Gestisce il completamento del pagamento con successo
  const handlePaymentSuccess = () => {
    setIsPaymentModalOpen(false);
    alert('Pagamento completato con successo!');
    // Ricarica la lista delle rate per aggiornare lo stato
    if (user) {
      const fetchScheduledOrders = async () => {
        setIsLoadingScheduledOrders(true);
        setScheduledOrdersError(null);
        
        try {
          console.log('Ricarico ordini pianificati dopo il pagamento');
          const data = await getScheduledOrders();
          console.log(`Ordini pianificati ricaricati: ${data.length}`);
          setScheduledOrders(data);
        } catch (error) {
          console.error('Errore durante il ricaricamento degli ordini pianificati:', error);
          setScheduledOrdersError('Errore durante il caricamento degli ordini pianificati');
        } finally {
          setIsLoadingScheduledOrders(false);
        }
      };
      
      fetchScheduledOrders();
    }
  };

  // Gestisce l'errore nel pagamento
  const handlePaymentError = (errorMessage: string) => {
    console.error('Errore nel pagamento:', errorMessage);
    alert(`Errore durante il pagamento: ${errorMessage}`);
  };
  
  // Mostra il contenuto in base alla tab attiva
  const setActiveTab = (tab: string) => {
    if (tab !== activeTab) {
      // Reset delle pagine correnti quando si cambia tab
      setOrdersCurrentPage(1);
      setPointsCurrentPage(1);
      setScheduledOrdersCurrentPage(1);
      setTab(tab);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div>
            <h2 className="text-xl text-gray-600 font-semibold mb-4">Dashboard</h2>
            <p className="mb-4 text-gray-600">
              Ciao <span className="font-semibold text-gray-600">{user?.displayName || user?.username}</span>, benvenuto nel tuo account.
            </p>
            <p className="mb-4 text-gray-600">
              Da qui puoi visualizzare i tuoi <Link href="#" onClick={() => setActiveTab('orders')} className="text-bred-500 hover:text-bred-700">ordini recenti</Link>, gestire le tue <Link href="#" onClick={() => setActiveTab('scheduled-orders')} className="text-bred-500 hover:text-bred-700">rate da pagare</Link>, controllare i tuoi <Link href="#" onClick={() => setActiveTab('points')} className="text-bred-500 hover:text-bred-700">punti fedeltà</Link>, gestire i tuoi <Link href="#" onClick={() => setActiveTab('addresses')} className="text-bred-500 hover:text-bred-700">indirizzi di spedizione</Link> e <Link href="#" onClick={() => setActiveTab('account-details')} className="text-bred-500 hover:text-bred-700">modificare i dettagli del tuo account</Link>.
            </p>
          </div>
        );
        
      case 'orders':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-600">I tuoi ordini</h2>
            
            {isLoadingOrders ? (
              <p className="text-gray-600">Caricamento ordini in corso...</p>
            ) : orders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 text-left text-gray-600">Ordine</th>
                      <th className="py-2 px-4 text-left text-gray-600">Data</th>
                      <th className="py-2 px-4 text-left text-gray-600">Stato</th>
                      <th className="py-2 px-4 text-left text-gray-600">Totale</th>
                      <th className="py-2 px-4 text-left text-gray-600">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders
                      .slice(
                        (ordersCurrentPage - 1) * ordersPerPage,
                        ordersCurrentPage * ordersPerPage
                      )
                      .map(order => (
                        <tr key={order.id} className="border-t">
                          <td className="py-2 px-4 text-gray-600">#{order.number}</td>
                          <td className="py-2 px-4 text-gray-600">{formatDate(order.date_created)}</td>
                          <td className="py-2 px-4 text-gray-600">
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
                          </td>
                          <td className="py-2 px-4 text-gray-600">{order.currency_symbol}{order.total}</td>
                          <td className="py-2 px-4 text-gray-600">
                            <Link href={`/account/orders/${order.id}`} className="text-bred-500 hover:text-bred-700">
                              Visualizza
                            </Link>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                
                {/* Paginazione per gli ordini */}
                {orders.length > ordersPerPage && (
                  <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                    <div className="flex flex-1 justify-between sm:hidden">
                      <button
                        onClick={() => setOrdersCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={ordersCurrentPage === 1}
                        className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${ordersCurrentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                      >
                        Precedente
                      </button>
                      <button
                        onClick={() => setOrdersCurrentPage(prev => Math.min(prev + 1, Math.ceil(orders.length / ordersPerPage)))}
                        disabled={ordersCurrentPage === Math.ceil(orders.length / ordersPerPage)}
                        className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${ordersCurrentPage === Math.ceil(orders.length / ordersPerPage) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                      >
                        Successiva
                      </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Mostra <span className="font-medium">{((ordersCurrentPage - 1) * ordersPerPage) + 1}</span> a <span className="font-medium">{Math.min(ordersCurrentPage * ordersPerPage, orders.length)}</span> di{' '}
                          <span className="font-medium">{orders.length}</span> ordini
                        </p>
                      </div>
                      <div>
                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                          <button
                            onClick={() => setOrdersCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={ordersCurrentPage === 1}
                            className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ${ordersCurrentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                          >
                            <span className="sr-only">Precedente</span>
                            {/* Chevron left icon */}
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                            </svg>
                          </button>
                          
                          {/* Numeri di pagina - mostra solo alcune pagine per semplicità */}
                          {[...Array(Math.min(3, Math.ceil(orders.length / ordersPerPage)))].map((_, i) => {
                            const pageNumber = i + 1;
                            return (
                              <button
                                key={i}
                                onClick={() => setOrdersCurrentPage(pageNumber)}
                                className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${pageNumber === ordersCurrentPage ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                              >
                                {pageNumber}
                              </button>
                            );
                          })}
                          
                          {Math.ceil(orders.length / ordersPerPage) > 3 && (
                            <span className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300">
                              ...
                            </span>
                          )}
                          
                          {Math.ceil(orders.length / ordersPerPage) > 3 && (
                            <button
                              onClick={() => setOrdersCurrentPage(Math.ceil(orders.length / ordersPerPage))}
                              className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${Math.ceil(orders.length / ordersPerPage) === ordersCurrentPage ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                            >
                              {Math.ceil(orders.length / ordersPerPage)}
                            </button>
                          )}
                          
                          <button
                            onClick={() => setOrdersCurrentPage(prev => Math.min(prev + 1, Math.ceil(orders.length / ordersPerPage)))}
                            disabled={ordersCurrentPage === Math.ceil(orders.length / ordersPerPage)}
                            className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ${ordersCurrentPage === Math.ceil(orders.length / ordersPerPage) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                          >
                            <span className="sr-only">Successiva</span>
                            {/* Chevron right icon */}
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p>Non hai ancora effettuato ordini.</p>
            )}
          </div>
        );
        
      case 'scheduled-orders':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-600">Le tue rate da pagare</h2>
            
            {isLoadingScheduledOrders ? (
              <p className="text-gray-600">Caricamento rate in corso...</p>
            ) : scheduledOrdersError ? (
              <div className="text-red-500 mb-4">{scheduledOrdersError}</div>
            ) : scheduledOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 text-left text-gray-600">Rata #</th>
                      <th className="py-2 px-4 text-left text-gray-600">Data</th>
                      <th className="py-2 px-4 text-left text-gray-600">Ordine principale</th>
                      <th className="py-2 px-4 text-left text-gray-600">Stato</th>
                      <th className="py-2 px-4 text-left text-gray-600">Totale</th>
                      <th className="py-2 px-4 text-left text-gray-600">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduledOrders
                      .slice(
                        (scheduledOrdersCurrentPage - 1) * scheduledOrdersPerPage,
                        scheduledOrdersCurrentPage * scheduledOrdersPerPage
                      )
                      .map(order => (
                      <tr key={order.id} className="border-t">
                        <td className="py-2 px-4 text-gray-600">#{order.id}</td>
                        <td className="py-2 px-4 text-gray-600">{formatDate(order.date_created)}</td>
                        <td className="py-2 px-4 text-gray-600">
                          {order.parent_id ? (
                            <Link href={`/account/orders/${order.parent_id}`} className="text-bred-500 hover:text-bred-700">
                              #{order.parent_order_number}
                            </Link>
                          ) : '-'}
                        </td>
                        <td className="py-2 px-4 text-gray-600">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.status === 'pending-deposit' ? 'bg-yellow-100 text-yellow-800' :
                            order.status === 'scheduled-payment' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status_name}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-gray-600">{order.formatted_total}</td>
                        <td className="py-2 px-4 text-gray-600">
                          {(order.status === 'pending-deposit' || order.status === 'scheduled-payment') && (
                            <button 
                              onClick={() => handlePayment(order.id)} 
                              className="bg-bred-500 text-white px-4 py-1 rounded hover:bg-bred-700 mr-2"
                            >
                              Paga ora
                            </button>
                          )}
                          <Link href={`/account/orders/${order.id}`} className="text-bred-500 hover:text-bred-700">
                            Dettagli
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Paginazione per le rate da pagare */}
                {scheduledOrders.length > scheduledOrdersPerPage && (
                  <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                    <div className="flex flex-1 justify-between sm:hidden">
                      <button
                        onClick={() => setScheduledOrdersCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={scheduledOrdersCurrentPage === 1}
                        className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${scheduledOrdersCurrentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                      >
                        Precedente
                      </button>
                      <button
                        onClick={() => setScheduledOrdersCurrentPage(prev => Math.min(prev + 1, Math.ceil(scheduledOrders.length / scheduledOrdersPerPage)))}
                        disabled={scheduledOrdersCurrentPage === Math.ceil(scheduledOrders.length / scheduledOrdersPerPage)}
                        className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${scheduledOrdersCurrentPage === Math.ceil(scheduledOrders.length / scheduledOrdersPerPage) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                      >
                        Successiva
                      </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Mostra <span className="font-medium">{((scheduledOrdersCurrentPage - 1) * scheduledOrdersPerPage) + 1}</span> a <span className="font-medium">{Math.min(scheduledOrdersCurrentPage * scheduledOrdersPerPage, scheduledOrders.length)}</span> di{' '}
                          <span className="font-medium">{scheduledOrders.length}</span> rate
                        </p>
                      </div>
                      <div>
                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                          <button
                            onClick={() => setScheduledOrdersCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={scheduledOrdersCurrentPage === 1}
                            className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ${scheduledOrdersCurrentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                          >
                            <span className="sr-only">Precedente</span>
                            {/* Chevron left icon */}
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                            </svg>
                          </button>
                          
                          {/* Numeri di pagina - mostra solo alcune pagine per semplicità */}
                          {[...Array(Math.min(3, Math.ceil(scheduledOrders.length / scheduledOrdersPerPage)))].map((_, i) => {
                            const pageNumber = i + 1;
                            return (
                              <button
                                key={i}
                                onClick={() => setScheduledOrdersCurrentPage(pageNumber)}
                                className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${pageNumber === scheduledOrdersCurrentPage ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                              >
                                {pageNumber}
                              </button>
                            );
                          })}
                          
                          {Math.ceil(scheduledOrders.length / scheduledOrdersPerPage) > 3 && (
                            <span className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300">
                              ...
                            </span>
                          )}
                          
                          {Math.ceil(scheduledOrders.length / scheduledOrdersPerPage) > 3 && (
                            <button
                              onClick={() => setScheduledOrdersCurrentPage(Math.ceil(scheduledOrders.length / scheduledOrdersPerPage))}
                              className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${Math.ceil(scheduledOrders.length / scheduledOrdersPerPage) === scheduledOrdersCurrentPage ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                            >
                              {Math.ceil(scheduledOrders.length / scheduledOrdersPerPage)}
                            </button>
                          )}
                          
                          <button
                            onClick={() => setScheduledOrdersCurrentPage(prev => Math.min(prev + 1, Math.ceil(scheduledOrders.length / scheduledOrdersPerPage)))}
                            disabled={scheduledOrdersCurrentPage === Math.ceil(scheduledOrders.length / scheduledOrdersPerPage)}
                            className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ${scheduledOrdersCurrentPage === Math.ceil(scheduledOrders.length / scheduledOrdersPerPage) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                          >
                            <span className="sr-only">Successiva</span>
                            {/* Chevron right icon */}
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-600">Non hai rate da pagare.</p>
            )}
          </div>
        );
        
      case 'points':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-600">I tuoi punti</h2>
            
            {isLoadingPoints ? (
              <p>Caricamento punti in corso...</p>
            ) : pointsError ? (
              <div className="text-red-500 mb-4">{pointsError}</div>
            ) : pointsData ? (
              <div>
                <div className="bg-gray-100 p-4 rounded-lg mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-gray-600">Il tuo saldo punti</h3>
                  <p className="text-2xl font-bold text-bred-500">{pointsData.pointsLabel}</p>
                </div>
                
                {pointsData.history && pointsData.history.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-gray-600">Cronologia punti</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="py-2 px-4 text-left text-gray-600">Data</th>
                            <th className="py-2 px-4 text-left text-gray-600">Punti</th>
                            <th className="py-2 px-4 text-left text-gray-600">Descrizione</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pointsData.history
                            .slice(
                              (pointsCurrentPage - 1) * pointsPerPage,
                              pointsCurrentPage * pointsPerPage
                            )
                            .map((item: PointsHistoryItem) => (
                              <tr key={item.id} className="border-t">
                                <td className="py-2 px-4 text-gray-600">{formatDate(item.date)}</td>
                                <td className="py-2 px-4">
                                  <span className={item.type === 'earn' ? 'text-green-600' : 'text-red-600'}>
                                    {item.type === 'earn' ? '+' : '-'}{item.points}
                                  </span>
                                </td>
                                <td className="py-2 px-4 text-gray-600">{item.description}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      
                      {/* Paginazione */}
                      {pointsData.history.length > pointsPerPage && (
                        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                          <div className="flex flex-1 justify-between sm:hidden">
                            <button
                              onClick={() => setPointsCurrentPage(prev => Math.max(prev - 1, 1))}
                              disabled={pointsCurrentPage === 1}
                              className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${pointsCurrentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                            >
                              Precedente
                            </button>
                            <button
                              onClick={() => setPointsCurrentPage(prev => Math.min(prev + 1, Math.ceil(pointsData.history.length / pointsPerPage)))}
                              disabled={pointsCurrentPage === Math.ceil(pointsData.history.length / pointsPerPage)}
                              className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${pointsCurrentPage === Math.ceil(pointsData.history.length / pointsPerPage) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                            >
                              Successiva
                            </button>
                          </div>
                          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm text-gray-700">
                                Mostra <span className="font-medium">{((pointsCurrentPage - 1) * pointsPerPage) + 1}</span> a <span className="font-medium">{Math.min(pointsCurrentPage * pointsPerPage, pointsData.history.length)}</span> di{' '}
                                <span className="font-medium">{pointsData.history.length}</span> risultati
                              </p>
                            </div>
                            <div>
                              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                <button
                                  onClick={() => setPointsCurrentPage(prev => Math.max(prev - 1, 1))}
                                  disabled={pointsCurrentPage === 1}
                                  className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ${pointsCurrentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                                >
                                  <span className="sr-only">Precedente</span>
                                  {/* Chevron left icon */}
                                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                
                                {/* Numeri di pagina - mostra solo alcune pagine per semplicità */}
                                {[...Array(Math.min(3, Math.ceil(pointsData.history.length / pointsPerPage)))].map((_, i) => {
                                  const pageNumber = i + 1;
                                  return (
                                    <button
                                      key={i}
                                      onClick={() => setPointsCurrentPage(pageNumber)}
                                      className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${pageNumber === pointsCurrentPage ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                                    >
                                      {pageNumber}
                                    </button>
                                  );
                                })}
                                
                                {Math.ceil(pointsData.history.length / pointsPerPage) > 3 && (
                                  <span className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300">
                                    ...
                                  </span>
                                )}
                                
                                {Math.ceil(pointsData.history.length / pointsPerPage) > 3 && (
                                  <button
                                    onClick={() => setPointsCurrentPage(Math.ceil(pointsData.history.length / pointsPerPage))}
                                    className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${Math.ceil(pointsData.history.length / pointsPerPage) === pointsCurrentPage ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                                  >
                                    {Math.ceil(pointsData.history.length / pointsPerPage)}
                                  </button>
                                )}
                                
                                <button
                                  onClick={() => setPointsCurrentPage(prev => Math.min(prev + 1, Math.ceil(pointsData.history.length / pointsPerPage)))}
                                  disabled={pointsCurrentPage === Math.ceil(pointsData.history.length / pointsPerPage)}
                                  className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ${pointsCurrentPage === Math.ceil(pointsData.history.length / pointsPerPage) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                                >
                                  <span className="sr-only">Successiva</span>
                                  {/* Chevron right icon */}
                                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </nav>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p>Nessuna attività punti registrata.</p>
                )}
              </div>
            ) : (
              <p>Nessun dato punti disponibile.</p>
            )}
          </div>
        );
        
      case 'addresses':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-600">I tuoi indirizzi</h2>
            <p className="mb-4 text-gray-600">
              Gli indirizzi seguenti verranno utilizzati di default durante il checkout.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-600">Indirizzo di fatturazione</h3>
                <div className="border p-4 rounded-md">
                  <p className="text-gray-600">Non hai ancora impostato un indirizzo di fatturazione.</p>
                  <Link href="/account/edit-address/billing" className="text-bred-500 hover:text-bred-700 mt-2 inline-block">
                    Aggiungi indirizzo
                  </Link>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-600">Indirizzo di spedizione</h3>
                <div className="border p-4 rounded-md">
                  <p className="text-gray-600">Non hai ancora impostato un indirizzo di spedizione.</p>
                  <Link href="/account/edit-address/shipping" className="text-bred-500 hover:text-bred-700 mt-2 inline-block">
                    Aggiungi indirizzo
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'account-details':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-600">Dettagli account</h2>
            <Link href="/account/edit-account" className="text-bred-500 hover:text-bred-700 mb-4 inline-block">
              Modifica i dettagli del tuo account
            </Link>
            
            <div className="bg-white rounded-lg shadow-sm p-4 border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Nome</p>
                  <p className="font-medium text-gray-700">{user?.firstName || '-'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Cognome</p>
                  <p className="font-medium text-gray-700">{user?.lastName || '-'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Username</p>
                  <p className="font-medium text-gray-700">{user?.username || '-'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium text-gray-700">{user?.email || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return <div>Seleziona una sezione dal menu</div>;
    }
  };
  
  // Mostra un messaggio di caricamento se l'autenticazione è in corso
  if (isLoading) {
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
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8 text-gray-900">Il mio account</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="md:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-4">
                <nav>
                  <ul className="space-y-2">
                    <li>
                      <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`text-gray-600 w-full text-left px-4 py-2 rounded-md ${activeTab === 'dashboard' ? 'bg-bred-100 text-blue-700' : 'hover:bg-gray-100'}`}
                      >
                        Dashboard
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab('orders')}
                        className={`text-gray-600 w-full text-left px-4 py-2 rounded-md ${activeTab === 'orders' ? 'bg-bred-100 text-blue-700' : 'hover:bg-gray-100'}`}
                      >
                        Ordini
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab('scheduled-orders')}
                        className={`text-gray-600 w-full text-left px-4 py-2 rounded-md ${activeTab === 'scheduled-orders' ? 'bg-bred-100 text-blue-700' : 'hover:bg-gray-100'}`}
                      >
                        Rate da pagare
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab('points')}
                        className={`text-gray-600 w-full text-left px-4 py-2 rounded-md ${activeTab === 'points' ? 'bg-bred-100 text-blue-700' : 'hover:bg-gray-100'}`}
                      >
                        I miei punti
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab('addresses')}
                        className={`text-gray-600 w-full text-left px-4 py-2 rounded-md ${activeTab === 'addresses' ? 'bg-bred-100 text-blue-700' : 'hover:bg-gray-100'}`}
                      >
                        Indirizzi
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab('account-details')}
                        className={`text-gray-600 w-full text-left px-4 py-2 rounded-md ${activeTab === 'account-details' ? 'bg-bred-100 text-blue-700' : 'hover:bg-gray-100'}`}
                      >
                        Dettagli account
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 rounded-md text-red-600 hover:bg-red-50"
                      >
                        Logout
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
            
            {/* Content */}
            <div className="md:col-span-3">
              <div className="bg-white rounded-lg shadow-md p-6">
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Modale di pagamento con Stripe Elements */}
      {isPaymentModalOpen && paymentOrderId && (
        <ScheduledPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={handleClosePaymentModal}
          orderId={paymentOrderId}
          orderTotal={paymentOrderTotal}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
        />
      )}
    </div>
  );
}

// Main page component with Suspense boundary
export default function AccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col">
        <main className="flex-grow py-8">
          <div className="container mx-auto px-4">
            <p className="text-center">Caricamento in corso...</p>
          </div>
        </main>
      </div>
    }>
      <AccountContent />
    </Suspense>
  );
}
