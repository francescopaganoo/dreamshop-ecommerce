'use client';

import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import Link from 'next/link';
// import { formatPrice } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getDepositInfo, ProductWithDeposit } from '@/lib/deposits';

// Interfaccia per gli errori di stock
interface StockIssue {
  id?: number;
  variation_id?: number;
  name?: string;
  issue?: string;
  message: string;
  available?: number;
  requested?: number;
  fixed?: boolean;
}

// Definizione dell'interfaccia per i prodotti nel carrello
interface CartProduct {
  id: number;
  name: string;
  slug?: string;
  // Altre proprietà opzionali che potrebbero essere presenti
  price?: string;
  regular_price?: string;
  images?: Array<{src: string}>;
}

// Funzione per ottenere lo slug valido di un prodotto
const getProductSlug = (product: CartProduct): string => {
  // Se il prodotto ha già uno slug, usalo
  if (product.slug) return product.slug;
  
  // Se non c'è uno slug, usa l'ID come fallback
  return product.id.toString();
};

export default function CartPage() {
  const { 
    cart, 
    removeFromCart, 
    updateQuantity, 
    clearCart, 
    getCartTotal,
    coupon,
    couponCode,
    setCouponCode,
    applyCouponCode,
    removeCoupon,
    discount,
    couponError,
    isApplyingCoupon,
    stockMessage,
    // Nuove proprietà per i punti
    userPoints,
    pointsLabel,
    pointsToRedeem,
    setPointsToRedeem,
    pointsDiscount,
    loadUserPoints,
    isLoadingPoints,
    pointsError
  } = useCart();
  const { user } = useAuth();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [stockErrors, setStockErrors] = useState<StockIssue[]>([]);
  const [showStockAlert, setShowStockAlert] = useState(false);
  const [quantityUpdated, setQuantityUpdated] = useState(false);
  const [pointsInputValue, setPointsInputValue] = useState<string>('');
  
  // Format price with currency symbol
  const formatPrice = (price: number) => {
    return `€${price.toFixed(2)}`;
  };
  
  // La funzione getProductSlug e l'interfaccia correlata sono state rimosse perché non utilizzate
  
  // Carica i punti dell'utente quando la pagina viene caricata
  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('woocommerce_token');
      if (token) {
        loadUserPoints(user.id, token);
      }
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Stato per il messaggio di errore dei punti
  const [pointsErrorMessage, setPointsErrorMessage] = useState<string | null>(null);

  // Gestisce il cambio del valore dei punti da riscattare
  const handlePointsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPointsInputValue(value);
    setPointsErrorMessage(null); // Resetta il messaggio di errore
    
    // Se il valore è vuoto, imposta i punti da riscattare a 0
    if (!value) {
      setPointsToRedeem(0);
      return;
    }
    
    // Converti il valore in numero
    const points = parseInt(value, 10);
    
    // Verifica che sia un numero valido
    if (isNaN(points)) {
      setPointsErrorMessage('Inserisci un numero valido');
      return;
    }
    
    // Verifica che non sia negativo
    if (points < 0) {
      setPointsErrorMessage('Il numero di punti non può essere negativo');
      setPointsToRedeem(0);
      return;
    }
    
    // Verifica che non superi i punti disponibili
    if (points > userPoints) {
      setPointsErrorMessage(`Hai solo ${userPoints} punti disponibili`);
      // Imposta comunque il valore massimo disponibile
      setPointsToRedeem(userPoints);
      return;
    }
    
    // Imposta i punti da riscattare
    setPointsToRedeem(points);
  };
  
  const handleQuantityChange = (productId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateQuantity(productId, newQuantity);
  };
  
  const handleRemoveItem = (productId: number) => {
    removeFromCart(productId);
  };
  
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    await applyCouponCode();
  };
  
  const handleCheckout = async () => {
    setIsCheckingOut(true);
    setStockErrors([]);
    setShowStockAlert(false);
    
    try {
      // Prepara i dati del carrello per la verifica
      const cartItems = cart.map(item => ({
        product_id: item.product.id,
        variation_id: item.variation_id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price
      }));
      
      // Chiama l'API per verificare la disponibilità
      const response = await fetch('/api/check-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cartItems }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Se ci sono punti da riscattare, salva le informazioni nel localStorage
        if (pointsToRedeem > 0) {
          // Salva i dati dei punti per il checkout
          localStorage.setItem('checkout_points_to_redeem', pointsToRedeem.toString());
          localStorage.setItem('checkout_points_discount', pointsDiscount.toString());
        } else {
          // Rimuovi eventuali dati di punti precedenti
          localStorage.removeItem('checkout_points_to_redeem');
          localStorage.removeItem('checkout_points_discount');
        }
        
        // Tutti i prodotti sono disponibili, procedi al checkout
        window.location.href = '/checkout';
      } else {
        // Verifica se ci sono prodotti con quantità insufficiente che possono essere aggiornati automaticamente
        let quantityIssuesFixed = false;
        const updatedStockErrors = [...data.stockIssues];
        
        // Filtra gli errori per trovare quelli relativi alla quantità insufficiente
        const quantityIssues = data.stockIssues.filter((issue: StockIssue) => 
          issue.issue === 'insufficient_quantity' && 
          typeof issue.available === 'number' && 
          issue.available > 0
        );
        
        // Se ci sono problemi di quantità, aggiorniamo automaticamente il carrello
        if (quantityIssues.length > 0) {
          for (const issue of quantityIssues) {
            // Aggiorna la quantità nel carrello
            if (issue.id) {
              updateQuantity(issue.id, issue.available);
              quantityIssuesFixed = true;
              
              // Aggiorna il messaggio di errore
              const index = updatedStockErrors.findIndex(err => 
                err.id === issue.id && err.issue === 'insufficient_quantity'
              );
              
              if (index !== -1) {
                updatedStockErrors[index] = {
                  ...updatedStockErrors[index],
                  message: `La quantità di "${issue.name}" è stata aggiornata automaticamente a ${issue.available} ${issue.available === 1 ? 'pezzo' : 'pezzi'} (massimo disponibile).`,
                  fixed: true
                };
              }
            }
          }
        }
        
        // Aggiorna gli errori e mostra l'avviso
        setStockErrors(updatedStockErrors);
        setShowStockAlert(true);
        setIsCheckingOut(false);
        setQuantityUpdated(quantityIssuesFixed);
        
        // Scorri fino all'avviso
        setTimeout(() => {
          const alertElement = document.getElementById('stock-alert');
          if (alertElement) {
            alertElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    } catch (error) {
      console.error('Errore durante la verifica della disponibilità:', error);
      setStockErrors([{ message: 'Si è verificato un errore durante la verifica della disponibilità. Riprova più tardi.' }]);
      setShowStockAlert(true);
      setIsCheckingOut(false);
    }
  };
  
  const cartTotal = getCartTotal();
  const orderTotal = cartTotal; // Rimuoviamo la spedizione dal carrello
  
  return (
    <div className="min-h-screen flex flex-col">
      
      <main className="flex-grow py-8 bg-white">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold mb-4 text-gray-900">Your Shopping Cart</h1>
          
          {/* Messaggio di avviso per limiti di stock */}
          {stockMessage && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-700 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {stockMessage}
              </p>
            </div>
          )}
          
          {/* Avviso di errori di disponibilità */}
          {showStockAlert && stockErrors.length > 0 && (
            <div id="stock-alert" className={`mb-6 p-4 ${quantityUpdated ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'} border rounded-md`}>
              <div className="flex items-start">
                {quantityUpdated ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600 mt-0.5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 mt-0.5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                <div>
                  <h3 className={`${quantityUpdated ? 'text-amber-800' : 'text-red-800'} font-medium mb-2`}>
                    {quantityUpdated 
                      ? 'Alcune quantità sono state aggiornate automaticamente' 
                      : 'Attenzione: alcuni prodotti nel tuo carrello non sono più disponibili'}
                  </h3>
                  <ul className={`${quantityUpdated ? 'text-amber-700' : 'text-red-700'} text-sm space-y-1 list-disc list-inside`}>
                    {stockErrors.map((error, index) => (
                      <li key={index} className={error.fixed ? 'font-medium' : ''}>{error.message}</li>
                    ))}
                  </ul>
                  {!quantityUpdated && (
                    <p className="text-red-700 text-sm mt-2">
                      Aggiorna le quantità o rimuovi i prodotti non disponibili prima di procedere al checkout.
                    </p>
                  )}
                  {quantityUpdated && (
                    <p className="text-amber-700 text-sm mt-2">
                      Il carrello è stato aggiornato con le quantità disponibili. Puoi procedere al checkout.
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex space-x-3">
                <button 
                  onClick={() => setShowStockAlert(false)} 
                  className={`${quantityUpdated ? 'text-amber-700 hover:text-amber-900' : 'text-red-700 hover:text-red-900'} text-sm font-medium`}
                >
                  Chiudi
                </button>
                {quantityUpdated && (
                  <button 
                    onClick={handleCheckout} 
                    className="text-green-700 hover:text-green-900 text-sm font-medium"
                  >
                    Procedi al checkout
                  </button>
                )}
              </div>
            </div>
          )}
          
          {cart.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <h2 className="text-2xl font-semibold mb-4 text-gray-600">Il carrello è vuoto</h2>
              <p className="text-gray-600 mb-6">Sembra che non hai ancora aggiunto alcun prodotto al carrello</p>
              <Link 
                href="/"
                className="bg-bred-500 text-white px-6 py-3 rounded-md font-medium hover:bg-bred-700 transition-colors"
              >
                Vai allo shop
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {cart.map(item => {
                        console.log('Visualizzazione prodotto nel carrello:', item.product);
                        
                        // Otteniamo tutte le informazioni sull'acconto dal prodotto
                        const depositInfo = getDepositInfo(item.product as unknown as ProductWithDeposit);
                        const isDeposit = depositInfo.hasDeposit;
                        
                        console.log('Info acconto estratte:', depositInfo);
                        
                        // Calcola il prezzo in base ai metadati dell'acconto
                        let itemPrice = parseFloat(item.product.price || item.product.regular_price || '0');
                        let priceLabel = '';
                        // const fullPrice = itemPrice; // Non utilizzato
                        
                        console.log(`Prodotto ${item.product.name} - prezzo originale:`, itemPrice);
                        
                        // Se il prodotto ha l'acconto attivo, dobbiamo mostrare il prezzo dell'acconto
                        if (isDeposit) {
                          // Forziamo l'uso della percentuale standard del 40% se non riusciamo a recuperarla dai metadati
                          let depositPercentage = depositInfo.depositPercentage;
                          
                          // Se la percentuale è 0 o non valida, usiamo il 40% come predefinito
                          if (!depositPercentage || depositPercentage <= 0) {
                            console.log('Percentuale acconto non valida, uso 40% predefinito');
                            depositPercentage = 0.4; // 40%
                          }
                          
                          console.log(`Percentuale acconto per il calcolo: ${depositPercentage * 100}%`);
                          
                          // Calcoliamo il prezzo dell'acconto
                          const depositPrice = itemPrice * depositPercentage;
                          console.log(`Prezzo acconto calcolato: ${depositPrice} (${itemPrice} * ${depositPercentage})`);
                          
                          // Aggiorniamo il prezzo visualizzato con quello dell'acconto
                          itemPrice = depositPrice;
                          
                          // Creiamo l'etichetta appropriata
                          const percentageDisplay = Math.round(depositPercentage * 100);
                          priceLabel = `Acconto (${percentageDisplay}%)`;
                        }
                        
                        const itemTotal = itemPrice * item.quantity;
                        
                        return (
                          <tr key={item.product.id}>
                            <td className="px-6 py-4 ">
                              <div className="flex items-center">
                                <div className="relative h-16 w-16 flex-shrink-0 mr-4">
                                  <Image
                                    src={item.product.images && item.product.images.length > 0 
                                      ? item.product.images[0].src 
                                      : 'https://via.placeholder.com/100'}
                                    alt={item.product.name}
                                    fill
                                    sizes="64px"
                                    style={{ objectFit: 'cover' }}
                                    className="rounded-md"
                                  />
                                </div>
                                <div>
                                  <Link 
                                    href={`/product/${getProductSlug(item.product)}`}
                                    className="text-sm font-medium text-gray-900 hover:text-blue-600"
                                  >
                                    {item.product.name}
                                  </Link>

                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex flex-col">
                                <span className="text-gray-700">{formatPrice(itemPrice)}</span>
                                {isDeposit && (
                                  <span className="text-xs text-green-600 font-medium">{priceLabel}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 ">
                              <div className="flex items-center border border-gray-300 rounded-md w-24">
                                <button
                                  type="button"
                                  onClick={() => handleQuantityChange(item.product.id, item.quantity - 1)}
                                  className="px-2 py-1 text-gray-600 hover:bg-gray-100"
                                >
                                  -
                                </button>
                                <span className="px-2 py-1 text-center flex-grow">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleQuantityChange(item.product.id, item.quantity + 1)}
                                  className="px-2 py-1 text-gray-600 hover:bg-gray-100"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">{formatPrice(itemTotal)}</span>
                                {isDeposit && (
                                  <span className="text-xs text-green-600">
                                    Totale prodotto: {formatPrice(parseFloat(item.product.price || item.product.regular_price || '0') * item.quantity)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-medium">
                              <button
                                onClick={() => handleRemoveItem(item.product.id)}
                                className="flex items-center px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-all"
                                aria-label="Rimuovi prodotto dal carrello"
                                title="Rimuovi prodotto dal carrello"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Rimuovi
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-4 flex justify-between">
                  <Link 
                    href="/"
                    className="text-bred-500 hover:text-bred-700 font-medium"
                  >
                    ← Torna allo shop
                  </Link>
                  
                  <button
                    onClick={clearCart}
                    className="text-red-600 hover:text-red-800 font-medium"
                  >
                    Svuota il carrello
                  </button>
                </div>
              </div>
              
              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold mb-4 text-gray-700">Riepilogo</h2>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotale</span>
                      <span className="font-medium text-gray-600">{formatPrice(cartTotal + discount)}</span>
                    </div>
                    
                    {discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Sconto coupon</span>
                        <span>-{formatPrice(discount)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Spedizione</span>
                      <span className="font-medium text-gray-600">Calcolata al checkout</span>
                    </div>
                    
                    {/* Coupon Code */}
                    {coupon ? (
                      <div className="pt-2">
                        <div className="flex items-center justify-between bg-green-50 p-3 rounded-md">
                          <div>
                            <span className="font-medium text-green-700">
                              {coupon.code}
                            </span>
                            <p className="text-sm text-green-600">
                              {coupon.discount_type === 'percent' 
                                ? `Sconto del ${coupon.amount}%` 
                                : `Sconto di €${parseFloat(coupon.amount).toFixed(2)}`}
                            </p>
                          </div>
                          <button
                            onClick={removeCoupon}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                            aria-label="Rimuovi coupon"
                          >
                            Rimuovi
                          </button>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleApplyCoupon} className="pt-2">
                        <div className="flex">
                          <input
                            type="text"
                            placeholder="Codice coupon"
                            className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none text-gray-600 focus:ring-2 focus:ring-bred-500"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            disabled={isApplyingCoupon}
                          />
                          <button
                            type="submit"
                            className={`px-4 py-2 rounded-r-md transition-colors ${
                              isApplyingCoupon 
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                            disabled={isApplyingCoupon}
                          >
                            {isApplyingCoupon ? (
                              <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Applicando...
                              </span>
                            ) : (
                              'Applica'
                            )}
                          </button>
                        </div>
                        {couponError && (
                          <p className="text-red-600 text-sm mt-1">{couponError}</p>
                        )}
                      </form>
                    )}
                    
                    {/* Sezione per i punti */}
                    {user && userPoints > 0 && (
                      <div className="border-t pt-4 mt-4">
                        <h3 className="text-lg font-semibold mb-2 text-gray-700">I tuoi punti</h3>
                        <p className="text-sm text-gray-600 mb-2">
                          Hai {pointsLabel} disponibili. Ogni 100 punti valgono 1€ di sconto.
                        </p>
                        <div className="flex items-center">
                          <input
                            type="number"
                            min="0"
                            max={userPoints}
                            placeholder="Punti da utilizzare"
                            className={`flex-grow px-3 py-2 border ${pointsErrorMessage ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none text-gray-600 focus:ring-2 focus:ring-bred-500`}
                            value={pointsInputValue}
                            onChange={handlePointsChange}
                            disabled={isLoadingPoints}
                          />
                        </div>
                        {pointsErrorMessage && (
                          <p className="text-red-500 text-sm mt-1">{pointsErrorMessage}</p>
                        )}
                        {pointsToRedeem > 0 && (
                          <div className="mt-2 flex justify-between text-sm">
                            <span>Sconto punti:</span>
                            <span className="text-green-600">-{formatPrice(pointsDiscount)}</span>
                          </div>
                        )}
                        {pointsError && (
                          <p className="text-red-600 text-sm mt-1">{pointsError}</p>
                        )}
                      </div>
                    )}
                    
                    <div className="border-t pt-4 mt-4">
                      <div className="flex justify-between font-bold text-lg">
                        <span className="text-gray-600">Totale</span>
                        <span className="text-gray-600">{formatPrice(orderTotal)}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleCheckout}
                      disabled={isCheckingOut || cart.length === 0}
                      className="w-full bg-bred-500 text-white py-3 rounded-md font-medium hover:bg-bred-700 transition-colors disabled:bg-bred-400 flex items-center justify-center"
                    >
                      {isCheckingOut ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Verifica disponibilità...
                        </>
                      ) : (
                        'Procedi al Checkout'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      
    </div>
  );
}
