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
  deposit_is_percent?: boolean;  // Nuovo campo: indica se l'acconto è una percentuale
  deposit_display?: string;     // Nuovo campo: valore formattato per la visualizzazione (es: "25%")
  formatted_deposit_value: string;
  second_payment: number;
  formatted_second_payment: string;
  message?: string; // Messaggio di errore o informativo dall'API
  is_pianoprova?: boolean;  // Nuovo campo: indica se stiamo usando il piano pianoprova
  payment_plan?: {
    id: number | string;  // Può essere un ID numerico o una stringa come "810" o "pianoprova"
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
      value?: number | string;  // Può essere un valore percentuale numerico o una stringa
      is_percent?: boolean;    // Nuovo campo: indica se il valore è una percentuale
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
  payment_plan_id?: string; // ID del piano di pagamento applicato al checkout
}

/**
 * Recupera tutti gli ordini pianificati dell'utente
 * @param page Opzionale: pagina specifica da richiedere (per il caricamento di pagine aggiuntive)
 */
export const getScheduledOrders = async (page?: number): Promise<ScheduledOrder[]> => {
  const token = getWooCommerceToken();
  
  if (!token) {
    throw new Error('Token non disponibile');
  }
  
  // Aggiungi un timestamp per evitare problemi di cache
  const timestamp = new Date().getTime();
  // Includi il parametro page solo se fornito
  const pageParam = page ? `page=${page}&` : '';
  const apiUrl = `/api/scheduled-orders?${pageParam}_=${timestamp}`;
  
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
 * @returns Opzioni di acconto per il prodotto o null se non disponibili
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
    
    // Log per debug (solo in sviluppo)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Risposta API deposit-options per prodotto ${productId}:`, data);
    }
    
    // Verifica se la risposta è successful ma deposit_enabled è false
    // Questa è la nuova risposta formato per prodotti che non supportano acconti
    if (data.success && data.deposit_enabled === false) {
      // Non lanciare un errore, ma restituire l'oggetto così com'è
      // Sarà gestito dal componente ProductDepositOptions
      console.log(`Prodotto ${productId} non supporta acconti`);
      return data as ProductDepositOptions;
    }
    
    // Verifica se la risposta è stata un fallimento
    if (!data.success) {
      console.error(`Risposta API fallita per prodotto ${productId}:`, data);
      throw new Error(data.message || 'Opzioni di acconto non disponibili');
    }
    
    // Log dei dati principali (solo in sviluppo)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Dettagli deposito per prodotto ${productId}:`, { 
        deposit_enabled: data.deposit_enabled, 
        deposit_type: data.deposit_type,
        payment_plan: data.payment_plan ? 'presente' : 'assente'
      });
    }
    
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
 * 
 * @param enableDeposit - Se abilitare l'acconto ('yes' o 'no')
 * @param depositAmount - L'importo dell'acconto (valore numerico o percentuale)
 * @param depositType - Il tipo di acconto ('fixed' o 'percent')
 * @param paymentPlanId - L'ID del piano di pagamento (opzionale)
 */
export const getDepositMetadata = (
  enableDeposit: 'yes' | 'no' = 'yes', 
  depositAmount: string = '40', 
  depositType: string = 'percent',
  paymentPlanId?: string
) => {
  if (enableDeposit !== 'yes') return {};
  
  // Preparazione dei metadati base per l'acconto
  const metadata = [
    { key: '_wc_convert_to_deposit', value: 'yes' },
    { key: '_wc_deposit_type', value: depositType },
    { key: '_wc_deposit_amount', value: depositAmount }
  ];
  
  // Aggiungiamo l'ID del piano di pagamento se specificato
  if (paymentPlanId) {
    metadata.push({ key: '_deposit_payment_plan', value: paymentPlanId });
    console.log(`Aggiunto piano di pagamento ID: ${paymentPlanId} ai metadati`);
  }
  
  // Restituiamo i metadati per l'acconto
  return {
    meta_data: metadata,
    wc_deposit_option: 'yes'
  };
};

/**
 * Estrae le informazioni dell'acconto dai metadati di un prodotto
 * @param product - Il prodotto da cui estrarre le informazioni
 * @returns Un oggetto con le informazioni sull'acconto
 */
// Define a ProductWithDeposit type for proper typing
export interface ProductWithDeposit {
  _wc_convert_to_deposit?: string;
  _wc_deposit_type?: string;
  _wc_deposit_amount?: string;
  _deposit_payment_plan?: string;
  meta_data?: Array<{
    key: string;
    value: string | number;
  }>;
  [key: string]: string | number | boolean | Array<{key: string; value: string | number}> | undefined; // For other potential properties
}

export function getDepositInfo(product: ProductWithDeposit) {
  let hasDeposit = false;
  let depositAmount = 40; // Valore predefinito
  let depositType = 'percent';
  let paymentPlanId = ''; // Nuovo campo per l'ID del piano di pagamento
  
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
    
    // Estrai l'ID del piano di pagamento dalle proprietà dirette
    if (product._deposit_payment_plan) {
      paymentPlanId = product._deposit_payment_plan;
      console.log('ID piano pagamento trovato nelle proprietà dirette:', paymentPlanId);
    }
    
    console.log('Trovato acconto dalle proprietà dirette:', { depositType, depositAmount, paymentPlanId });
  }
  // Fallback ai meta_data solo se non abbiamo trovato informazioni nelle proprietà dirette
  else if (product.meta_data && Array.isArray(product.meta_data)) {
    console.log('Meta_data disponibili:', product.meta_data);
    
    // Cerca _wc_convert_to_deposit
    const convertToDeposit = product.meta_data.find((meta: {key: string; value: string | number}) => meta.key === '_wc_convert_to_deposit');
    console.log('_wc_convert_to_deposit trovato:', convertToDeposit);
    
    if (convertToDeposit && String(convertToDeposit.value) === 'yes') {
      hasDeposit = true;
      
      // Cerca il tipo di acconto
      const depositTypeObj = product.meta_data.find((meta: {key: string; value: string | number}) => meta.key === '_wc_deposit_type');
      console.log('_wc_deposit_type trovato:', depositTypeObj);
      if (depositTypeObj && depositTypeObj.value) {
        depositType = String(depositTypeObj.value);
      }
      
      // Cerca l'importo dell'acconto
      const depositAmountObj = product.meta_data.find((meta: {key: string; value: string | number}) => meta.key === '_wc_deposit_amount');
      console.log('_wc_deposit_amount trovato:', depositAmountObj);
      if (depositAmountObj && depositAmountObj.value) {
        const parsedAmount = parseInt(String(depositAmountObj.value), 10);
        depositAmount = !isNaN(parsedAmount) ? parsedAmount : 40; // Default a 40 se NaN
        console.log('Importo acconto convertito in numero:', depositAmount);
      }
      
      // Cerca l'ID del piano di pagamento nei metadati
      const planIdObj = product.meta_data.find((meta: {key: string; value: string | number}) => meta.key === '_deposit_payment_plan');
      if (planIdObj && planIdObj.value) {
        paymentPlanId = String(planIdObj.value);
        console.log('ID piano pagamento trovato nei metadati:', paymentPlanId);
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
    depositLabel,
    paymentPlanId
  });
  
  return {
    hasDeposit,
    depositAmount,
    depositType,
    depositPercentage,
    depositLabel,
    paymentPlanId  // Aggiungiamo l'ID del piano di pagamento al risultato
  };
}

/**
 * Versione semplificata che non richiede round trip al server
 */
export const addToCartWithDeposit = async (
  productId: number, 
  enableDeposit: 'yes' | 'no' = 'yes'
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
 * @param paymentPlanId - ID del piano di pagamento da utilizzare per il checkout
 * @returns URL di checkout
 */
export const getDepositCheckoutUrl = async (paymentPlanId?: string): Promise<string> => {
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
  
  // Log dettagliati per debug dell'ID piano di pagamento
  console.log('============= FRONTEND CHECKOUT DEBUG =============');
  console.log('getDepositCheckoutUrl chiamata con paymentPlanId:', paymentPlanId);
  console.log('Tipo di paymentPlanId:', typeof paymentPlanId);
  console.log('paymentPlanId è definito?', paymentPlanId !== undefined ? 'SÌ' : 'NO');
  console.log('paymentPlanId è vuoto?', !paymentPlanId ? 'SÌ' : 'NO');
  console.log('Valore effettivo che verrà inviato:', paymentPlanId || 'UNDEFINED/NULL');
  console.log('================================================');
  
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        paymentPlanId // Inviamo l'ID del piano di pagamento al backend
      })
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
    
    console.log('Checkout URL ricevuto con piano di pagamento:', data.payment_plan_id);
    
    return data.checkout_url;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    console.error('Errore durante il recupero dell\'URL di checkout:', errorMessage);
    throw new Error(`Errore durante il recupero dell'URL di checkout: ${errorMessage}`);
  }
};

/**
 * Interfaccia per i dettagli del piano di pagamento
 */
export interface PaymentPlanDetails {
  id: string;
  name: string;
  description: string;
  initial_deposit: number;
  initial_deposit_percent: number;
  schedule: {
    index: number;
    amount: string;
    percentage: number;
    value: number;
    is_percent: boolean;
    formatted_amount: string;
    interval_amount: string;
    interval_unit: string;
    label: string;
  }[];
}

/**
 * Recupera i dettagli completi di un piano di pagamento dal backend
 * @param planId - ID del piano di pagamento da recuperare
 * @param productId - ID opzionale del prodotto per ottenere dettagli specifici per il prodotto
 * @returns Dettagli completi del piano di pagamento
 */
export const getPaymentPlanDetails = async (planId: string, productId?: number): Promise<PaymentPlanDetails | null> => {
  if (!planId) {
    console.warn('ID piano non specificato, impossibile recuperare i dettagli');
    return null;
  }
  
  try {
    // Se abbiamo un productId, usiamo l'endpoint deposit-options che restituisce già tutti i dettagli del piano
    if (productId) {
      const depositOptionsUrl = `/api/products/${productId}/deposit-options`;
      console.log(`Recupero dettagli piano ${planId} per prodotto ${productId}...`);
      
      const response = await fetch(depositOptionsUrl);
      
      if (!response.ok) {
        throw new Error(`Errore nel recupero delle opzioni di acconto: ${response.status}`);
      }
      
      const options: ProductDepositOptions = await response.json();
      console.log('Opzioni di acconto ricevute dal backend:', options);
      
      // Verifica che ci sia un piano di pagamento
      if (!options.payment_plan) {
        console.warn('Nessun piano di pagamento nelle opzioni');
        return null;
      }
      
      // Converte la risposta nel formato PaymentPlanDetails
      // Assicuriamoci che tutti i campi dello schedule siano presenti e del tipo corretto
      const transformedSchedule = (options.payment_plan.schedule || []).map(item => ({
        index: item.index || 0,
        amount: item.amount || '0',
        percentage: item.percentage || 0,
        value: typeof item.value === 'number' ? item.value : 0,
        is_percent: item.is_percent || false,
        formatted_amount: item.formatted_amount || '',
        interval_amount: item.interval_amount || '1',
        interval_unit: item.interval_unit || 'month',
        label: item.label || `Rata ${item.index + 1}`
      }));
      
      return {
        id: options.payment_plan.id.toString(),
        name: options.payment_plan.name,
        description: options.payment_plan.description || '',
        initial_deposit: options.deposit_amount,
        initial_deposit_percent: options.deposit_is_percent ? options.deposit_amount : 0,
        schedule: transformedSchedule
      };
    }
    
    // Altrimenti, potremmo implementare un endpoint specifico per recuperare i dettagli del piano
    // ma per ora restituiamo null
    console.warn('Recupero dettagli piano senza productId non ancora implementato');
    return null;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    console.error(`Errore durante il recupero dei dettagli del piano ${planId}:`, errorMessage);
    return null;
  }
};
