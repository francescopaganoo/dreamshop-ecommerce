'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { getUserPoints, PointsResponse, PointsHistoryItem } from '../../lib/points';

// Interfaccia per gli ordini
interface Order {
  id: number;
  number: string;
  status: string;
  date_created: string;
  total: string;
  currency_symbol: string;
}

// Client component that uses useSearchParams
function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  
  // Ottieni la tab dall'URL o usa 'dashboard' come default
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  
  // Stato per i punti
  const [pointsData, setPointsData] = useState<PointsResponse | null>(null);
  const [isLoadingPoints, setIsLoadingPoints] = useState(false);
  const [pointsError, setPointsError] = useState<string | null>(null);
  
  // Reindirizza l'utente se non è autenticato
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);
  
  // Aggiorna la tab attiva quando cambia il parametro nell'URL
  useEffect(() => {
    if (tabParam && ['dashboard', 'orders', 'addresses', 'account-details', 'points'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  
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
        console.log(`Ordini caricati: ${data.length}`);
        setOrders(data);
      } catch (error) {
        console.error('Errore durante il caricamento degli ordini:', error);
      } finally {
        setIsLoadingOrders(false);
      }
    };
    
    if (activeTab === 'orders' && user) {
      fetchOrders();
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
          
          // Chiamata all'API per recuperare i punti
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
  
  // Mostra il contenuto in base alla tab attiva
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
              Da qui puoi visualizzare i tuoi <Link href="#" onClick={() => setActiveTab('orders')} className="text-bred-500 hover:text-bred-700">ordini recenti</Link>, controllare i tuoi <Link href="#" onClick={() => setActiveTab('points')} className="text-bred-500 hover:text-bred-700">punti fedeltà</Link>, gestire i tuoi <Link href="#" onClick={() => setActiveTab('addresses')} className="text-bred-500 hover:text-bred-700">indirizzi di spedizione</Link> e <Link href="#" onClick={() => setActiveTab('account-details')} className="text-bred-500 hover:text-bred-700">modificare i dettagli del tuo account</Link>.
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
                    {orders.map(order => (
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
              </div>
            ) : (
              <p>Non hai ancora effettuato ordini.</p>
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
                          {pointsData.history.map((item: PointsHistoryItem) => (
                            <tr key={item.id} className="border-t">
                              <td className="py-2 px-4 text-gray-600">{formatDate(item.date)}</td>
                              <td className="py-2 px-4">
                                <span className={item.points > 0 ? 'text-green-600' : 'text-red-600'}>
                                  {item.points > 0 ? '+' : ''}{item.points}
                                </span>
                              </td>
                              <td className="py-2 px-4">{item.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
