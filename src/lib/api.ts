import api from './woocommerce';

// Types
export interface ProductAttribute {
  id: number;
  name: string;
  position: number;
  visible: boolean;
  variation: boolean;
  options: string[];
}

export interface ProductVariation {
  id: number;
  price: string;
  regular_price: string;
  sale_price: string;
  attributes: Array<{
    id: number;
    name: string;
    option: string;
  }>;
  stock_status: string;
  stock_quantity?: number; // Quantità disponibile in magazzino
  manage_stock?: boolean; // Indica se il prodotto gestisce lo stock
  image?: {
    id: number;
    src: string;
    alt: string;
  };
}

export interface MetaData {
  key: string;
  value: string;
}

export interface Product {
  id: number;
  name: string;
  price: string;
  regular_price: string;
  sale_price: string;
  description: string;
  short_description: string;
  images: Array<{
    id: number;
    src: string;
    alt: string;
  }>;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  meta_data?: MetaData[];
  // Proprietà aggiuntive per acconti
  wc_deposit_option?: string;
  _wc_convert_to_deposit?: string;
  _wc_deposit_type?: string;
  _wc_deposit_amount?: string;
  stock_status: string;
  stock_quantity?: number; // Quantità disponibile in magazzino
  manage_stock?: boolean; // Indica se il prodotto gestisce lo stock
  permalink: string;
  slug: string;
  type: string; // 'simple', 'variable', etc.
  attributes?: ProductAttribute[];
  variations?: number[];
  default_attributes?: Array<{
    id: number;
    name: string;
    option: string;
  }>;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  count: number;
  image?: {
    id: number;
    src: string;
    alt: string;
  };
}

export interface Coupon {
  id: number;
  code: string;
  amount: string;
  discount_type: 'percent' | 'fixed_cart' | 'fixed_product';
  description: string;
  date_expires?: string;
  date_expires_gmt?: string;
  usage_count: number;
  individual_use: boolean;
  product_ids: number[];
  excluded_product_ids: number[];
  usage_limit?: number;
  usage_limit_per_user?: number;
  limit_usage_to_x_items?: number;
  free_shipping: boolean;
  product_categories: number[];
  excluded_product_categories: number[];
  exclude_sale_items: boolean;
  minimum_amount: string;
  maximum_amount: string;
  email_restrictions: string[];
  used_by: string[];
}

export interface ShippingZone {
  id: number;
  name: string;
  order: number;
  locations?: ShippingLocation[];
}

export interface ShippingLocation {
  code: string;
  type: string; // 'country', 'state', 'postcode', etc.
}

export interface ShippingMethod {
  id: string;
  title: string;
  description: string;
  cost: number;
  min_amount?: number;
  free_shipping?: boolean;
}

// Fetch all products
export async function getProducts(page = 1, per_page = 10): Promise<Product[]> {
  try {
    // Utilizziamo un timestamp per generare una chiave di cache
    const cacheKey = `products_${page}_${per_page}_${Math.floor(Date.now() / (1000 * 300))}`;
    
    // Verifichiamo se abbiamo i dati in cache (solo lato client)
    if (typeof window !== 'undefined') {
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData) as Product[];
      }
    }
    
    // Se non abbiamo dati in cache, facciamo la chiamata API
    const { data } = await api.get('products', {
      per_page,
      page,
      status: 'publish', // Include solo i prodotti pubblicati, esclude le bozze
    });
    
    // Salviamo i dati in cache (solo lato client)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    }
    
    return data as Product[];
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

// Fetch a single product by ID
export async function getProduct(id: number): Promise<Product | null> {
  try {
    const { data } = await api.get(`products/${id}`);
    return data as Product;
  } catch (error) {
    console.error(`Error fetching product with ID ${id}:`, error);
    return null;
  }
}

// Fetch a single product by slug
export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    // Utilizziamo un timestamp per generare una chiave di cache
    const cacheKey = `product_${slug}_${Math.floor(Date.now() / (1000 * 300))}`;
    
    // Verifichiamo se abbiamo i dati in cache (solo lato client)
    if (typeof window !== 'undefined') {
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData) as Product;
      }
    }
    
    // L'API WooCommerce non supporta direttamente la ricerca per slug nell'endpoint products/{slug}
    // Quindi dobbiamo usare il parametro slug nell'endpoint products
    const { data } = await api.get('products', {
      slug: slug,
      status: 'publish',
    });
    
    // L'API restituisce un array, ma poiché lo slug è unico, dovremmo ottenere solo un prodotto
    if (Array.isArray(data) && data.length > 0) {
      const product = data[0] as Product;
      
      // Salviamo i dati in cache (solo lato client)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(cacheKey, JSON.stringify(product));
      }
      
      return product;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching product with slug ${slug}:`, error);
    return null;
  }
}

// Cache per le variazioni dei prodotti
const variationsCache: Record<number, { data: ProductVariation[], timestamp: number }> = {};

// Durata della cache in millisecondi (5 minuti)
const CACHE_DURATION = 5 * 60 * 1000;

// Fetch product variations
export async function getProductVariations(productId: number): Promise<ProductVariation[]> {
  try {
    // Verifica se abbiamo i dati in cache e se sono ancora validi
    const now = Date.now();
    const cachedData = variationsCache[productId];
    
    if (cachedData && (now - cachedData.timestamp < CACHE_DURATION)) {
      // Log più dettagliato per il debug
      const timeLeft = Math.round((CACHE_DURATION - (now - cachedData.timestamp)) / 1000);
      console.log(`✅ CACHE HIT: Using cached variations for product ${productId} (${cachedData.data.length} variations) - Cache expires in ${timeLeft}s`);
      return cachedData.data;
    }
    
    // Se non abbiamo dati in cache o sono scaduti, facciamo la chiamata API
    console.log(`⚠️ CACHE MISS: Fetching variations for product ${productId} from API`);
    
    // Aggiungiamo un parametro timestamp per evitare la cache su iOS
    const timestamp = new Date().getTime();
    
    const { data } = await api.get(`products/${productId}/variations`, {
      per_page: 100, // Recupera fino a 100 variazioni
      _: timestamp, // Parametro per evitare la cache
    });
    
    console.log(`📦 API RESPONSE: Received ${Array.isArray(data) ? data.length : 0} variations for product ${productId}`);
    
    // Aggiungiamo uno stack trace per vedere da dove viene chiamata questa funzione
    console.log('Call stack:', new Error().stack);
    
    // Verifica che i dati siano un array e non vuoti
    if (!data || !Array.isArray(data)) {
      console.error(`Invalid variations data for product ${productId}:`, data);
      return [];
    }
    
    // Salva i dati in cache
    variationsCache[productId] = {
      data: data as ProductVariation[],
      timestamp: now
    };
    
    return data as ProductVariation[];
  } catch (error) {
    console.error(`Error fetching variations for product ${productId}:`, error);
    return [];
  }
}

// Fetch products by category
export async function getProductsByCategory(categoryId: number, page = 1, per_page = 10): Promise<Product[]> {
  try {
    const { data } = await api.get('products', {
      category: categoryId,
      per_page,
      page,
      status: 'publish', // Include solo i prodotti pubblicati, esclude le bozze
    });
    return data as Product[];
  } catch (error) {
    console.error(`Error fetching products for category ${categoryId}:`, error);
    return [];
  }
}

// Fetch all categories
export async function getCategories(): Promise<Category[]> {
  try {
    const { data } = await api.get('products/categories', {
      per_page: 100,
    });
    return data as Category[];
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

// Search products
export async function searchProducts(searchTerm: string, page = 1, per_page = 10): Promise<Product[]> {
  try {
    const { data } = await api.get('products', {
      search: searchTerm,
      per_page,
      page,
    });
    return data as Product[];
  } catch (error) {
    console.error(`Error searching products with term "${searchTerm}":`, error);
    return [];
  }
}

// Order data interface
// Interfaccia per la risposta dell'API WooCommerce per la creazione di un ordine
export interface WooCommerceOrderResponse {
  id: number;
  customer_id: number;
  status: string;
  total: string;
  payment_method: string;
  payment_method_title: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    [key: string]: unknown;
  };
  shipping: {
    [key: string]: unknown;
  };
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    quantity: number;
    price: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface OrderData {
  payment_method: string;
  payment_method_title: string;
  set_paid: boolean;
  customer_id?: number;  // Aggiungiamo il customer_id come campo opzionale per compatibilità
  billing: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone?: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items: Array<{
    product_id: number;
    quantity: number;
    variation_id?: number;
    meta_data?: Array<{
      key: string;
      value: string;
    }>;
  }>;
  shipping_lines?: Array<{
    method_id: string;
    method_title: string;
    total: string;
  }>;
  coupon_lines?: Array<{
    code: string;
  }>;
  meta_data?: Array<{
    key: string;
    value: string;
  }>;
}

// Create an order con customer_id impostato direttamente
export async function createOrder(orderData: OrderData): Promise<WooCommerceOrderResponse> {
  try {
    // Recuperiamo l'ID utente direttamente dal token JWT
    let userId = 0;
    
    // Per sicurezza, aggiungiamo un blocco che esegue una chiamata API per recuperare l'ID utente
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('woocommerce_token');
        if (token) {
          // Recupera i dati utente dall'API validate
          const response = await fetch('/api/auth/validate', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            if (userData && userData.id) {
              userId = parseInt(String(userData.id), 10);
            }
          }
        }
      } catch (e) {
        console.error('Errore nel recupero dati utente:', e);
      }
    }
    
    console.log('API DEBUG - UserId recuperato direttamente dall\'API:', userId);
    
    // Prepariamo i dati dell'ordine con il customer_id esplicito
    // IMPORTANTE: Rispettiamo il customer_id se già presente in orderData
    const rawDataToSend = {
      ...orderData,
      // Impostiamo customer_id solo se non è già presente
      customer_id: orderData.customer_id || userId
    };
    
    // Log speciale per tracciare il customer_id
    console.log('API DEBUG - customer_id passato:', orderData.customer_id);
    console.log('API DEBUG - customer_id recuperato da token:', userId);
    console.log('API DEBUG - customer_id finale:', rawDataToSend.customer_id);

    // Convertiamo in un oggetto semplice per evitare problemi di serializzazione
    const orderDataToSend = JSON.parse(JSON.stringify(rawDataToSend));

    // Log dell'ID utente recuperato direttamente dal localStorage
    console.log('API DEBUG - OrderData originale:', orderData);
    console.log('API DEBUG - OrderData preparato per invio:', orderDataToSend);

    // Log molto dettagliato per debug
    console.log('API DEBUG - Creazione ordine con dati:', {
      customer_id: orderDataToSend.customer_id,
      payment_method: orderDataToSend.payment_method,
      billing: orderDataToSend.billing ? {
        email: orderDataToSend.billing.email,
        first_name: orderDataToSend.billing.first_name,
      } : 'non disponibile',
      orderData_full: JSON.stringify(orderDataToSend)
    });

    // Verifichiamo se ci sono prodotti con acconti nell'ordine (solo per debug)
    let hasDeposits = false;
    if (orderDataToSend.line_items && Array.isArray(orderDataToSend.line_items)) {
      // Controlliamo se qualche articolo ha i metadati di acconto
      for (const item of orderDataToSend.line_items) {
        // Verifica nelle proprietà dirette dell'oggetto
        if (item._wc_convert_to_deposit === 'yes') {
          hasDeposits = true;
          break;
        }
        
        // Verifica nella struttura meta_data se esiste
        if (item.meta_data && Array.isArray(item.meta_data)) {
          const depositMeta = item.meta_data.find((meta: { key: string, value: string }) => 
            meta.key === '_wc_convert_to_deposit' && meta.value === 'yes'
          );
          if (depositMeta) {
            hasDeposits = true;
            break;
          }
        }
        
        // Verifica se c'è un riferimento al piano di pagamento
        if (
          (item._wc_payment_plan && item._wc_payment_plan !== '') ||
          (item.payment_plan && item.payment_plan !== '') ||
          (item.deposit_amount && parseFloat(String(item.deposit_amount)) > 0)
        ) {
          hasDeposits = true;
          break;
        }
      }
    }
    
    // Verifica anche nei metadati dell'ordine principale (solo per debug)
    if (!hasDeposits && orderDataToSend.meta_data && Array.isArray(orderDataToSend.meta_data)) {
      const orderDepositMeta = orderDataToSend.meta_data.find((meta: { key: string, value: string }) => 
        meta.key === '_wc_deposits_order_has_deposit' && meta.value === 'yes'
      );
      if (orderDepositMeta) {
        hasDeposits = true;
      }
    }
    
    console.log('API DEBUG - Ordine contiene acconti:', hasDeposits);
    
    // Usa sempre l'endpoint standard WooCommerce per tutti gli ordini
    console.log('API DEBUG - Utilizzo endpoint standard WooCommerce');
    const response = await api.post('orders', orderDataToSend);
    const orderResponse = response.data as WooCommerceOrderResponse;
    
    // Log della risposta
    console.log('API DEBUG - Risposta creazione ordine:', {
      id: orderResponse.id,
      customer_id: orderResponse.customer_id,
      status: orderResponse.status,
      response_keys: Object.keys(orderResponse)
    });
    
    return orderResponse;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}

// Get order details
export async function getOrder(orderId: number) {
  try {
    const { data } = await api.get(`orders/${orderId}`);
    return data;
  } catch (error) {
    console.error(`Error fetching order with ID ${orderId}:`, error);
    throw error;
  }
}

// Update an order
export async function updateOrder(orderId: number, orderData: Partial<OrderData>) {
  try {
    const response = await api.put(`orders/${orderId}`, orderData);
    return response.data;
  } catch (error) {
    console.error(`Error updating order ${orderId}:`, error);
    throw error;
  }
}

/**
 * Verifica un codice coupon
 * @param {string} code - Il codice coupon da verificare
 * @returns {Promise<Coupon | null>} - Il coupon se valido, null altrimenti
 */
export async function verifyCoupon(code: string) {
  try {
    // Utilizziamo un endpoint personalizzato per verificare il coupon in modo sicuro
    const response = await fetch(`/api/coupons/verify?code=${encodeURIComponent(code)}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Errore nella verifica del coupon');
    }
    
    const data = await response.json();
    return data.coupon;
  } catch (error) {
    console.error('Errore nella verifica del coupon:', error);
    throw error;
  }
}

// Cart item interface
export interface CartItem {
  id: number;
  name: string;
  price: string;
  regular_price: string;
  sale_price?: string;
  quantity: number;
  variation_id?: number;
  attributes?: Array<{
    name: string;
    option: string;
  }>;
  image?: {
    src: string;
    alt: string;
  };
}

/**
 * Applica un coupon al carrello
 * @param {string} code - Il codice coupon da applicare
 * @param {Array} cartItems - Articoli nel carrello
 * @returns {Promise<{discount: number, items: CartItem[]}>} - Lo sconto applicato e gli articoli aggiornati
 */
export async function applyCoupon(code: string, cartItems: CartItem[]) {
  try {
    const response = await fetch('/api/coupons/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        items: cartItems
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Errore nell\'applicazione del coupon');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Errore nell\'applicazione del coupon:', error);
    throw error;
  }
}

// Shipping address interface
export interface ShippingAddress {
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

/**
 * Recupera i metodi di spedizione disponibili per un indirizzo e un totale carrello
 * @param {ShippingAddress} shippingAddress - Indirizzo di spedizione
 * @param {number} cartTotal - Totale del carrello
 * @returns {Promise<ShippingMethod[]>} - Lista dei metodi di spedizione disponibili
 */
export async function getShippingMethods(shippingAddress: ShippingAddress, cartTotal: number): Promise<ShippingMethod[]> {
  try {
    // Verifica che l'indirizzo sia valido
    if (!shippingAddress || !shippingAddress.country) {
      console.log('Indirizzo di spedizione non valido per il recupero dei metodi');
      return [{
        id: 'flat_rate',
        title: 'Spedizione standard',
        description: 'Consegna in 3-5 giorni lavorativi',
        cost: 7.00
      }];
    }
    
    console.log(`Recupero metodi di spedizione per paese: ${shippingAddress.country}`);
    
    try {
      // Aggiungiamo un timestamp per evitare problemi di cache
      const timestamp = new Date().getTime();
      
      // Chiamata all'API per ottenere i metodi di spedizione disponibili
      const response = await fetch('/api/shipping/methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          shipping_address: shippingAddress,
          cart_total: cartTotal,
          _timestamp: timestamp
        })
      });
      
      if (!response.ok) {
        throw new Error('Errore nella risposta dell\'API dei metodi di spedizione');
      }
      
      const data = await response.json();
      
      if (data && Array.isArray(data.methods)) {
        console.log(`Metodi di spedizione recuperati: ${data.methods.length}`);
        return data.methods;
      }
      
      throw new Error('Dati dei metodi di spedizione non validi');
    } catch (error) {
      console.error('Errore nella chiamata all\'API dei metodi di spedizione:', error);
      
      // In caso di errore, restituisci un metodo predefinito
      return [{
        id: 'flat_rate',
        title: 'Spedizione standard',
        description: 'Consegna in 3-5 giorni lavorativi',
        cost: 7.00
      }];
    }
  } catch (error) {
    console.error('Errore nel recupero dei metodi di spedizione:', error);
    return [{
      id: 'flat_rate',
      title: 'Spedizione standard',
      description: 'Consegna in 3-5 giorni lavorativi',
      cost: 7.00
    }];
  }
}

/**
 * Calcola le spese di spedizione in base all'indirizzo e agli articoli nel carrello
 * @param {ShippingAddress} shippingAddress - Indirizzo di spedizione
 * @returns {Promise<number>} - Costo di spedizione
 */
export async function calculateShipping(shippingAddress: ShippingAddress) {
  try {
    // Verifica che l'indirizzo sia valido
    if (!shippingAddress || !shippingAddress.country) {
      console.log('Indirizzo di spedizione non valido');
      return 5.99; // Valore predefinito
    }
    
    console.log(`Calcolo spedizione per paese: ${shippingAddress.country}`);
    
    // Utilizziamo il nuovo endpoint API dedicato che funziona in modo affidabile su iOS
    try {
      // Aggiungiamo un timestamp per evitare problemi di cache su iOS
      const timestamp = new Date().getTime();
      
      // Chiamata diretta all'API per ottenere il costo di spedizione
      const response = await fetch('/api/shipping/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          shipping_address: shippingAddress,
          _timestamp: timestamp
        })
      });
      
      if (!response.ok) {
        throw new Error('Errore nella risposta dell\'API di spedizione');
      }
      
      const data = await response.json();
      
      if (data && typeof data.shipping_cost === 'number') {
        console.log(`Costo di spedizione calcolato dall'API: ${data.shipping_cost}`);
        return data.shipping_cost;
      }
      
      throw new Error('Dati di spedizione non validi');
    } catch (error) {
      console.error('Errore nella chiamata all\'API di spedizione:', error);
      
      // In caso di errore, restituisci un valore predefinito basato sul paese
      const countryCode = shippingAddress.country;
      
      // Valori di fallback per paese
      const fallbackRates: Record<string, number> = {
        'IT': 7.00,  // Italia
        'FR': 12.50, // Francia
        'DE': 12.50, // Germania
        'ES': 12.50, // Spagna
        'GB': 15.00  // Regno Unito
      };
      
      const fallbackCost = fallbackRates[countryCode];
      if (fallbackCost !== undefined) {
        console.log(`Utilizzo valore di fallback per ${countryCode}: ${fallbackCost}`);
        return fallbackCost;
      }
      
      console.log('Utilizzo valore di fallback standard: 5.99');
      return 5.99; // Valore predefinito standard
    }
  } catch (error) {
    console.error('Errore nel calcolo della spedizione:', error);
    return 5.99; // Valore predefinito in caso di errore imprevisto
  }
}
