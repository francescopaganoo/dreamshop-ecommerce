import { getWooCommerceToken } from '@/lib/auth';

// Interfaccia per gli ordini pianificati
export interface ScheduledOrder {
  id: number;
  parent_id: number;
  parent_order_number: string;
  date_created: string;
  status: string;
  status_name: string;
  total: string;
  formatted_total: string;
  payment_url: string;
  view_url: string;
}

// Interfaccia per le opzioni di acconto di un prodotto
export interface ProductDepositOptions {
  success: boolean;
  product_id: number;
  product_name: string;
  product_price: number;
  formatted_product_price: string;
  deposit_enabled: boolean;
  deposit_forced: boolean;
  deposit_type: string;
  deposit_amount: number;
  deposit_value: number;
  formatted_deposit_value: string;
  second_payment: number;
  formatted_second_payment: string;
  message?: string; // Messaggio di errore o informativo dall'API
  payment_plan?: {
    id: number;
    name: string;
    description: string;
    schedule?: {
      index: number;
      amount: string;
      formatted_amount?: string;
      percentage?: number;
      interval_amount: string;
      interval_unit: string;
      label?: string;
      value?: string;
    }[];
  };
}

// Interfaccia per il risultato dell'aggiunta al carrello
export interface AddToCartWithDepositResult {
  success: boolean;
  message: string;
  cart_item_key: string;
  cart_count: number;
  cart_total: string;
  checkout_url: string;
}

// Interfaccia per il risultato dell'URL di checkout
export interface DepositCheckoutResult {
  success: boolean;
  checkout_url: string;
}

/**
 * Recupera tutti gli ordini pianificati dell'utente
 */
export const getScheduledOrders = async (): Promise<ScheduledOrder[]> => {
  const token = getWooCommerceToken();
  
  if (!token) {
    throw new Error('Token non disponibile');
  }
  
  // Aggiungi un timestamp per evitare problemi di cache
  const timestamp = new Date().getTime();
  const apiUrl = `/api/scheduled-orders?_=${timestamp}`;
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Errore nel recupero degli ordini pianificati: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
};

/**
 * Recupera i dettagli di uno specifico ordine pianificato
 */
export const getScheduledOrder = async (orderId: number): Promise<ScheduledOrder | null> => {
  const token = getWooCommerceToken();
  
  if (!token) {
    throw new Error('Token non disponibile');
  }
  
  const apiUrl = `/api/scheduled-orders/${orderId}`;
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Errore nel recupero dei dettagli dell'ordine: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
};

/**
 * Avvia il processo di pagamento per un ordine pianificato
 * @param orderId ID dell'ordine pianificato da pagare
 * @returns URL di reindirizzamento per la pagina di checkout Stripe
 */
export const processScheduledOrderPayment = async (orderId: number): Promise<string> => {
  const token = getWooCommerceToken();
  
  if (!token) {
    throw new Error('Token non disponibile');
  }
  
  const apiUrl = `/api/scheduled-orders/${orderId}/pay`;
  console.log(`Avvio processo di pagamento per la rata #${orderId}`);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Errore nell'avvio del pagamento: ${response.status}`, errorText);
      throw new Error(`Errore nell'avvio del pagamento: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Risposta API pagamento rata:', data);
    
    if (!data.success || !data.redirect) {
      console.error('Risposta API pagamento non valida:', data);
      throw new Error('URL di pagamento non disponibile');
    }
    
    console.log('Reindirizzamento al checkout Stripe:', data.redirect);
    return data.redirect;
  } catch (error: unknown) {
    // Gestione sicura dell'errore con controllo di tipo
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    console.error('Errore durante il processo di pagamento:', errorMessage);
    throw new Error(`Errore durante il pagamento: ${errorMessage}`);
  }
};

/**
 * Ottiene le opzioni di acconto disponibili per un prodotto
 * @param productId ID del prodotto
 * @returns Opzioni di acconto per il prodotto
 */
export const getProductDepositOptions = async (productId: number): Promise<ProductDepositOptions> => {
  // Questo endpoint non richiede autenticazione
  const apiUrl = `/api/products/${productId}/deposit-options`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Errore nel recupero delle opzioni di acconto: ${response.status}`, errorText);
      throw new Error(`Errore nel recupero delle opzioni di acconto: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Log per debug
    console.log(`Risposta API deposit-options per prodotto ${productId}:`, data);
    
    if (!data.success) {
      console.error(`Risposta API fallita per prodotto ${productId}:`, data);
      throw new Error(data.message || 'Opzioni di acconto non disponibili');
    }
    
    // Log dei dati principali
    console.log(`Dettagli deposito per prodotto ${productId}:`, { 
      deposit_enabled: data.deposit_enabled, 
      deposit_type: data.deposit_type,
      payment_plan: data.payment_plan ? 'presente' : 'assente'
    });
    
    return data as ProductDepositOptions;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    console.error('Errore durante il recupero delle opzioni di acconto:', errorMessage);
    throw new Error(`Errore durante il recupero delle opzioni di acconto: ${errorMessage}`);
  }
};

/**
 * Aggiunge un prodotto al carrello con l'opzione di acconto
 * @param productId ID del prodotto
 * @param enableDeposit 'yes' per abilitare l'acconto, 'no' per pagamento completo
 * @param quantity Quantità del prodotto (default: 1)
 * @param variationId ID della variazione (se applicabile)
 * @returns Risultato dell'operazione di aggiunta al carrello
 */
/**
 * Questa funzione restituisce i metadati necessari per un prodotto con acconto.
 * Non aggiunge direttamente al carrello, ma fornisce i metadati che possono essere
 * aggiunti all'oggetto prodotto prima di passarlo a addToCart del CartContext.
 */
export const getDepositMetadata = (enableDeposit: 'yes' | 'no' = 'yes', depositAmount: string = '40', depositType: string = 'percent') => {
  if (enableDeposit !== 'yes') return {};
  
  // Restituiamo i metadati per l'acconto
  return {
    meta_data: [
      { key: '_wc_convert_to_deposit', value: 'yes' },
      { key: '_wc_deposit_type', value: depositType },
      { key: '_wc_deposit_amount', value: depositAmount }
    ],
    wc_deposit_option: 'yes'
  };
};

/**
 * Estrae le informazioni dell'acconto dai metadati di un prodotto
 * @param product - Il prodotto da cui estrarre le informazioni
 * @returns Un oggetto con le informazioni sull'acconto
 */
export function getDepositInfo(product: any) {
  let hasDeposit = false;
  let depositAmount = 40; // Valore predefinito
  let depositType = 'percent';
  
  console.log('Analisi prodotto per acconto:', product);
  
  // Privilegia le proprietà dirette del prodotto
  if (product._wc_convert_to_deposit === 'yes') {
    hasDeposit = true;
    depositType = product._wc_deposit_type || 'percent';
    
    // Assicurati che depositAmount sia un numero valido
    if (product._wc_deposit_amount) {
      const parsedAmount = parseInt(product._wc_deposit_amount, 10);
      depositAmount = !isNaN(parsedAmount) ? parsedAmount : 40;
    }
    
    console.log('Trovato acconto dalle proprietà dirette:', { depositType, depositAmount });
  }
  // Fallback ai meta_data solo se non abbiamo trovato informazioni nelle proprietà dirette
  else if (product.meta_data && Array.isArray(product.meta_data)) {
    console.log('Meta_data disponibili:', product.meta_data);
    
    // Cerca _wc_convert_to_deposit
    const convertToDeposit = product.meta_data.find((meta: any) => meta.key === '_wc_convert_to_deposit');
    console.log('_wc_convert_to_deposit trovato:', convertToDeposit);
    
    if (convertToDeposit?.value === 'yes') {
      hasDeposit = true;
      
      // Cerca il tipo di acconto
      const depositTypeObj = product.meta_data.find((meta: any) => meta.key === '_wc_deposit_type');
      console.log('_wc_deposit_type trovato:', depositTypeObj);
      if (depositTypeObj && depositTypeObj.value) {
        depositType = depositTypeObj.value;
      }
      
      // Cerca l'importo dell'acconto
      const depositAmountObj = product.meta_data.find((meta: any) => meta.key === '_wc_deposit_amount');
      console.log('_wc_deposit_amount trovato:', depositAmountObj);
      if (depositAmountObj && depositAmountObj.value) {
        const parsedAmount = parseInt(depositAmountObj.value, 10);
        depositAmount = !isNaN(parsedAmount) ? parsedAmount : 40; // Default a 40 se NaN
        console.log('Importo acconto convertito in numero:', depositAmount);
      }
    }
  } else {
    console.log('Nessun meta_data disponibile nel prodotto');
  }
  
  // Log delle proprietà dirette per debug
  console.log('Proprietà dirette del prodotto:', {
    _wc_convert_to_deposit: product._wc_convert_to_deposit,
    _wc_deposit_type: product._wc_deposit_type,
    _wc_deposit_amount: product._wc_deposit_amount
  });
  
  // Assicurati che depositAmount sia un numero valido
  if (isNaN(depositAmount)) {
    console.warn('depositAmount non valido, uso default 40');
    depositAmount = 40;
  }
  
  const depositPercentage = depositType === 'percent' ? depositAmount / 100 : 0;
  const depositLabel = depositType === 'percent' ? `Acconto (${depositAmount}%)` : `Acconto (${depositAmount}€)`;
  
  console.log('Risultato finale getDepositInfo:', {
    hasDeposit,
    depositAmount,
    depositType,
    depositPercentage,
    depositLabel
  });
  
  return {
    hasDeposit,
    depositAmount,
    depositType,
    depositPercentage,
    depositLabel
  };
}

/**
 * Versione semplificata che non richiede round trip al server
 */
export const addToCartWithDeposit = async (
  productId: number, 
  enableDeposit: 'yes' | 'no' = 'yes', 
  quantity: number = 1, 
  variationId?: number
): Promise<AddToCartWithDepositResult> => {
  try {
    // Questo oggetto verrà restituito per compatibilità con il codice esistente
    const successResult: AddToCartWithDepositResult = {
      success: true,
      message: enableDeposit === 'yes' ? 'Prodotto con acconto aggiunto al carrello' : 'Prodotto aggiunto al carrello',
      cart_count: 0, // Il conteggio verrà aggiornato dal CartContext
      cart_total: '0', // Il totale verrà calcolato dal CartContext
      checkout_url: '/checkout',
      cart_item_key: `${productId}-${Date.now()}` // Generiamo una chiave unica
    };
    
    return successResult;

  } catch (error) {
    console.log(`Errore durante l'aggiunta al carrello: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Errore durante l'aggiunta al carrello: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Ottiene l'URL di checkout per procedere al pagamento dell'acconto
 * @returns URL di checkout
 */
export const getDepositCheckoutUrl = async (): Promise<string> => {
  // Recupera il token se disponibile, ma non è obbligatorio
  const token = getWooCommerceToken();
  
  const apiUrl = `/api/cart/deposit-checkout`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  // Aggiungi il token di autorizzazione solo se disponibile
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Errore nel recupero dell'URL di checkout: ${response.status}`, errorText);
      throw new Error(`Errore nel recupero dell'URL di checkout: ${response.status}`);
    }
    
    const data = await response.json() as DepositCheckoutResult;
    
    if (!data.success || !data.checkout_url) {
      throw new Error('URL di checkout non disponibile');
    }
    
    return data.checkout_url;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    console.error('Errore durante il recupero dell\'URL di checkout:', errorMessage);
    throw new Error(`Errore durante il recupero dell'URL di checkout: ${errorMessage}`);
  }
};
