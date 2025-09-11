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

export interface ProductACF {
  brand?: string;
  tipologia?: string;
  anime?: string;
  codice_a_barre?: string;
  disponibilita?: string;
  spedizione_dallitalia?: string;
  spedizione_dalloriente?: string;
  spedizione_in_60_giorni?: string;
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
  date_on_sale_from?: string; // Data di inizio offerta ISO 8601
  date_on_sale_to?: string; // Data di fine offerta ISO 8601
  date_on_sale_from_gmt?: string; // Data di inizio offerta GMT
  date_on_sale_to_gmt?: string; // Data di fine offerta GMT
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
export async function getProducts(page = 1, per_page = 10, orderby = 'date', order = 'desc'): Promise<Product[]> {
  try {
    // Utilizziamo un timestamp per generare una chiave di cache che include i parametri di ordinamento
    const cacheKey = `products_${page}_${per_page}_${orderby}_${order}_${Math.floor(Date.now() / (1000 * 300))}`;
    
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
      orderby, // Ordina per: date, title, price, popularity, rating, etc.
      order, // asc o desc
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

// Fetch products by category slug
export async function getProductsByCategorySlug(categorySlug: string, page = 1, per_page = 10, orderby = 'date', order = 'desc'): Promise<Product[]> {
  try {
    // Prima ottieni la categoria tramite slug
    const category = await getCategoryBySlug(categorySlug);
    
    if (!category) {
      console.error(`Category with slug ${categorySlug} not found`);
      return [];
    }
    
    // Poi ottieni i prodotti di quella categoria
    const { data } = await api.get('products', {
      category: category.id,
      per_page,
      page,
      status: 'publish',
      orderby,
      order,
    });
    
    return data as Product[];
  } catch (error) {
    console.error(`Error fetching products for category slug ${categorySlug}:`, error);
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

// Fetch category by slug
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    const { data } = await api.get('products/categories', {
      slug: slug,
    });
    
    if (Array.isArray(data) && data.length > 0) {
      return data[0] as Category;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching category with slug ${slug}:`, error);
    return null;
  }
}

// Search products (only in product titles)
export async function searchProducts(searchTerm: string, page = 1, per_page = 10): Promise<Product[]> {
  try {
    // Otteniamo più prodotti per compensare il filtraggio lato client
    const { data } = await api.get('products', {
      search: searchTerm,
      per_page: Math.max(100, per_page * 5), // Prendiamo più prodotti per compensare il filtraggio
      page: 1, // Sempre dalla prima pagina
      status: 'publish', // Include solo i prodotti pubblicati, esclude privati e bozze
    });
    
    // Filtriamo solo i prodotti il cui nome contiene il termine di ricerca
    const filteredProducts = (data as Product[]).filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Implementa paginazione manuale
    const startIndex = (page - 1) * per_page;
    const endIndex = startIndex + per_page;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
    
    return paginatedProducts;
  } catch (error) {
    console.error(`Error searching products with term "${searchTerm}":`, error);
    return [];
  }
}

// Fetch products on sale
export async function getProductsOnSale(page = 1, per_page = 10, orderby = 'date', order = 'desc'): Promise<Product[]> {
  try {
    // Utilizziamo un timestamp per generare una chiave di cache
    const cacheKey = `products_on_sale_${page}_${per_page}_${orderby}_${order}_${Math.floor(Date.now() / (1000 * 300))}`;
    
    // Verifichiamo se abbiamo i dati in cache (solo lato client)
    if (typeof window !== 'undefined') {
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData) as Product[];
      }
    }
    
    // Ottieni prodotti con un margine extra per il filtraggio
    const { data } = await api.get('products', {
      per_page: Math.max(100, per_page * 3), // Prendiamo più prodotti per compensare il filtraggio
      page: 1, // Sempre dalla prima pagina per semplicità
      status: 'publish',
      orderby,
      order,
    });
    
    // Filtra per prodotti in offerta
    const allSaleProducts = (data as Product[]).filter(product => 
      product.sale_price && 
      product.sale_price !== '' && 
      parseFloat(product.sale_price) < parseFloat(product.regular_price)
    );
    
    // Implementa paginazione manuale
    const startIndex = (page - 1) * per_page;
    const endIndex = startIndex + per_page;
    const limitedSaleProducts = allSaleProducts.slice(startIndex, endIndex);
    
    console.log(`Pagina ${page}: ${allSaleProducts.length} prodotti totali in offerta, restituendo ${limitedSaleProducts.length} (${startIndex}-${endIndex-1})`);
    
    // Salviamo i dati in cache (solo lato client)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(cacheKey, JSON.stringify(limitedSaleProducts));
    }
    
    return limitedSaleProducts;
  } catch (error) {
    console.error('Error fetching products on sale:', error);
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

// Billing address interface
export interface BillingAddress {
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
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

/**
 * Salva gli indirizzi dell'utente (fatturazione e spedizione)
 * @param {string} token - Token di autenticazione
 * @param {object} addressData - Dati degli indirizzi da salvare
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function saveUserAddresses(token: string, addressData: {
  billing?: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping?: {
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
}) {
  try {
    const response = await fetch('/api/user/addresses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(addressData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Errore nel salvataggio degli indirizzi:', error);
    throw error;
  }
}

/**
 * Recupera gli indirizzi dell'utente (fatturazione e spedizione)
 * @param {string} token - Token di autenticazione
 * @returns {Promise<{billing: BillingAddress | null, shipping: ShippingAddress | null}>}
 */
export async function getUserAddresses(token: string) {
  try {
    const timestamp = new Date().getTime();
    const response = await fetch(`/api/user/addresses?_=${timestamp}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store'
      }
    });

    if (!response.ok) {
      throw new Error(`Errore nel recupero degli indirizzi: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Errore nel recupero degli indirizzi:', error);
    throw error;
  }
}

/**
 * Salva l'indirizzo di fatturazione dell'utente
 * @param {BillingAddress} address - Indirizzo di fatturazione
 * @param {string} token - Token di autenticazione
 */
export async function saveBillingAddress(address: BillingAddress, token: string) {
  try {
    const response = await fetch('/api/user/addresses/billing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(address)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Errore nel salvataggio dell\'indirizzo di fatturazione');
    }

    return await response.json();
  } catch (error) {
    console.error('Errore nel salvataggio dell\'indirizzo di fatturazione:', error);
    throw error;
  }
}

/**
 * Salva l'indirizzo di spedizione dell'utente
 * @param {ShippingAddress} address - Indirizzo di spedizione
 * @param {string} token - Token di autenticazione
 */
export async function saveShippingAddress(address: ShippingAddress, token: string) {
  try {
    const response = await fetch('/api/user/addresses/shipping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(address)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Errore nel salvataggio dell\'indirizzo di spedizione');
    }

    return await response.json();
  } catch (error) {
    console.error('Errore nel salvataggio dell\'indirizzo di spedizione:', error);
    throw error;
  }
}

// Customer creation interface
export interface CreateCustomerData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  billing: BillingAddress;
  shipping: ShippingAddress;
}

// Customer response interface
export interface WooCommerceCustomer {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

/**
 * Crea un nuovo customer in WooCommerce
 * @param {CreateCustomerData} customerData - Dati del customer da creare
 * @returns {Promise<WooCommerceCustomer>} - Il customer creato
 */
export async function createCustomer(customerData: CreateCustomerData): Promise<WooCommerceCustomer> {
  try {
    const wooCustomerData = {
      email: customerData.email,
      first_name: customerData.first_name,
      last_name: customerData.last_name,
      username: customerData.email, // Usa l'email come username
      password: customerData.password,
      billing: customerData.billing,
      shipping: customerData.shipping
    };

    const response = await api.post('customers', wooCustomerData);
    
    if (!response.data) {
      throw new Error('Errore nella creazione del customer');
    }

    return response.data as WooCommerceCustomer;
  } catch (error) {
    console.error('Errore nella creazione del customer:', error);
    throw error;
  }
}

/**
 * Ottiene i prodotti più venduti
 * @param limit - Numero di prodotti da restituire (default: 4)
 * @returns Promise<Product[]> - Array di prodotti più venduti
 */
export async function getBestSellingProducts(limit: number = 4): Promise<Product[]> {
  try {
    const response = await api.get('products', {
      per_page: limit,
      orderby: 'popularity',
      status: 'publish',
      stock_status: 'instock'
    });
    return response.data as Product[];
  } catch (error) {
    console.error('Errore nel recupero dei prodotti più venduti:', error);
    return [];
  }
}

/**
 * Ottiene i prodotti correlati basati sulla categoria
 * @param productId - ID del prodotto corrente
 * @param categoryIds - Array di ID delle categorie del prodotto
 * @param limit - Numero di prodotti da restituire (default: 4)
 * @returns Promise<Product[]> - Array di prodotti correlati
 */
export async function getRelatedProducts(productId: number, categoryIds: number[], limit: number = 4): Promise<Product[]> {
  try {
    if (categoryIds.length === 0) return [];
    
    const response = await api.get('products', {
      per_page: limit + 1, // +1 per escludere il prodotto corrente
      category: categoryIds.join(','),
      exclude: productId,
      status: 'publish',
      stock_status: 'instock'
    });
    
    return (response.data as Product[]).slice(0, limit);
  } catch (error) {
    console.error('Errore nel recupero dei prodotti correlati:', error);
    return [];
  }
}

/**
 * Estrae i campi ACF dai meta_data del prodotto
 * @param metaData - Array di metadati del prodotto
 * @returns ProductACF - Oggetto con i campi ACF
 */
export function extractACFFields(metaData?: MetaData[]): ProductACF {
  if (!metaData) return {};
  
  const acfFields: ProductACF = {};
  
  metaData.forEach(meta => {
    switch (meta.key) {
      case 'brand':
        acfFields.brand = meta.value;
        break;
      case 'tipologia':
        acfFields.tipologia = meta.value;
        break;
      case 'anime':
        acfFields.anime = meta.value;
        break;
      case 'codice_a_barre':
        acfFields.codice_a_barre = meta.value;
        break;
      case 'disponibilita':
        acfFields.disponibilita = meta.value;
        break;
      case 'spedizione-dallitalia':
        acfFields.spedizione_dallitalia = meta.value;
        break;
      case 'spedizione-dalloriente':
        acfFields.spedizione_dalloriente = meta.value;
        break;
      case 'spedizione-in-60-giorni':
        acfFields.spedizione_in_60_giorni = meta.value;
        break;
    }
  });
  
  return acfFields;
}

export interface AttributeValue {
  name: string;
  count: number;
  slug: string;
}

export interface ExtendedCategory extends Category {
  subcategories?: Category[];
}

export async function getMegaMenuCategories(): Promise<ExtendedCategory[]> {
  try {
    const cacheKey = `mega_menu_categories_${Math.floor(Date.now() / (1000 * 300))}`;
    
    if (typeof window !== 'undefined') {
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData) as ExtendedCategory[];
      }
    }
    
    const allCategories = await getCategories();
    
    // Escludi categorie non necessarie e sottocategorie che saranno mostrate come sottocategorie
    const excludedSlugs = [
      'attack-on-titan',
      'black-week',
      'cina',
      'cina-rs', 
      'crazy-month',
      'editoria',
      'gift-card',
      'italia',
      'no-categoria',
      'nuovi-arrivi',
      'senza-categoria',
      // Sottocategorie da escludere come categorie principali
      'dragon-ball-cg',
      'one-piece-cg',
      'yu-gi-oh',
      'jimei-palace',
      'tsume'
    ];
    
    // Crea un array per organizzare le categorie con le loro sottocategorie
    const organizedCategories = [];
    const mainCategories = allCategories.filter(category => !excludedSlugs.includes(category.slug));
    
    // Trova le sottocategorie specifiche
    const cardGameSubcats = allCategories.filter(cat => 
      ['dragon-ball-cg', 'one-piece-cg', 'yu-gi-oh'].includes(cat.slug)
    );
    const resineSubcats = allCategories.filter(cat => 
      ['jimei-palace', 'tsume'].includes(cat.slug)
    );
    
    // Aggiungi tutte le categorie principali
    for (const category of mainCategories) {
      if (category.slug === 'card-game' || category.slug === 'cards' || category.name.toLowerCase().includes('card')) {
        // Aggiungi categoria Card Game
        organizedCategories.push({
          ...category,
          subcategories: cardGameSubcats
        });
      } else if (category.slug === 'resine' || category.name.toLowerCase().includes('resin')) {
        // Aggiungi categoria Resine
        organizedCategories.push({
          ...category,
          subcategories: resineSubcats
        });
      } else {
        organizedCategories.push({
          ...category,
          subcategories: []
        });
      }
    }
    
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(cacheKey, JSON.stringify(organizedCategories));
    }
    
    return organizedCategories;
  } catch (error) {
    console.error('Error fetching mega menu categories:', error);
    return [];
  }
}

export async function getAvailabilityOptions(): Promise<AttributeValue[]> {
  try {
    const cacheKey = `availability_${Math.floor(Date.now() / (1000 * 300))}`;
    
    if (typeof window !== 'undefined') {
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData) as AttributeValue[];
      }
    }
    
    const { data } = await api.get('products', {
      per_page: 100,
      status: 'publish',
    });
    
    const availabilityCounts = new Map<string, number>();
    
    (data as Product[]).forEach(product => {
      const acf = extractACFFields(product.meta_data);
      if (acf.disponibilita && acf.disponibilita.trim()) {
        const availability = acf.disponibilita.trim();
        availabilityCounts.set(availability, (availabilityCounts.get(availability) || 0) + 1);
      }
    });
    
    const availabilityOptions = Array.from(availabilityCounts.entries())
      .map(([name, count]) => ({ 
        name, 
        count, 
        slug: name.toLowerCase().replace(/\s+/g, '-') 
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(cacheKey, JSON.stringify(availabilityOptions));
    }
    
    return availabilityOptions;
  } catch (error) {
    console.error('Error fetching availability options:', error);
    return [];
  }
}

export async function getShippingTimeOptions(): Promise<AttributeValue[]> {
  try {
    const cacheKey = `shipping_times_${Math.floor(Date.now() / (1000 * 300))}`;
    
    if (typeof window !== 'undefined') {
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData) as AttributeValue[];
      }
    }
    
    const shippingOptions = [
      { name: 'Spedizione dall\'Italia', slug: 'spedizione-dallitalia', count: 0 },
      { name: 'Spedizione dall\'Oriente', slug: 'spedizione-dalloriente', count: 0 },
      { name: 'Spedizione in 60 giorni', slug: 'spedizione-in-60-giorni', count: 0 }
    ];
    
    const { data } = await api.get('products', {
      per_page: 100,
      status: 'publish',
    });
    
    (data as Product[]).forEach(product => {
      const acf = extractACFFields(product.meta_data);
      
      if (acf.spedizione_dallitalia === 'yes') {
        shippingOptions[0].count++;
      }
      if (acf.spedizione_dalloriente === 'yes') {
        shippingOptions[1].count++;
      }
      if (acf.spedizione_in_60_giorni === 'yes') {
        shippingOptions[2].count++;
      }
    });
    
    const filteredOptions = shippingOptions.filter(option => option.count > 0);
    
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(cacheKey, JSON.stringify(filteredOptions));
    }
    
    return filteredOptions;
  } catch (error) {
    console.error('Error fetching shipping time options:', error);
    return [];
  }
}

