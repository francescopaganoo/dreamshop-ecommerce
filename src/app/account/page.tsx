'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

// Interfaccia per gli ordini
interface Order {
  id: number;
  number: string;
  status: string;
  date_created: string;
  total: string;
  currency_symbol: string;
}

// Interfaccia per i punti
interface PointsData {
  points: number;
  pointsLabel: string;
  history: PointHistory[];
}

interface PointHistory {
  id: number;
  date: string;
  points: number;
  description: string;
  type: string;
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
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [isLoadingPoints, setIsLoadingPoints] = useState(false);
  
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
  
  // Carica i punti dell'utente
  useEffect(() => {
    const fetchPoints = async () => {
      if (!user) {
        console.log('Utente non disponibile, impossibile caricare i punti');
        return;
      }
      
      setIsLoadingPoints(true);
      
      try {
        // Recupera il token dal localStorage
        const token = localStorage.getItem('woocommerce_token');
        
        if (!token) {
          console.error('Token non trovato nel localStorage');
          throw new Error('Token non trovato');
        }
        
        console.log('Recupero punti per utente:', user.id);
        
        // Aggiungiamo un timestamp per evitare problemi di cache
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/points/user?_=${timestamp}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Risposta API punti non valida:', response.status, errorText);
          throw new Error(`Errore nel caricamento dei punti: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Punti caricati:', data);
        setPointsData(data);
      } catch (error) {
        console.error('Errore durante il caricamento dei punti:', error);
      } finally {
        setIsLoadingPoints(false);
      }
    };
    
    if (activeTab === 'points' && user) {
      fetchPoints();
    }
  }, [activeTab, user]);

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
            <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
            <p className="mb-4">
              Ciao <span className="font-semibold">{user?.displayName || user?.username}</span>, benvenuto nel tuo account.
            </p>
            <p className="mb-4">
              Da qui puoi visualizzare i tuoi <Link href="#" onClick={() => setActiveTab('orders')} className="text-blue-600 hover:text-blue-800">ordini recenti</Link>, gestire i tuoi <Link href="#" onClick={() => setActiveTab('addresses')} className="text-blue-600 hover:text-blue-800">indirizzi di spedizione</Link> e <Link href="#" onClick={() => setActiveTab('account-details')} className="text-blue-600 hover:text-blue-800">modificare i dettagli del tuo account</Link>.
            </p>
          </div>
        );
        
      case 'orders':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">I tuoi ordini</h2>
            
            {isLoadingOrders ? (
              <p>Caricamento ordini in corso...</p>
            ) : orders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 text-left">Ordine</th>
                      <th className="py-2 px-4 text-left">Data</th>
                      <th className="py-2 px-4 text-left">Stato</th>
                      <th className="py-2 px-4 text-left">Totale</th>
                      <th className="py-2 px-4 text-left">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr key={order.id} className="border-t">
                        <td className="py-2 px-4">#{order.number}</td>
                        <td className="py-2 px-4">{formatDate(order.date_created)}</td>
                        <td className="py-2 px-4">
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
                        <td className="py-2 px-4">{order.currency_symbol}{order.total}</td>
                        <td className="py-2 px-4">
                          <Link href={`/account/orders/${order.id}`} className="text-blue-600 hover:text-blue-800">
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
        
      case 'addresses':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">I tuoi indirizzi</h2>
            <p className="mb-4">
              Gli indirizzi seguenti verranno utilizzati di default durante il checkout.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Indirizzo di fatturazione</h3>
                <div className="border p-4 rounded-md">
                  <p>Non hai ancora impostato un indirizzo di fatturazione.</p>
                  <Link href="/account/edit-address/billing" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
                    Aggiungi indirizzo
                  </Link>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Indirizzo di spedizione</h3>
                <div className="border p-4 rounded-md">
                  <p>Non hai ancora impostato un indirizzo di spedizione.</p>
                  <Link href="/account/edit-address/shipping" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
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
            <h2 className="text-xl font-semibold mb-4">Dettagli account</h2>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Nome</p>
                  <p className="font-medium">{user?.firstName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cognome</p>
                  <p className="font-medium">{user?.lastName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{user?.email || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'points':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">I miei punti</h2>
            
            {isLoadingPoints ? (
              <div className="text-center py-8">
                <p>Caricamento punti in corso...</p>
              </div>
            ) : pointsData ? (
              <div>
                <div className="bg-blue-50 p-6 rounded-lg mb-6 text-center">
                  <h3 className="text-lg text-gray-700 mb-2">Saldo punti attuale</h3>
                  <p className="text-3xl font-bold text-blue-600">{pointsData.pointsLabel}</p>
                </div>
                
                <h3 className="text-lg font-semibold mb-3">Cronologia punti</h3>
                
                {pointsData.history && pointsData.history.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="py-2 px-4 text-left">Data</th>
                          <th className="py-2 px-4 text-left">Punti</th>
                          <th className="py-2 px-4 text-left">Descrizione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pointsData.history.map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="py-2 px-4">{formatDate(item.date)}</td>
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
                ) : (
                  <p className="text-gray-500 italic">Nessuna attività punti registrata.</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 italic">Impossibile caricare i dati dei punti. Riprova più tardi.</p>
            )}
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
        <Header />
        
        <main className="flex-grow py-8">
          <div className="container mx-auto px-4">
            <p className="text-center">Caricamento in corso...</p>
          </div>
        </main>
        
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
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
                        className={`text-gray-600 w-full text-left px-4 py-2 rounded-md ${activeTab === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                      >
                        Dashboard
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab('orders')}
                        className={`text-gray-600 w-full text-left px-4 py-2 rounded-md ${activeTab === 'orders' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                      >
                        Ordini
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab('addresses')}
                        className={`text-gray-600 w-full text-left px-4 py-2 rounded-md ${activeTab === 'addresses' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                      >
                        Indirizzi
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab('account-details')}
                        className={`text-gray-600 w-full text-left px-4 py-2 rounded-md ${activeTab === 'account-details' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                      >
                        Dettagli account
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab('points')}
                        className={`text-gray-600 w-full text-left px-4 py-2 rounded-md ${activeTab === 'points' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                      >
                        I miei punti
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
      
      <Footer />
    </div>
  );
}

// Main page component with Suspense boundary
export default function AccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow py-8">
          <div className="container mx-auto px-4">
            <p className="text-center">Caricamento in corso...</p>
          </div>
        </main>
        <Footer />
      </div>
    }>
      <AccountContent />
    </Suspense>
  );
}
