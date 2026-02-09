"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Product, Coupon, verifyCoupon, applyCoupon } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getUserPoints } from '@/lib/points';
import { getDepositInfo, ProductWithDeposit } from '@/lib/deposits';
import {
  checkAutoGifts,
  giftProductToProduct,
  isAutoGift,
  GiftProduct,
  saveAutoGiftsToStorage,
  clearAutoGiftsStorage,
} from '@/lib/autoGifts';

// Re-export GiftProduct per utilizzo nei componenti
export type { GiftProduct };

export interface CartItem {
  product: Product;
  quantity: number;
  variation_id?: number;
  attributes?: Array<{
    id: number;
    name: string;
    option: string;
  }>;
  meta_data?: Array<{
    key: string;
    value: string;
  }>;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem | Product, quantity?: number) => { success: boolean; message?: string };
  removeFromCart: (productId: number, variationId?: number) => void;
  updateQuantity: (productId: number, quantity: number, variationId?: number) => void;
  updatePrice: (productId: number, newPrice: number, variationId?: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
  getSubtotal: () => number;
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
  // Nuove proprietà per i regali automatici
  autoGifts: GiftProduct[];
  isCheckingGifts: boolean;
  removeAutoGift: (productId: number) => void;
  restoreAutoGift: (productId: number) => void;
  removedGiftIds: number[];
  isAutoGiftItem: (item: CartItem) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
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

  // Stati per i regali automatici
  const [autoGifts, setAutoGifts] = useState<GiftProduct[]>([]);
  const [isCheckingGifts, setIsCheckingGifts] = useState<boolean>(false);
  const [removedGiftIds, setRemovedGiftIds] = useState<number[]>([]);
  const checkGiftsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const couponRecalcTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRecalculatingCouponRef = useRef<boolean>(false);
  const lastCartSignatureRef = useRef<string>('');
  const couponRef = useRef<Coupon | null>(null);
  const removedGiftIdsRef = useRef<number[]>([]);

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
      const savedRemovedGiftIds = localStorage.getItem('removedGiftIds');

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
        const parsedCoupon = JSON.parse(savedCoupon);
        couponRef.current = parsedCoupon;
        setCoupon(parsedCoupon);
        setCouponCode(parsedCoupon.code || '');
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

      // Carica la lista dei regali rimossi dall'utente
      if (savedRemovedGiftIds) {
        const parsed = JSON.parse(savedRemovedGiftIds);
        setRemovedGiftIds(parsed);
        removedGiftIdsRef.current = parsed;
      }
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ricalcola lo sconto quando il carrello cambia realmente e c'è un coupon attivo
  useEffect(() => {
    if (!couponRef.current || cart.length === 0) return;

    // Genera una firma del carrello basata su id, quantità e prezzi
    const cartSignature = cart
      .map(item => `${item.product.id}:${item.quantity}:${item.product.price}`)
      .sort()
      .join('|');

    // Se il carrello non è cambiato realmente, non ricalcolare
    if (cartSignature === lastCartSignatureRef.current) return;
    lastCartSignatureRef.current = cartSignature;

    if (couponRecalcTimeoutRef.current) {
      clearTimeout(couponRecalcTimeoutRef.current);
    }

    couponRecalcTimeoutRef.current = setTimeout(() => {
      if (!isRecalculatingCouponRef.current) {
        recalculateCouponDiscount();
      }
    }, 800);

    return () => {
      if (couponRecalcTimeoutRef.current) {
        clearTimeout(couponRecalcTimeoutRef.current);
      }
    };
  }, [cart]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save cart, coupon, points and removed gifts to localStorage whenever they change
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

      // Salva la lista dei regali rimossi dall'utente
      if (removedGiftIds.length > 0) {
        localStorage.setItem('removedGiftIds', JSON.stringify(removedGiftIds));
      } else {
        localStorage.removeItem('removedGiftIds');
      }
    } catch (error) {
      console.error('Error saving data to localStorage:', error);
    }
  }, [cart, coupon, discount, pointsToRedeem, pointsDiscount, removedGiftIds]);

  /**
   * Verifica se un item del carrello è un regalo automatico
   */
  const isAutoGiftItem = useCallback((item: CartItem): boolean => {
    return isAutoGift(item);
  }, []);

  /**
   * Calcola il subtotale escludendo i regali automatici (per la verifica delle regole)
   */
  const getSubtotalWithoutGifts = useCallback((): number => {
    return cart.reduce((total, item) => {
      // Escludi i regali dal calcolo
      if (isAutoGiftItem(item)) {
        return total;
      }

      const depositInfo = getDepositInfo(item.product as unknown as ProductWithDeposit);
      const isDeposit = depositInfo.hasDeposit;

      let itemPrice = parseFloat(item.product.price || item.product.regular_price || '0');

      if (isDeposit) {
        let depositPercentage = depositInfo.depositPercentage;
        if (!depositPercentage || depositPercentage <= 0) {
          depositPercentage = 0.4;
        }
        itemPrice = itemPrice * depositPercentage;
      }

      return total + (itemPrice * item.quantity);
    }, 0);
  }, [cart, isAutoGiftItem]);

  /**
   * Controlla i regali automatici applicabili al carrello
   */
  const checkAutoGiftsForCart = useCallback(async () => {
    // Non controllare se il carrello è vuoto o contiene solo regali
    const regularItems = cart.filter(item => !isAutoGiftItem(item));
    if (regularItems.length === 0) {
      setAutoGifts([]);
      saveAutoGiftsToStorage([]);
      return;
    }

    setIsCheckingGifts(true);

    try {
      // Prepara gli item per l'API (escludi i regali)
      const cartItemsForApi = regularItems.map(item => ({
        product_id: item.product.id,
        id: item.product.id,
        quantity: item.quantity,
        name: item.product.name,
        categories: item.product.categories,
      }));

      // Calcola il totale escludendo i regali
      const cartTotal = getSubtotalWithoutGifts();

      // Chiama l'API per verificare i regali
      const response = await checkAutoGifts(cartItemsForApi, cartTotal);

      if (response.success && response.gifts.length > 0) {
        // Usa il ref per avere sempre il valore più recente dei regali rimossi
        const currentRemovedIds = removedGiftIdsRef.current;

        // Filtra i regali già rimossi dall'utente in questa sessione
        const filteredGifts = response.gifts.filter(
          gift => !currentRemovedIds.includes(gift.product_id)
        );

        setAutoGifts(filteredGifts);
        saveAutoGiftsToStorage(filteredGifts);

        // Aggiungi i regali al carrello se non sono già presenti
        filteredGifts.forEach(gift => {
          const existsInCart = cart.some(
            item => item.product.id === gift.product_id && isAutoGiftItem(item)
          );

          if (!existsInCart) {
            const giftProduct = giftProductToProduct(gift);
            setCart(prevCart => [
              ...prevCart,
              {
                product: giftProduct,
                quantity: gift.quantity,
                meta_data: giftProduct.meta_data?.map(m => ({
                  key: m.key,
                  value: String(m.value),
                })),
              },
            ]);
          }
        });
      } else {
        // Nessun regalo applicabile: rimuovi i regali esistenti dal carrello
        setAutoGifts([]);
        saveAutoGiftsToStorage([]);
        setCart(prevCart => prevCart.filter(item => !isAutoGiftItem(item)));
      }
    } catch (error) {
      console.error('Errore nel controllo dei regali automatici:', error);
    } finally {
      setIsCheckingGifts(false);
    }
  }, [cart, isAutoGiftItem, getSubtotalWithoutGifts]);

  /**
   * Effetto per controllare i regali quando il carrello cambia (con debounce)
   */
  useEffect(() => {
    // Pulisci il timeout precedente
    if (checkGiftsTimeoutRef.current) {
      clearTimeout(checkGiftsTimeoutRef.current);
    }

    // Esegui il controllo con un debounce di 500ms
    checkGiftsTimeoutRef.current = setTimeout(() => {
      checkAutoGiftsForCart();
    }, 500);

    return () => {
      if (checkGiftsTimeoutRef.current) {
        clearTimeout(checkGiftsTimeoutRef.current);
      }
    };
  }, [cart.filter(item => !isAutoGiftItem(item)).length, getSubtotalWithoutGifts]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Rimuove un regalo automatico dal carrello
   * L'utente può rimuovere liberamente i regali
   */
  const removeAutoGift = useCallback((productId: number) => {
    // Aggiorna prima il ref per avere subito il valore più recente
    removedGiftIdsRef.current = [...removedGiftIdsRef.current, productId];

    // Aggiungi l'ID alla lista dei rimossi per non riproporlo in questa sessione
    setRemovedGiftIds(prev => [...prev, productId]);

    // Rimuovi dal carrello
    setCart(prevCart =>
      prevCart.filter(item => !(item.product.id === productId && isAutoGiftItem(item)))
    );

    // Aggiorna i regali
    setAutoGifts(prev => prev.filter(gift => gift.product_id !== productId));
  }, [isAutoGiftItem]);

  /**
   * Ripristina un regalo automatico precedentemente rimosso
   * Rimuove l'ID dalla lista dei rimossi e forza un nuovo controllo dei regali
   */
  const restoreAutoGift = useCallback((productId: number) => {
    // Aggiorna prima il ref per avere subito il valore più recente
    removedGiftIdsRef.current = removedGiftIdsRef.current.filter(id => id !== productId);

    // Rimuovi l'ID dalla lista dei rimossi
    setRemovedGiftIds(prev => prev.filter(id => id !== productId));

    // Forza un nuovo controllo dei regali dopo un breve delay
    setTimeout(() => {
      checkAutoGiftsForCart();
    }, 100);
  }, [checkAutoGiftsForCart]);

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
            attributes: cartItem.attributes,
            meta_data: cartItem.meta_data
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
            quantity,
            meta_data: product.meta_data
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

        // Blocca la modifica della quantità per i regali automatici
        if (isAutoGift(item)) {
          return item; // Non permettere la modifica della quantità dei regali
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

  // Update the price of a product in the cart
  const updatePrice = (productId: number, newPrice: number, variationId?: number) => {
    setCart(prevCart =>
      prevCart.map(item => {
        // Verifica se questo è l'elemento da aggiornare
        const isTargetItem = variationId
          ? (item.product.id === productId && item.variation_id === variationId)
          : (item.product.id === productId);

        if (!isTargetItem) {
          return item;
        }

        // Aggiorna il prezzo del prodotto
        return {
          ...item,
          product: {
            ...item.product,
            price: newPrice.toFixed(2)
          }
        };
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
    // Pulisci anche i regali automatici e la lista dei rimossi
    setAutoGifts([]);
    setRemovedGiftIds([]);
    removedGiftIdsRef.current = [];
    clearAutoGiftsStorage();
    localStorage.removeItem('removedGiftIds');
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
        categories: item.product.categories || [],
        image: item.product.images && item.product.images.length > 0 ? {
          src: item.product.images[0].src,
          alt: item.product.images[0].alt || ''
        } : undefined
      }));

      const result = await applyCoupon(couponCode.trim(), apiCartItems, undefined, user?.email);

      couponRef.current = result.coupon;
      setCoupon(result.coupon);
      setDiscount(result.discount);
      // Aggiorna la firma del carrello per evitare un ricalcolo immediato
      lastCartSignatureRef.current = cart
        .map(item => `${item.product.id}:${item.quantity}:${item.product.price}`)
        .sort()
        .join('|');
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
    couponRef.current = null;
    setCoupon(null);
    setCouponCode('');
    setDiscount(0);
    setCouponError(null);
  };
  
  // Ricalcola lo sconto del coupon in base al contenuto attuale del carrello
  const recalculateCouponDiscount = async () => {
    if (!coupon || isRecalculatingCouponRef.current) return;
    isRecalculatingCouponRef.current = true;

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
        categories: item.product.categories || [],
        image: item.product.images && item.product.images.length > 0 ? {
          src: item.product.images[0].src,
          alt: item.product.images[0].alt || ''
        } : undefined
      }));

      // Riapplica il coupon con il carrello aggiornato
      const result = await applyCoupon(coupon.code, apiCartItems, undefined, user?.email);
      
      // Aggiorna lo sconto
      setDiscount(result.discount);
    } catch (error) {
      console.error('Errore nel ricalcolo dello sconto:', error);
      // Se c'è un errore nel ricalcolo, rimuovi il coupon
      removeCoupon();
    } finally {
      isRecalculatingCouponRef.current = false;
    }
  };

  // Calculate subtotal (base price without discounts)
  const getSubtotal = () => {
    return cart.reduce((total, item) => {
      // Controlla se il prodotto ha l'acconto attivato
      const depositInfo = getDepositInfo(item.product as unknown as ProductWithDeposit);
      const isDeposit = depositInfo.hasDeposit;
      
      let itemPrice = parseFloat(item.product.price || item.product.regular_price || '0');
      
      // Se il prodotto ha l'acconto, usa il prezzo dell'acconto
      if (isDeposit) {
        // Usa la percentuale di acconto dal depositInfo
        let depositPercentage = depositInfo.depositPercentage;
        
        // Se la percentuale non è valida, usa 40% come predefinito
        if (!depositPercentage || depositPercentage <= 0) {
          depositPercentage = 0.4; // 40%
        }
        
        itemPrice = itemPrice * depositPercentage;
      }
      
      return total + (itemPrice * item.quantity);
    }, 0);
  };

  // Calculate the total price of all items in the cart (with discounts)
  const getCartTotal = () => {
    const subtotal = getSubtotal();
    
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
      setPointsDiscount(0);
      return;
    }
    
    // Usa getSubtotal per evitare duplicazione di codice
    const subtotal = getSubtotal();
    
    // Calcola lo sconto (100 punti = 1€)
    const pointValue = 0.01; // Valore di un punto in euro
    const rawDiscount = pointsToRedeem * pointValue;
    // Limita lo sconto al subtotal meno discount del coupon
    const maxDiscount = Math.max(0, subtotal - discount);
    const calculatedDiscount = Math.min(rawDiscount, maxDiscount);
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
      updatePrice,
      clearCart,
      getCartTotal,
      getCartCount,
      getSubtotal,
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
      pointsError,
      // Proprietà per i regali automatici
      autoGifts,
      isCheckingGifts,
      removeAutoGift,
      restoreAutoGift,
      removedGiftIds,
      isAutoGiftItem,
    }}>
      {children}
    </CartContext.Provider>
  );
}

// Custom hook to use the cart context
// Oggetto mock per SSR e fallback
const mockCartContext: CartContextType = {
  cart: [],
  addToCart: () => ({ success: false, message: 'Cart not available' }),
  removeFromCart: () => {},
  updateQuantity: () => {},
  updatePrice: () => {},
  clearCart: () => {},
  getCartTotal: () => 0,
  getCartCount: () => 0,
  getSubtotal: () => 0,
  coupon: null,
  couponCode: '',
  setCouponCode: () => {},
  applyCouponCode: async () => {},
  removeCoupon: () => {},
  discount: 0,
  couponError: null,
  isApplyingCoupon: false,
  stockMessage: null,
  setStockMessage: () => {},
  userPoints: 0,
  pointsLabel: '',
  pointsToRedeem: 0,
  setPointsToRedeem: () => {},
  pointsDiscount: 0,
  loadUserPoints: async () => {},
  applyPointsDiscount: () => {},
  removePointsDiscount: () => {},
  isLoadingPoints: false,
  pointsError: null,
  // Mock per regali automatici
  autoGifts: [],
  isCheckingGifts: false,
  removeAutoGift: () => {},
  restoreAutoGift: () => {},
  removedGiftIds: [],
  isAutoGiftItem: () => false,
};

export function useCart() {
  // Sempre chiama useContext per rispettare le regole degli hooks
  const context = useContext(CartContext);

  // Durante SSR, ritorna sempre l'oggetto mock
  if (typeof window === 'undefined') {
    return mockCartContext;
  }

  // Se il context non è disponibile lato client, usa il mock
  if (context === undefined) {
    console.warn('useCart must be used within a CartProvider, using mock context');
    return mockCartContext;
  }

  return context;
}