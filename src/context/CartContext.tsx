"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, Coupon, verifyCoupon, applyCoupon } from '../lib/api';
import { getUserPoints, redeemPoints, PointsResponse } from '../lib/points';

export interface CartItem {
  product: Product;
  quantity: number;
  variation_id?: number;
  attributes?: Array<{
    id: number;
    name: string;
    option: string;
  }>;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem | Product, quantity?: number) => { success: boolean; message?: string };
  removeFromCart: (productId: number, variationId?: number) => void;
  updateQuantity: (productId: number, quantity: number, variationId?: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
  coupon: Coupon | null;
  couponCode: string;
  setCouponCode: (code: string) => void;
  applyCouponCode: () => Promise<void>;
  removeCoupon: () => void;
  discount: number;
  couponError: string | null;
  isApplyingCoupon: boolean;
  stockMessage: string | null;
  setStockMessage: (message: string | null) => void;
  // Nuove proprietà per i punti
  userPoints: number;
  pointsLabel: string;
  pointsToRedeem: number;
  setPointsToRedeem: (points: number) => void;
  pointsDiscount: number;
  loadUserPoints: (userId: number, token: string) => Promise<void>;
  applyPointsDiscount: () => void;
  removePointsDiscount: () => void;
  isLoadingPoints: boolean;
  pointsError: string | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponCode, setCouponCode] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState<boolean>(false);
  const [stockMessage, setStockMessage] = useState<string | null>(null);
  
  // Stati per la gestione dei punti
  const [userPoints, setUserPoints] = useState<number>(0);
  const [pointsLabel, setPointsLabel] = useState<string>('0 punti');
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const [pointsDiscount, setPointsDiscount] = useState<number>(0);
  const [isLoadingPoints, setIsLoadingPoints] = useState<boolean>(false);
  const [pointsError, setPointsError] = useState<string | null>(null);

  // Funzione per generare uno slug dal nome del prodotto
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  // Funzione per assicurarsi che un prodotto abbia uno slug
  const ensureProductSlug = (product: Product): Product => {
    if (!product.slug && product.name) {
      product.slug = generateSlug(product.name);
    }
    return product;
  };

  // Load cart and coupon from localStorage on initial render
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('cart');
      const savedCoupon = localStorage.getItem('coupon');
      const savedDiscount = localStorage.getItem('discount');
      const savedPointsToRedeem = localStorage.getItem('pointsToRedeem');
      const savedPointsDiscount = localStorage.getItem('pointsDiscount');
      
      if (savedCart) {
        // Assicurati che tutti i prodotti nel carrello caricato abbiano uno slug
        const loadedCart = JSON.parse(savedCart) as CartItem[];
        const updatedCart = loadedCart.map(item => ({
          ...item,
          product: ensureProductSlug(item.product)
        }));
        setCart(updatedCart);
      }
      
      if (savedCoupon) {
        setCoupon(JSON.parse(savedCoupon));
        setCouponCode(JSON.parse(savedCoupon).code || '');
      }
      
      if (savedDiscount) {
        setDiscount(parseFloat(savedDiscount));
      }
      
      if (savedPointsToRedeem) {
        setPointsToRedeem(parseInt(savedPointsToRedeem, 10));
      }
      
      if (savedPointsDiscount) {
        setPointsDiscount(parseFloat(savedPointsDiscount));
      }
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ricalcola lo sconto quando il carrello cambia e c'è un coupon attivo
  useEffect(() => {
    if (coupon && cart.length > 0) {
      // Evita di ricalcolare se il carrello è vuoto
      recalculateCouponDiscount();
    }
  }, [cart, coupon]); // eslint-disable-line react-hooks/exhaustive-deps
  // Non includiamo recalculateCouponDiscount nelle dipendenze per evitare un riferimento circolare

  // Save cart, coupon and points to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
      
      if (coupon) {
        localStorage.setItem('coupon', JSON.stringify(coupon));
        localStorage.setItem('discount', discount.toString());
      } else {
        localStorage.removeItem('coupon');
        localStorage.removeItem('discount');
      }
      
      if (pointsToRedeem > 0) {
        localStorage.setItem('pointsToRedeem', pointsToRedeem.toString());
        localStorage.setItem('pointsDiscount', pointsDiscount.toString());
      } else {
        localStorage.removeItem('pointsToRedeem');
        localStorage.removeItem('pointsDiscount');
      }
    } catch (error) {
      console.error('Error saving data to localStorage:', error);
    }
  }, [cart, coupon, discount, pointsToRedeem, pointsDiscount]);

  /**
   * Aggiunge un prodotto al carrello o aggiorna la quantità se già presente
   * Con controllo della quantità disponibile in magazzino
   * @returns Un oggetto con il risultato dell'operazione e un eventuale messaggio
   */
  const addToCart = (item: CartItem | Product, quantity = 1): { success: boolean; message?: string } => {
    try {
      // Crea una copia dell'attuale carrello
      const newCart = [...cart];
      
      // Gestisci il caso in cui l'item è un CartItem (con product già incluso)
      if ('product' in item) {
        const cartItem = item as CartItem;
        const actualQuantity = cartItem.quantity || quantity;
        const productWithSlug = ensureProductSlug(cartItem.product);
        
        // Verifica della disponibilità in magazzino
        if (productWithSlug.manage_stock && typeof productWithSlug.stock_quantity === 'number') {
          // Cerca se il prodotto esiste già nel carrello
          const existingIndex = newCart.findIndex(i => 
            i.product.id === productWithSlug.id && 
            i.variation_id === cartItem.variation_id
          );
          
          const currentQuantity = existingIndex >= 0 ? newCart[existingIndex].quantity : 0;
          const newTotalQuantity = currentQuantity + actualQuantity;
          
          // Controlla se la quantità totale supera quella disponibile
          if (newTotalQuantity > productWithSlug.stock_quantity) {
            return {
              success: false,
              message: `Disponibilità insufficiente. Massimo disponibile: ${productWithSlug.stock_quantity} pezzi. Nel carrello: ${currentQuantity}`
            };
          }
        }
        
        // Cerca se il prodotto esiste già nel carrello
        const existingIndex = newCart.findIndex(i => 
          i.product.id === productWithSlug.id && 
          i.variation_id === cartItem.variation_id
        );
        
        if (existingIndex >= 0) {
          // Aggiorna la quantità del prodotto esistente
          newCart[existingIndex].quantity += actualQuantity;
        } else {
          // Aggiungi il nuovo prodotto al carrello
          newCart.push({
            product: productWithSlug,
            quantity: actualQuantity,
            variation_id: cartItem.variation_id,
            attributes: cartItem.attributes
          });
        }
      } 
      // Gestisci il caso in cui l'item è un Product
      else {
        const product = ensureProductSlug(item as Product);
        
        // Verifica della disponibilità in magazzino
        if (product.manage_stock && typeof product.stock_quantity === 'number') {
          // Cerca se il prodotto esiste già nel carrello
          const existingIndex = newCart.findIndex(i => 
            i.product.id === product.id && !i.variation_id
          );
          
          const currentQuantity = existingIndex >= 0 ? newCart[existingIndex].quantity : 0;
          const newTotalQuantity = currentQuantity + quantity;
          
          // Controlla se la quantità totale supera quella disponibile
          if (newTotalQuantity > product.stock_quantity) {
            return {
              success: false,
              message: `Disponibilità insufficiente. Massimo disponibile: ${product.stock_quantity} pezzi. Nel carrello: ${currentQuantity}`
            };
          }
        }
        
        // Cerca se il prodotto esiste già nel carrello
        const existingIndex = newCart.findIndex(i => 
          i.product.id === product.id && !i.variation_id
        );
        
        if (existingIndex >= 0) {
          // Aggiorna la quantità del prodotto esistente
          newCart[existingIndex].quantity += quantity;
        } else {
          // Aggiungi il nuovo prodotto al carrello
          newCart.push({
            product,
            quantity
          });
        }
      }
      
      // Aggiorna lo stato del carrello
      setCart(newCart);
      return { success: true };
    } catch (error) {
      console.error('Errore durante l\'aggiunta al carrello:', error);
      return { success: false, message: 'Si è verificato un errore durante l\'aggiunta al carrello' };
    }
  };

  // Remove a product from the cart
  const removeFromCart = (productId: number, variationId?: number) => {
    setCart(prevCart => prevCart.filter(item => {
      if (variationId) {
        // Se è specificato un ID variazione, rimuovi solo l'item con quell'ID variazione
        return !(item.product.id === productId && item.variation_id === variationId);
      } else {
        // Altrimenti rimuovi tutti gli item con quell'ID prodotto
        return item.product.id !== productId;
      }
    }));
  };

  // Update the quantity of a product in the cart
  const updateQuantity = (productId: number, quantity: number, variationId?: number) => {
    if (quantity <= 0) {
      removeFromCart(productId, variationId);
      return;
    }

    setCart(prevCart => 
      prevCart.map(item => {
        // Verifica se questo è l'elemento da aggiornare
        const isTargetItem = variationId
          ? (item.product.id === productId && item.variation_id === variationId)
          : (item.product.id === productId);
        
        if (!isTargetItem) {
          return item; // Non è l'elemento da aggiornare, lascialo invariato
        }
        
        // Controlla se il prodotto gestisce lo stock e ha una quantità massima
        if (item.product.manage_stock && typeof item.product.stock_quantity === 'number') {
          // Limita la quantità al massimo disponibile
          const maxQuantity = item.product.stock_quantity;
          const newQuantity = Math.min(quantity, maxQuantity);
          
          // Se la quantità richiesta supera quella disponibile, mostra un messaggio
          if (quantity > maxQuantity) {
            setStockMessage(`Disponibilità massima per "${item.product.name}": ${maxQuantity} ${maxQuantity === 1 ? 'pezzo' : 'pezzi'}`);
            
            // Nascondi il messaggio dopo 5 secondi
            setTimeout(() => {
              setStockMessage(null);
            }, 5000);
          }
          
          return { ...item, quantity: newQuantity };
        }
        
        // Se non gestisce lo stock, permetti qualsiasi quantità
        return { ...item, quantity };
      })
    );
  };

  // Clear the entire cart and remove any coupon and points
  const clearCart = () => {
    setCart([]);
    removeCoupon();
    removePointsDiscount();
    // Rimuovi anche i punti dal localStorage
    localStorage.removeItem('pointsToRedeem');
    localStorage.removeItem('pointsDiscount');
    localStorage.removeItem('checkout_points_to_redeem');
    localStorage.removeItem('checkout_points_discount');
  };
  
  // Apply a coupon code to the cart
  const applyCouponCode = async () => {
    if (!couponCode.trim()) {
      setCouponError('Inserisci un codice coupon');
      return;
    }
    
    setIsApplyingCoupon(true);
    setCouponError(null);
    
    try {
      // Verifica il coupon prima di applicarlo
      await verifyCoupon(couponCode.trim());
      
      // Applica il coupon al carrello
      // Converti il formato del carrello per essere compatibile con l'API
      const apiCartItems = cart.map(item => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price || item.product.regular_price,
        regular_price: item.product.regular_price,
        sale_price: item.product.sale_price,
        quantity: item.quantity,
        variation_id: item.variation_id,
        attributes: item.attributes,
        image: item.product.images && item.product.images.length > 0 ? {
          src: item.product.images[0].src,
          alt: item.product.images[0].alt || ''
        } : undefined
      }));
      
      const result = await applyCoupon(couponCode.trim(), apiCartItems);
      
      setCoupon(result.coupon);
      setDiscount(result.discount);
      setIsApplyingCoupon(false);
    } catch (error: unknown) {
      console.error('Errore nell\'applicazione del coupon:', error);
      setCouponError(
        error instanceof Error ? error.message : 'Errore nell\'applicazione del coupon'
      );
      setIsApplyingCoupon(false);
    }
  };
  
  // Remove the applied coupon
  const removeCoupon = () => {
    setCoupon(null);
    setCouponCode('');
    setDiscount(0);
    setCouponError(null);
  };
  
  // Ricalcola lo sconto del coupon in base al contenuto attuale del carrello
  const recalculateCouponDiscount = async () => {
    if (!coupon) return;
    
    try {
      // Converti il formato del carrello per essere compatibile con l'API
      const apiCartItems = cart.map(item => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price || item.product.regular_price,
        regular_price: item.product.regular_price,
        sale_price: item.product.sale_price,
        quantity: item.quantity,
        variation_id: item.variation_id,
        attributes: item.attributes,
        image: item.product.images && item.product.images.length > 0 ? {
          src: item.product.images[0].src,
          alt: item.product.images[0].alt || ''
        } : undefined
      }));
      
      // Riapplica il coupon con il carrello aggiornato
      const result = await applyCoupon(coupon.code, apiCartItems);
      
      // Aggiorna lo sconto
      setDiscount(result.discount);
    } catch (error) {
      console.error('Errore nel ricalcolo dello sconto:', error);
      // Se c'è un errore nel ricalcolo, rimuovi il coupon
      removeCoupon();
    }
  };

  // Calculate the total price of all items in the cart
  const getCartTotal = () => {
    const subtotal = cart.reduce((total, item) => {
      const price = parseFloat(item.product.price || item.product.regular_price || '0');
      return total + (price * item.quantity);
    }, 0);
    
    // Applica lo sconto del coupon e dei punti
    return Math.max(0, subtotal - discount - pointsDiscount);
  };
  
  // Calculate subtotal is now handled directly in getCartTotal

  // Get the total number of items in the cart
  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  /**
   * Carica i punti dell'utente
   */
  const loadUserPoints = async (userId: number, token: string) => {
    setIsLoadingPoints(true);
    setPointsError(null);
    
    try {
      const pointsData = await getUserPoints(userId, token);
      setUserPoints(pointsData.points);
      setPointsLabel(pointsData.pointsLabel);
      
      // Se i punti da riscattare sono maggiori dei punti disponibili, resetta
      if (pointsToRedeem > pointsData.points) {
        setPointsToRedeem(0);
        setPointsDiscount(0);
      }
      
      setIsLoadingPoints(false);
    } catch (error) {
      console.error('Errore nel caricamento dei punti:', error);
      setPointsError('Impossibile caricare i punti');
      setIsLoadingPoints(false);
    }
  };
  
  /**
   * Applica lo sconto dei punti
   * Ogni punto vale 0.01€ di sconto (100 punti = 1€)
   */
  const applyPointsDiscount = () => {
    if (pointsToRedeem <= 0 || pointsToRedeem > userPoints) {
      return;
    }
    
    // Calcola lo sconto (100 punti = 1€)
    const pointValue = 0.01; // Valore di un punto in euro
    const rawDiscount = pointsToRedeem * pointValue;
    const calculatedDiscount = Math.min(rawDiscount, getCartTotal());
    setPointsDiscount(parseFloat(calculatedDiscount.toFixed(2))); // Arrotonda a 2 decimali
  };
  
  /**
   * Rimuove lo sconto dei punti
   */
  const removePointsDiscount = () => {
    setPointsToRedeem(0);
    setPointsDiscount(0);
  };
  
  // Quando cambiano i punti da riscattare, aggiorna lo sconto
  useEffect(() => {
    applyPointsDiscount();
  }, [pointsToRedeem, cart]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartTotal,
      getCartCount,
      coupon,
      couponCode,
      setCouponCode,
      applyCouponCode,
      removeCoupon,
      discount,
      couponError,
      isApplyingCoupon,
      stockMessage,
      setStockMessage,
      // Proprietà per i punti
      userPoints,
      pointsLabel,
      pointsToRedeem,
      setPointsToRedeem,
      pointsDiscount,
      loadUserPoints,
      applyPointsDiscount,
      removePointsDiscount,
      isLoadingPoints,
      pointsError
    }}>
      {children}
    </CartContext.Provider>
  );
}

// Custom hook to use the cart context
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
