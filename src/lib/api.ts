import api from './woocommerce';
import axios from 'axios';

// Interface for DreamShop plugin API product response
interface DreamShopProduct {
  id: string | number;
  name: string;
  slug: string;
  permalink: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  date_on_sale_from?: string;
  date_on_sale_to?: string;
  stock_status: string;
  short_description: string;
  images: Array<{
    id: string | number;
    src: string;
    src_large: string;
    alt: string;
  }>;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  attributes?: Array<{
    name: string;
    slug: string;
    options: Array<{
      id?: number;
      name: string;
      slug: string;
    }>;
    position: number;
    visible: boolean;
    variation: boolean;
    is_taxonomy: boolean;
  }>;
  sales_count?: number;
  has_deposit_option?: boolean;
}

// Cache for preventing duplicate requests
const requestCache = new Map<string, Promise<{ products: Product[], total: number }>>();

// Optimized function for proper pagination with price filters
export async function getProductsByBrandSlugsOptimized(
  brandSlugs: string[],
  page = 1,
  per_page = 10,
  orderby = 'date',
  order = 'desc',
  min_price?: number,
  max_price?: number
): Promise<{ products: Product[], total: number }> {
  const requestId = Math.random().toString(36).substr(2, 9);

  try {
    if (brandSlugs.length === 0) {
      return await getProducts(page, per_page, orderby, order, min_price, max_price);
    }

    // Step 1: Get brand IDs
    const brandIds: number[] = [];
    for (const brandSlug of brandSlugs) {
      try {
        const wpBrandResponse = await wpApi.get(`product_brand?slug=${brandSlug}&_fields=id,name`);
        if (wpBrandResponse.data.length > 0) {
          brandIds.push(wpBrandResponse.data[0].id);
        }
      } catch (error) {
        console.error(`Error fetching brand ${brandSlug}:`, error);
      }
    }

    if (brandIds.length === 0) {
      return { products: [], total: 0 };
    }

    // Step 2: Get ALL product IDs matching brands (no pagination yet)
    const allProductIds: number[] = [];
    let wpPage = 1;
    const wpPerPage = 100;

    while (true) {
      const wpResponse = await wpApi.get('product', {
        params: {
          product_brand: brandIds.join(','),
          per_page: wpPerPage,
          page: wpPage,
          _fields: 'id'
        }
      });

      const products = wpResponse.data as Array<{ id: number }>;
      if (products.length === 0) break;

      allProductIds.push(...products.map(p => p.id));
      if (products.length < wpPerPage) break;
      wpPage++;
      if (wpPage > 10) break; // Safety limit
    }


    // Step 3: Apply price filter to get filtered product IDs
    let filteredProductIds = allProductIds;

    if (min_price !== undefined || max_price !== undefined) {

      const filteredIds: number[] = [];
      const batchSize = 100;

      for (let i = 0; i < allProductIds.length; i += batchSize) {
        const batchIds = allProductIds.slice(i, i + batchSize);

        const batchResponse = await api.get('products', {
          include: batchIds.join(','),
          per_page: batchSize,
          status: 'publish',
          _fields: 'id,price'
        });

        const batchProducts = batchResponse.data as Array<{ id: number; price: string }>;

        const validIds = batchProducts
          .filter(product => {
            const productPrice = parseFloat(product.price) || 0;
            if (min_price !== undefined && productPrice < min_price) return false;
            if (max_price !== undefined && productPrice > max_price) return false;
            return true;
          })
          .map(product => product.id);

        filteredIds.push(...validIds);
      }

      filteredProductIds = filteredIds;
    }

    // Step 4: Apply pagination to filtered IDs
    const total = filteredProductIds.length;
    const startIndex = (page - 1) * per_page;
    const endIndex = startIndex + per_page;
    const paginatedIds = filteredProductIds.slice(startIndex, endIndex);


    if (paginatedIds.length === 0) {
      return { products: [], total };
    }

    // Step 5: Get full product data for paginated IDs
    const response = await api.get('products', {
      include: paginatedIds.join(','),
      per_page: paginatedIds.length,
      orderby,
      order,
      status: 'publish'
    });

    const products = response.data as Product[];


    return { products, total };

  } catch (error) {
    console.error(`❌ [${requestId}] Error:`, error);
    return { products: [], total: 0 };
  }
}

// Optimized function for category with price filtering
export async function getProductsByCategorySlugWithTotalOptimized(
  categorySlug: string,
  page = 1,
  per_page = 10,
  orderby = 'date',
  order = 'desc',
  min_price?: number,
  max_price?: number
): Promise<{ products: Product[], total: number }> {
  const requestId = Math.random().toString(36).substr(2, 9);

  try {
    // Step 1: Get category ID
    const categoryResponse = await wpApi.get(`product_cat?slug=${categorySlug}&_fields=id,name`);

    if (!categoryResponse.data || categoryResponse.data.length === 0) {
      console.error(`Category not found: ${categorySlug}`);
      return { products: [], total: 0 };
    }

    const categoryId = categoryResponse.data[0].id;

    // Step 2: Get ALL product IDs in category
    const allProductIds: number[] = [];
    let wpPage = 1;
    const wpPerPage = 100;

    while (true) {
      const wpResponse = await wpApi.get('product', {
        params: {
          product_cat: categoryId,
          per_page: wpPerPage,
          page: wpPage,
          _fields: 'id'
        }
      });

      const products = wpResponse.data as Array<{ id: number }>;
      if (products.length === 0) break;

      allProductIds.push(...products.map(p => p.id));
      if (products.length < wpPerPage) break;
      wpPage++;
      if (wpPage > 10) break; // Safety limit
    }


    // Step 3: Apply price filter to get filtered product IDs
    let filteredProductIds = allProductIds;

    if (min_price !== undefined || max_price !== undefined) {

      const filteredIds: number[] = [];
      const batchSize = 100;

      for (let i = 0; i < allProductIds.length; i += batchSize) {
        const batchIds = allProductIds.slice(i, i + batchSize);

        const batchResponse = await api.get('products', {
          include: batchIds.join(','),
          per_page: batchSize,
          status: 'publish',
          _fields: 'id,price'
        });

        const batchProducts = batchResponse.data as Array<{ id: number; price: string }>;

        const validIds = batchProducts
          .filter(product => {
            const productPrice = parseFloat(product.price) || 0;
            if (min_price !== undefined && productPrice < min_price) return false;
            if (max_price !== undefined && productPrice > max_price) return false;
            return true;
          })
          .map(product => product.id);

        filteredIds.push(...validIds);
      }

      filteredProductIds = filteredIds;
    }

    // Step 4: Apply pagination to filtered IDs
    const total = filteredProductIds.length;
    const startIndex = (page - 1) * per_page;
    const endIndex = startIndex + per_page;
    const paginatedIds = filteredProductIds.slice(startIndex, endIndex);


    if (paginatedIds.length === 0) {
      return { products: [], total };
    }

    // Step 5: Get full product data for paginated IDs
    const response = await api.get('products', {
      include: paginatedIds.join(','),
      per_page: paginatedIds.length,
      orderby,
      order,
      status: 'publish'
    });

    const products = response.data as Product[];


    return { products, total };

  } catch (error) {
    console.error(`❌ [${requestId}] Error:`, error);
    return { products: [], total: 0 };
  }
}

// Optimized function for category + brands with price filtering
export async function getProductsByCategorySlugAndBrandSlugsOptimized(
  categorySlug: string,
  brandSlugs: string[],
  page = 1,
  per_page = 10,
  orderby = 'date',
  order = 'desc',
  min_price?: number,
  max_price?: number
): Promise<{ products: Product[], total: number }> {
  const requestId = Math.random().toString(36).substr(2, 9);

  try {
    // Step 1: Get category ID
    const categoryResponse = await wpApi.get(`product_cat?slug=${categorySlug}&_fields=id,name`);
    if (!categoryResponse.data || categoryResponse.data.length === 0) {
      console.error(`Category not found: ${categorySlug}`);
      return { products: [], total: 0 };
    }
    const categoryId = categoryResponse.data[0].id;

    // Step 2: Get brand IDs
    const brandIds: number[] = [];
    for (const brandSlug of brandSlugs) {
      try {
        const wpBrandResponse = await wpApi.get(`product_brand?slug=${brandSlug}&_fields=id,name`);
        if (wpBrandResponse.data.length > 0) {
          brandIds.push(wpBrandResponse.data[0].id);
        }
      } catch (error) {
        console.error(`Error fetching brand ${brandSlug}:`, error);
      }
    }

    if (brandIds.length === 0) {
      return { products: [], total: 0 };
    }


    // Step 3: Get ALL product IDs matching category AND brands
    const allProductIds: number[] = [];
    let wpPage = 1;
    const wpPerPage = 100;

    while (true) {
      const wpResponse = await wpApi.get('product', {
        params: {
          product_cat: categoryId,
          product_brand: brandIds.join(','),
          per_page: wpPerPage,
          page: wpPage,
          _fields: 'id'
        }
      });

      const products = wpResponse.data as Array<{ id: number }>;
      if (products.length === 0) break;

      allProductIds.push(...products.map(p => p.id));
      if (products.length < wpPerPage) break;
      wpPage++;
      if (wpPage > 10) break; // Safety limit
    }


    // Step 4: Apply price filter to get filtered product IDs
    let filteredProductIds = allProductIds;

    if (min_price !== undefined || max_price !== undefined) {

      const filteredIds: number[] = [];
      const batchSize = 100;

      for (let i = 0; i < allProductIds.length; i += batchSize) {
        const batchIds = allProductIds.slice(i, i + batchSize);

        const batchResponse = await api.get('products', {
          include: batchIds.join(','),
          per_page: batchSize,
          status: 'publish',
          _fields: 'id,price'
        });

        const batchProducts = batchResponse.data as Array<{ id: number; price: string }>;

        const validIds = batchProducts
          .filter(product => {
            const productPrice = parseFloat(product.price) || 0;
            if (min_price !== undefined && productPrice < min_price) return false;
            if (max_price !== undefined && productPrice > max_price) return false;
            return true;
          })
          .map(product => product.id);

        filteredIds.push(...validIds);
      }

      filteredProductIds = filteredIds;
    }

    // Step 5: Apply pagination to filtered IDs
    const total = filteredProductIds.length;
    const startIndex = (page - 1) * per_page;
    const endIndex = startIndex + per_page;
    const paginatedIds = filteredProductIds.slice(startIndex, endIndex);


    if (paginatedIds.length === 0) {
      return { products: [], total };
    }

    // Step 6: Get full product data for paginated IDs
    const response = await api.get('products', {
      include: paginatedIds.join(','),
      per_page: paginatedIds.length,
      orderby,
      order,
      status: 'publish'
    });

    const products = response.data as Product[];


    return { products, total };

  } catch (error) {
    console.error(`❌ [${requestId}] Error:`, error);
    return { products: [], total: 0 };
  }
}

// WordPress API client for taxonomy filtering
const wpApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_WORDPRESS_URL + '/wp-json/wp/v2/',
  timeout: 10000, // 10 second timeout
  auth: {
    username: process.env.NEXT_PUBLIC_WC_CONSUMER_KEY!,
    password: process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET!
  }
});

// Utility function to manage cache size
function cleanupProductCache() {
  if (typeof window === 'undefined') return;

  try {
    const keys = Object.keys(sessionStorage);
    const productKeys = keys.filter(key => key.startsWith('products_')).sort();

    // Se abbiamo più di 20 cache entries, rimuovi quelle più vecchie
    if (productKeys.length > 20) {
      const keysToRemove = productKeys.slice(0, productKeys.length - 15);
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    }
  } catch (error) {
    console.warn('Error during cache cleanup:', error);
  }
}

// Types
export interface ProductAttribute {
  id: number;
  name: string;
  slug?: string;
  position: number;
  visible: boolean;
  variation: boolean;
  options: string[];
}

export interface PluginProductAttribute {
  name: string;
  slug: string;
  options: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  position: number;
  visible: boolean;
  variation: boolean;
  is_taxonomy: boolean;
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

export interface TopSellerReportItem {
  product_id: number;
  quantity: number;
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
  _deposit_payment_plan?: string;
  has_deposit_option?: boolean; // Campo aggiunto dal plugin per evitare chiamate API multiple
  stock_status: string;
  stock_quantity?: number; // Quantità disponibile in magazzino
  manage_stock?: boolean; // Indica se il prodotto gestisce lo stock
  sold_individually?: boolean; // Limita gli acquisti a 1 elemento per ordine (WooCommerce)
  permalink: string;
  slug: string;
  type: string; // 'simple', 'variable', etc.
  attributes?: ProductAttribute[] | PluginProductAttribute[];
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
  // acf?: ProductACF; // Advanced Custom Fields (rimosso per evitare conflitti con meta_data brand)
  brands?: Array<{
    id: number;
    name: string;
    slug: string;
  }>; // WordPress taxonomy brands
  shipping_class_id?: number; // ID della classe di spedizione
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

// Brand (product_brand taxonomy)
export interface Brand {
  id: number;
  name: string;
  slug: string;
  count?: number;
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
export async function getProducts(page = 1, per_page = 10, orderby = 'date', order = 'desc', min_price?: number, max_price?: number): Promise<{ products: Product[], total: number }> {
  try {
    // Cache solo per chiamate senza filtri prezzo
    let cacheKey = '';
    let shouldCache = false;

    if (!min_price && !max_price) {
      // Utilizziamo un timestamp per generare una chiave di cache per le chiamate base
      cacheKey = `products_${page}_${per_page}_${orderby}_${order}_${Math.floor(Date.now() / (1000 * 300))}`;
      shouldCache = true;

      // Verifichiamo se abbiamo i dati in cache (solo lato client)
      if (typeof window !== 'undefined') {
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
          return JSON.parse(cachedData) as { products: Product[], total: number };
        }
      }
    }

    // Prepariamo i parametri per la chiamata API
    const params: Record<string, string | number> = {
      per_page,
      page,
      status: 'publish', // Include solo i prodotti pubblicati, esclude le bozze
      orderby, // Ordina per: date, title, price, popularity, rating, etc.
      order, // asc o desc
    };

    // Aggiungi filtri prezzo se specificati
    if (min_price !== undefined) {
      params.min_price = min_price;
    }
    if (max_price !== undefined) {
      params.max_price = max_price;
    }

    // Se non abbiamo dati in cache, facciamo la chiamata API
    const response = await api.get('products', params);
    
    const products = response.data as Product[];
    const total = parseInt((response.headers as Record<string, string>)['x-wp-total'] || '0', 10);
    const result = { products, total };
    
    // Salviamo i dati in cache solo se abilitato
    if (shouldCache && typeof window !== 'undefined') {
      // Pulisci la cache periodicamente
      cleanupProductCache();

      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(result));
      } catch {
        // Se la quota è piena, forza la pulizia e riprova
        console.warn('Cache quota exceeded, forcing cleanup');
        try {
          sessionStorage.clear(); // Rimuovi tutto per risolvere definitivamente
          sessionStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {
          console.warn('Unable to cache even after clearing storage');
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching products:', error);
    return { products: [], total: 0 };
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
      return cachedData.data;
    }
    
    // Se non abbiamo dati in cache o sono scaduti, facciamo la chiamata API
    // Aggiungiamo un parametro timestamp per evitare la cache su iOS
    const timestamp = new Date().getTime();

    const { data } = await api.get(`products/${productId}/variations`, {
      per_page: 100, // Recupera fino a 100 variazioni
      _: timestamp, // Parametro per evitare la cache
    });
    
    // Verifica che i dati siano un array e non vuoti
    if (!data || !Array.isArray(data)) {
      return [];
    }
    
    // Salva i dati in cache
    variationsCache[productId] = {
      data: data as ProductVariation[],
      timestamp: now
    };
    
    return data as ProductVariation[];
  } catch {
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
      stock_status: 'instock',
      orderby,
      order,
    });

    return data as Product[];
  } catch (error) {
    console.error(`Error fetching products for category slug ${categorySlug}:`, error);
    return [];
  }
}

// Fetch products by category slug with total count
export async function getProductsByCategorySlugWithTotal(categorySlug: string, page = 1, per_page = 10, orderby = 'date', order = 'desc', min_price?: number, max_price?: number): Promise<{ products: Product[], total: number }> {
  try {
    // Prima ottieni la categoria tramite slug
    const category = await getCategoryBySlug(categorySlug);

    if (!category) {
      console.error(`Category with slug ${categorySlug} not found`);
      return { products: [], total: 0 };
    }

    // Prepariamo i parametri per la chiamata API
    const params: Record<string, string | number> = {
      category: category.id,
      per_page,
      page,
      status: 'publish',
      orderby,
      order,
    };

    // Aggiungi filtri prezzo se specificati
    if (min_price !== undefined) {
      params.min_price = min_price;
    }
    if (max_price !== undefined) {
      params.max_price = max_price;
    }

    // Poi ottieni i prodotti di quella categoria
    const response = await api.get('products', params);

    const products = response.data as Product[];
    const total = parseInt((response.headers as Record<string, string>)['x-wp-total'] || '0', 10);

    return { products, total };
  } catch (error) {
    console.error(`Error fetching products for category slug ${categorySlug}:`, error);
    return { products: [], total: 0 };
  }
}

// Fetch ALL products by category slug (for filtering and price calculation)
export async function getAllProductsByCategorySlug(categorySlug: string): Promise<Product[]> {
  try {
    // Prima ottieni la categoria tramite slug
    const category = await getCategoryBySlug(categorySlug);

    if (!category) {
      console.error(`Category with slug ${categorySlug} not found`);
      return [];
    }

    let allProducts: Product[] = [];
    let page = 1;
    const perPage = 100; // Maximum allowed by WooCommerce

    while (true) {
      const { data } = await api.get('products', {
        category: category.id,
        per_page: perPage,
        page,
        status: 'publish',
      });

      const products = data as Product[];
      if (!products || products.length === 0) {
        break; // No more products
      }

      allProducts = [...allProducts, ...products];

      if (products.length < perPage) {
        break; // Last page
      }

      page++;
    }

    return allProducts;
  } catch (error) {
    console.error(`Error fetching all products for category slug ${categorySlug}:`, error);
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

// Fetch brands (product_brand terms from WP REST API)
export async function getBrands(): Promise<Brand[]> {
  try {
    const cacheKey = `brands_${Math.floor(Date.now() / (1000 * 300))}`;
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached) as Brand[];
    }

    const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';
    const res = await fetch(`${baseUrl}/wp-json/wp/v2/product_brand?per_page=100&_fields=id,slug,name,count`, {
      // Public taxonomy; no auth required
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`Failed to fetch brands: ${res.status}`);
    const data = (await res.json()) as Array<{ id: number; slug: string; name: string; count?: number }>;
    const brands: Brand[] = data.map(b => ({ id: b.id, slug: b.slug, name: b.name, count: b.count }));

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(cacheKey, JSON.stringify(brands));
    }
    return brands;
  } catch (error) {
    console.error('Error fetching brands:', error);
    return [];
  }
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';
    const res = await fetch(`${baseUrl}/wp-json/wp/v2/product_brand?slug=${encodeURIComponent(slug)}&_fields=id,slug,name,count`, {
      next: { revalidate: 300 }
    });
    if (!res.ok) throw new Error(`Failed to fetch brand ${slug}: ${res.status}`);
    const arr = (await res.json()) as Array<{ id: number; slug: string; name: string; count?: number }>;
    if (arr && arr.length > 0) return { id: arr[0].id, slug: arr[0].slug, name: arr[0].name, count: arr[0].count };
    return null;
  } catch (error) {
    console.error(`Error fetching brand with slug ${slug}:`, error);
    return null;
  }
}

// Fetch brands that have products in a specific category
export async function getBrandsByCategory(categoryId: number): Promise<Brand[]> {
  try {
    const cacheKey = `brands_category_${categoryId}_${Math.floor(Date.now() / (1000 * 300))}`;
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached) as Brand[];
    }

    // Get all brands and filter based on products
    const allBrands = await getBrands();
    const brandsWithProducts: Brand[] = [];

    // For each brand, check if it has products in this category
    for (const brand of allBrands) {
      try {
        const { data: brandProducts } = await api.get('products', {
          category: categoryId,
          brand: brand.id,
          per_page: 1,
          status: 'publish',
        });

        if (brandProducts && (brandProducts as Product[]).length > 0) {
          brandsWithProducts.push(brand);
        }
      } catch (error) {
        // Skip brands that cause errors
        console.warn(`Error checking brand ${brand.name}:`, error);
      }
    }

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(cacheKey, JSON.stringify(brandsWithProducts));
    }

    return brandsWithProducts;
  } catch (error) {
    console.error('Error fetching brands by category:', error);
    return [];
  }
}

// Fetch brands that have products in a specific category by slug
export async function getBrandsByCategorySlug(categorySlug: string): Promise<Brand[]> {
  try {
    // First get the category by slug
    const category = await getCategoryBySlug(categorySlug);

    if (!category) {
      console.error(`Category with slug ${categorySlug} not found`);
      return [];
    }

    // Then get brands for that category
    return await getBrandsByCategory(category.id);
  } catch (error) {
    console.error(`Error fetching brands for category slug ${categorySlug}:`, error);
    return [];
  }
}

// Fetch products filtered by brand id (product_brand term)
export async function getProductsByBrand(brandId: number, page = 1, per_page = 10): Promise<Product[]> {
  try {
    const { data } = await api.get('products', {
      brand: brandId,
      per_page,
      page,
      status: 'publish',
    });
    return data as Product[];
  } catch (error) {
    console.error(`Error fetching products for brand ${brandId}:`, error);
    return [];
  }
}

// Fetch products filtered by both category and brand
export async function getProductsByCategoryAndBrand(categoryId: number, brandId: number, page = 1, per_page = 10): Promise<{ products: Product[], total: number }> {
  try {
    const response = await api.get('products', {
      category: categoryId,
      brand: brandId,
      per_page,
      page,
      status: 'publish',
    });

    const products = response.data as Product[];
    const total = parseInt((response.headers as Record<string, string>)['x-wp-total'] || '0', 10);

    return { products, total };
  } catch (error) {
    console.error(`Error fetching products for category ${categoryId} and brand ${brandId}:`, error);
    return { products: [], total: 0 };
  }
}

// Fetch products filtered by both category slug and brand slug
export async function getProductsByCategorySlugAndBrandSlug(categorySlug: string, brandSlug: string, page = 1, per_page = 10): Promise<{ products: Product[], total: number }> {
  try {
    const [category, brand] = await Promise.all([
      getCategoryBySlug(categorySlug),
      getBrandBySlug(brandSlug)
    ]);

    if (!category) {
      console.error(`Category with slug ${categorySlug} not found`);
      return { products: [], total: 0 };
    }

    if (!brand) {
      console.error(`Brand with slug ${brandSlug} not found`);
      return { products: [], total: 0 };
    }

    return await getProductsByCategoryAndBrand(category.id, brand.id, page, per_page);
  } catch (error) {
    console.error(`Error fetching products for category slug ${categorySlug} and brand slug ${brandSlug}:`, error);
    return { products: [], total: 0 };
  }
}

// Fetch products filtered by category slug and multiple brand slugs
export async function getProductsByCategorySlugAndBrandSlugs(categorySlug: string, brandSlugs: string[], page = 1, per_page = 10): Promise<{ products: Product[], total: number }> {
  try {
    if (brandSlugs.length === 0) {
      // If no brands selected, return products from category only
      const products = await getProductsByCategorySlug(categorySlug, page, per_page);
      return { products, total: products.length };
    }

    // Get category and all brands
    const category = await getCategoryBySlug(categorySlug);
    if (!category) {
      console.error(`Category with slug ${categorySlug} not found`);
      return { products: [], total: 0 };
    }

    const brands = await Promise.all(
      brandSlugs.map(slug => getBrandBySlug(slug))
    );

    const validBrands = brands.filter(brand => brand !== null) as Brand[];
    if (validBrands.length === 0) {
      console.error('No valid brands found');
      return { products: [], total: 0 };
    }

    // Get products for each brand in the category and merge them
    const allProducts: Product[] = [];
    const productIds = new Set<number>();

    for (const brand of validBrands) {
      const { products } = await getProductsByCategoryAndBrand(category.id, brand.id, 1, 100);
      products.forEach(product => {
        if (!productIds.has(product.id)) {
          productIds.add(product.id);
          allProducts.push(product);
        }
      });
    }

    // Apply pagination
    const startIndex = (page - 1) * per_page;
    const endIndex = startIndex + per_page;
    const paginatedProducts = allProducts.slice(startIndex, endIndex);

    return { products: paginatedProducts, total: allProducts.length };
  } catch (error) {
    console.error(`Error fetching products for category slug ${categorySlug} and brand slugs ${brandSlugs.join(', ')}:`, error);
    return { products: [], total: 0 };
  }
}


export async function getProductsByBrandSlug(brandSlug: string, page = 1, per_page = 10): Promise<{ products: Product[], total: number }> {
  try {
    const brand = await getBrandBySlug(brandSlug);
    if (!brand) return { products: [], total: 0 };
    
    const response = await api.get('products', {
      brand: brand.id,
      per_page,
      page,
      status: 'publish',
    });
    
    const products = response.data as Product[];
    const total = parseInt((response.headers as Record<string, string>)['x-wp-total'] || '0', 10);
    
    return { products, total };
  } catch (error) {
    console.error(`Error fetching products for brand slug ${brandSlug}:`, error);
    return { products: [], total: 0 };
  }
}

// Funzione per normalizzare caratteri accentati per la ricerca
function normalizeSearchTerm(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // Decompone i caratteri accentati
    .replace(/[\u0300-\u036f]/g, '') // Rimuove i segni diacritici
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ýÿ]/g, 'y')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .trim();
}

// Search products (only in product titles)
export async function searchProducts(searchTerm: string, page = 1, per_page = 10): Promise<{ products: Product[], total: number }> {
  try {
    const { data, headers } = await api.get('products', {
      search: searchTerm,
      per_page: per_page,
      page: page,
      status: 'publish', // Include solo i prodotti pubblicati, esclude privati e bozze
    });

    const totalProducts = parseInt((headers as Record<string, string>)['x-wp-total']) || (data as Product[]).length;

    // Normalizza il termine di ricerca
    const normalizedSearchTerm = normalizeSearchTerm(searchTerm);

    // Filtriamo solo i prodotti il cui nome contiene il termine di ricerca (con normalizzazione)
    const filteredProducts = (data as Product[]).filter(product => {
      const normalizedProductName = normalizeSearchTerm(product.name);
      return normalizedProductName.includes(normalizedSearchTerm);
    });

    return {
      products: filteredProducts,
      total: totalProducts
    };
  } catch (error) {
    console.error(`Error searching products with term "${searchTerm}":`, error);
    return { products: [], total: 0 };
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
    
    
    // Prepariamo i dati dell'ordine con il customer_id esplicito
    // IMPORTANTE: Rispettiamo il customer_id se già presente in orderData
    const rawDataToSend = {
      ...orderData,
      // Impostiamo customer_id solo se non è già presente
      customer_id: orderData.customer_id || userId
    };
    


    // Convertiamo in un oggetto semplice per evitare problemi di serializzazione
    const orderDataToSend = JSON.parse(JSON.stringify(rawDataToSend));



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
    

    
    // Usa sempre l'endpoint standard WooCommerce per tutti gli ordini

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
 * @param {number} userId - ID dell'utente (opzionale)
 * @returns {Promise<{discount: number, items: CartItem[]}>} - Lo sconto applicato e gli articoli aggiornati
 */
export async function applyCoupon(code: string, cartItems: CartItem[], userId?: number) {
  try {
    const response = await fetch('/api/coupons/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        items: cartItems,
        userId
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Errore nell\'applicazione del coupon');
    }

    return await response.json();
  } catch (error) {
    // Non loggare errori attesi (coupon non valido, scaduto, ecc.)
    // Il messaggio verrà mostrato all'utente tramite couponError
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

// Interfaccia per gli elementi del carrello per il calcolo della spedizione
interface CartItemForShipping {
  product_id: number;
  quantity: number;
  variation_id?: number;
  shipping_class_id?: number;
}

/**
 * Recupera i metodi di spedizione disponibili per un indirizzo e un totale carrello
 * @param {ShippingAddress} shippingAddress - Indirizzo di spedizione
 * @param {number} cartTotal - Totale del carrello
 * @param {CartItemForShipping[]} cartItems - Prodotti nel carrello (opzionale)
 * @returns {Promise<ShippingMethod[]>} - Lista dei metodi di spedizione disponibili
 */
export async function getShippingMethods(shippingAddress: ShippingAddress, cartTotal: number, cartItems?: CartItemForShipping[]): Promise<ShippingMethod[]> {
  try {
    // Verifica che l'indirizzo sia valido
    if (!shippingAddress || !shippingAddress.country) {
      return [{
        id: 'flat_rate',
        title: 'Spedizione standard',
        description: 'Consegna in 3-5 giorni lavorativi',
        cost: 7.00
      }];
    }
    
    
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
          cart_items: cartItems || [],
          _timestamp: timestamp
        })
      });
      
      if (!response.ok) {
        throw new Error('Errore nella risposta dell\'API dei metodi di spedizione');
      }
      
      const data = await response.json();
      
      if (data && Array.isArray(data.methods)) {
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
      return 5.99; // Valore predefinito
    }
    
    
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
        return fallbackCost;
      }
      
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
 * Ottiene i prodotti più venduti del mese usando l'endpoint DreamShop
 * @param limit - Numero di prodotti da restituire (default: 4)
 * @returns Promise<Product[]> - Array di prodotti più venduti
 */
export async function getBestSellingProducts(limit: number = 4): Promise<Product[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';
    // Richiediamo più prodotti per compensare quelli non disponibili
    const bestSellingUrl = `${baseUrl}/wp-json/dreamshop/v1/products/best-selling?limit=${limit * 2}`;


    const response = await fetch(bestSellingUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.data?.products) {
      // Convert plugin response to Product format
      // No need to filter by stock_status - already filtered on server side
      return data.data.products.map((product: DreamShopProduct) => ({
        id: typeof product.id === 'string' ? parseInt(product.id) : product.id,
        name: product.name,
        slug: product.slug,
        permalink: product.permalink,
        price: product.price,
        regular_price: product.regular_price,
        sale_price: product.sale_price,
        on_sale: product.on_sale,
        date_on_sale_from: product.date_on_sale_from,
        date_on_sale_to: product.date_on_sale_to,
        stock_status: product.stock_status,
        short_description: product.short_description,
        images: product.images || [],
        categories: product.categories || [],
        attributes: product.attributes || [],
        sales_count: product.sales_count || 0,
        has_deposit_option: product.has_deposit_option
      }));
    }

    return [];
  } catch (error) {
    console.error('Errore nel recupero dei prodotti più venduti:', error);
    // Fallback to original API if plugin endpoint fails
    try {
      const response = await api.get('products', {
        per_page: limit,
        orderby: 'popularity',
        status: 'publish',
        stock_status: 'instock'
      });
      return response.data as Product[];
    } catch (fallbackError) {
      console.error('Errore anche nel fallback:', fallbackError);
      return [];
    }
  }
}

/**
 * Ottiene i prodotti correlati usando l'endpoint DreamShop
 * @param productSlug - Slug del prodotto corrente
 * @param limit - Numero di prodotti da restituire (default: 4)
 * @returns Promise<Product[]> - Array di prodotti correlati
 */
export async function getRelatedProductsBySlug(productSlug: string, limit: number = 8): Promise<Product[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';
    const relatedUrl = `${baseUrl}/wp-json/dreamshop/v1/products/${productSlug}/related?limit=${limit}`;


    const response = await fetch(relatedUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.data?.related_products) {
      // Convert plugin response to Product format and filter only in stock products
      return data.data.related_products
        .filter((product: DreamShopProduct) => product.stock_status === 'instock')
        .map((product: DreamShopProduct) => ({
          id: typeof product.id === 'string' ? parseInt(product.id) : product.id,
          name: product.name,
          slug: product.slug,
          permalink: product.permalink,
          price: product.price,
          regular_price: product.regular_price,
          sale_price: product.sale_price,
          on_sale: product.on_sale,
          date_on_sale_from: product.date_on_sale_from,
          date_on_sale_to: product.date_on_sale_to,
          stock_status: product.stock_status,
          short_description: product.short_description,
          images: product.images || [],
          categories: product.categories || [],
          attributes: product.attributes || [],
          has_deposit_option: product.has_deposit_option
        }));
    }

    return [];
  } catch (error) {
    const is404 = error instanceof Error && error.message.includes('status: 404');

    if (is404) {
      console.warn(`[RELATED-PRODUCTS] Prodotto non trovato dal plugin - slug: "${productSlug}" - Usando fallback WooCommerce API`);
    } else {
      console.error('Errore nel recupero dei prodotti correlati dal plugin:', error);
    }

    return [];
  }
}

/**
 * Ottiene i prodotti correlati basati sulla categoria (manteniamo per retrocompatibilità)
 * @param productId - ID del prodotto corrente
 * @param categoryIds - Array di ID delle categorie del prodotto
 * @param limit - Numero di prodotti da restituire (default: 4)
 * @returns Promise<Product[]> - Array di prodotti correlati
 */
export async function getRelatedProducts(productId: number, categoryIds: number[], limit: number = 8): Promise<Product[]> {
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
    
    // Shipping options based on separate WooCommerce attributes (not options within attributes)
    const shippingOptions = [
      { id: 1, name: 'Spedizione dall\'Italia in 4 giorni', slug: 'spedizione-in-4-giorni', count: 800 },
      { id: 2, name: 'Spedizione dall\'Oriente in 15 giorni', slug: 'spedizione-in-15-giorni', count: 1200 },
      { id: 3, name: 'Spedizione in 60 giorni', slug: 'spedizione-in-60-giorni', count: 300 }
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

// Calculate price range from products array
export function calculatePriceRange(products: Product[]): { min: number; max: number } {
  if (products.length === 0) {
    return { min: 0, max: 100 };
  }

  let minPrice = Infinity;
  let maxPrice = 0;

  products.forEach(product => {
    // Use sale price if available, otherwise regular price
    let price = 0;
    if (product.sale_price && parseFloat(product.sale_price) > 0) {
      price = parseFloat(product.sale_price);
    } else if (product.regular_price && parseFloat(product.regular_price) > 0) {
      price = parseFloat(product.regular_price);
    } else if (product.price && parseFloat(product.price) > 0) {
      price = parseFloat(product.price);
    }

    if (price > 0) {
      minPrice = Math.min(minPrice, price);
      maxPrice = Math.max(maxPrice, price);
    }
  });

  // If no valid prices found, return default range
  if (minPrice === Infinity) {
    return { min: 0, max: 100 };
  }

  // Round to nearest integers
  return {
    min: Math.floor(minPrice),
    max: Math.ceil(maxPrice)
  };
}

// Filter products by price range (kept for compatibility)
export function filterProductsByPrice(products: Product[], priceRange: { min: number; max: number }): Product[] {
  return products.filter(product => {
    // Use sale price if available, otherwise regular price
    let price = 0;
    if (product.sale_price && parseFloat(product.sale_price) > 0) {
      price = parseFloat(product.sale_price);
    } else if (product.regular_price && parseFloat(product.regular_price) > 0) {
      price = parseFloat(product.regular_price);
    } else if (product.price && parseFloat(product.price) > 0) {
      price = parseFloat(product.price);
    }

    return price >= priceRange.min && price <= priceRange.max;
  });
}

// Get price range for specific brands
export async function getPriceRangeByBrands(brandSlugs: string[]): Promise<{ min: number, max: number }> {
  try {
    if (brandSlugs.length === 0) {
      return await getPriceRange(); // Fallback to global range
    }


    // Get brand IDs
    const brandIds: number[] = [];
    for (const slug of brandSlugs) {
      const brand = await getBrandBySlug(slug);
      if (brand) {
        brandIds.push(brand.id);
      }
    }

    if (brandIds.length === 0) {
      return { min: 0, max: 1000 }; // Default range if no brands found
    }

    // Use WordPress API to get ALL product IDs for these brands
    const allProductIds: number[] = [];
    let wpPage = 1;

    while (true) {
      try {
        const wpResponse = await wpApi.get('product', {
          params: {
            product_brand: brandIds.join(','),
            per_page: 100,
            page: wpPage,
            _fields: 'id'
          }
        });

        const products = wpResponse.data as Array<{ id: number }>;
        if (products.length === 0) break;

        allProductIds.push(...products.map(p => p.id));
        if (products.length < 100) break;
        wpPage++;

        // Safety limit
        if (wpPage > 20) break;
      } catch (error) {
        console.error('WordPress API failed for price range, using fallback:', error);
        return await getPriceRange();
      }
    }

    if (allProductIds.length === 0) {
      return { min: 0, max: 1000 };
    }


    // Get actual products in batches to calculate price range
    let minPrice = Infinity;
    let maxPrice = 0;
    const batchSize = 100;

    for (let i = 0; i < allProductIds.length; i += batchSize) {
      const batchIds = allProductIds.slice(i, i + batchSize);

      const response = await api.get('products', {
        include: batchIds.join(','),
        per_page: batchSize,
        status: 'publish'
      });

      const products = response.data as Array<{ price: string }>;

      products.forEach(product => {
        const price = parseFloat(product.price) || 0;
        if (price > 0) {
          minPrice = Math.min(minPrice, price);
          maxPrice = Math.max(maxPrice, price);
        }
      });
    }

    // If no valid prices found, return default
    if (minPrice === Infinity) {
      return { min: 0, max: 1000 };
    }

    const result = {
      min: Math.floor(minPrice),
      max: Math.ceil(maxPrice)
    };

    return result;

  } catch (error) {
    console.error('Error calculating price range for brands:', error);
    return await getPriceRange(); // Fallback to global range
  }
}

// Get price range from server (more efficient than client-side calculation)
export async function getPriceRange(): Promise<{ min: number; max: number }> {
  try {
    // Get lowest price product
    const lowestPriceResponse = await api.get('products', {
      per_page: 1,
      page: 1,
      status: 'publish',
      orderby: 'price',
      order: 'asc'
    });

    // Get highest price product
    const highestPriceResponse = await api.get('products', {
      per_page: 1,
      page: 1,
      status: 'publish',
      orderby: 'price',
      order: 'desc'
    });

    const lowestProduct = (lowestPriceResponse.data as Product[])[0];
    const highestProduct = (highestPriceResponse.data as Product[])[0];

    let minPrice = 0;
    let maxPrice = 100;

    // Get minimum price
    if (lowestProduct) {
      if (lowestProduct.sale_price && parseFloat(lowestProduct.sale_price) > 0) {
        minPrice = parseFloat(lowestProduct.sale_price);
      } else if (lowestProduct.regular_price && parseFloat(lowestProduct.regular_price) > 0) {
        minPrice = parseFloat(lowestProduct.regular_price);
      } else if (lowestProduct.price && parseFloat(lowestProduct.price) > 0) {
        minPrice = parseFloat(lowestProduct.price);
      }
    }

    // Get maximum price
    if (highestProduct) {
      if (highestProduct.sale_price && parseFloat(highestProduct.sale_price) > 0) {
        maxPrice = parseFloat(highestProduct.sale_price);
      } else if (highestProduct.regular_price && parseFloat(highestProduct.regular_price) > 0) {
        maxPrice = parseFloat(highestProduct.regular_price);
      } else if (highestProduct.price && parseFloat(highestProduct.price) > 0) {
        maxPrice = parseFloat(highestProduct.price);
      }
    }

    return {
      min: Math.floor(minPrice),
      max: Math.ceil(maxPrice)
    };
  } catch (error) {
    console.error('Error fetching price range:', error);
    return { min: 0, max: 100 };
  }
}

// Get price range for a specific category by slug
export async function getPriceRangeByCategory(categorySlug: string): Promise<{ min: number; max: number }> {
  try {
    // First get the category ID
    const category = await getCategoryBySlug(categorySlug);
    if (!category) {
      console.error(`Category not found for slug: ${categorySlug}`);
      return { min: 0, max: 100 };
    }

    // Get all products in this category (we need to fetch them all to get accurate price range)
    // Since WooCommerce's price ordering is unreliable, we'll get all products and calculate client-side
    let allProducts: Product[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await api.get('products', {
        per_page: perPage,
        page: page,
        status: 'publish',
        category: category.id
      });

      const products = response.data as Product[];
      allProducts = [...allProducts, ...products];

      // Check if there are more pages
      hasMore = products.length === perPage;
      page++;

      // Safety limit to prevent infinite loops
      if (page > 20) break;
    }

    if (allProducts.length === 0) {
      return { min: 0, max: 100 };
    }

    // Calculate min and max prices client-side
    const prices: number[] = [];

    allProducts.forEach(product => {
      let productPrice = 0;

      // Use the most appropriate price (sale price if available, otherwise regular price, otherwise price)
      if (product.sale_price && parseFloat(product.sale_price) > 0) {
        productPrice = parseFloat(product.sale_price);
      } else if (product.regular_price && parseFloat(product.regular_price) > 0) {
        productPrice = parseFloat(product.regular_price);
      } else if (product.price && parseFloat(product.price) > 0) {
        productPrice = parseFloat(product.price);
      }

      if (productPrice > 0) {
        prices.push(productPrice);
      }
    });

    if (prices.length === 0) {
      return { min: 0, max: 100 };
    }

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);


    return {
      min: Math.floor(minPrice),
      max: Math.ceil(maxPrice)
    };
  } catch (error) {
    console.error(`Error fetching price range for category ${categorySlug}:`, error);
    return { min: 0, max: 100 };
  }
}

// Get price range for a specific category and brand combination
export async function getPriceRangeByCategoryAndBrands(categorySlug: string, brandSlugs: string[]): Promise<{ min: number; max: number }> {
  try {
    // If no brands selected, use category-only range
    if (brandSlugs.length === 0) {
      return await getPriceRangeByCategory(categorySlug);
    }

    // Get category ID
    const category = await getCategoryBySlug(categorySlug);
    if (!category) {
      console.error(`Category not found for slug: ${categorySlug}`);
      return { min: 0, max: 100 };
    }

    // Get brand IDs
    const brands = await Promise.all(
      brandSlugs.map(slug => getBrandBySlug(slug))
    );
    const validBrands = brands.filter(brand => brand !== null) as Brand[];

    if (validBrands.length === 0) {
      console.error('No valid brands found');
      return await getPriceRangeByCategory(categorySlug);
    }

    // Get all products for this category and brands combination
    let allProducts: Product[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await api.get('products', {
        per_page: perPage,
        page: page,
        status: 'publish',
        category: category.id
      });

      const products = response.data as Product[];

      // Filter products by selected brands (client-side filtering using taxonomy brands)
      const filteredProducts = products.filter(product => {
        // Use taxonomy brands from API instead of meta_data
        if (!product.brands || product.brands.length === 0) return false;

        // Check if any of the product's brands match the selected brand slugs
        const productBrandSlugs = product.brands.map(brand => brand.slug);
        const hasMatchingBrand = productBrandSlugs.some(slug => brandSlugs.includes(slug));


        return hasMatchingBrand;
      });

      allProducts = [...allProducts, ...filteredProducts];

      // Check if there are more pages
      hasMore = products.length === perPage;
      page++;

      // Safety limit to prevent infinite loops
      if (page > 20) break;
    }

    if (allProducts.length === 0) {
      return { min: 0, max: 100 };
    }

    // Calculate min and max prices client-side
    const prices: number[] = [];

    allProducts.forEach(product => {
      let productPrice = 0;

      // Use the most appropriate price (sale price if available, otherwise regular price, otherwise price)
      if (product.sale_price && parseFloat(product.sale_price) > 0) {
        productPrice = parseFloat(product.sale_price);
      } else if (product.regular_price && parseFloat(product.regular_price) > 0) {
        productPrice = parseFloat(product.regular_price);
      } else if (product.price && parseFloat(product.price) > 0) {
        productPrice = parseFloat(product.price);
      }

      if (productPrice > 0) {
        prices.push(productPrice);
      }
    });

    if (prices.length === 0) {
      return { min: 0, max: 100 };
    }

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);


    return {
      min: Math.floor(minPrice),
      max: Math.ceil(maxPrice)
    };
  } catch (error) {
    console.error(`Error fetching price range for category ${categorySlug} and brands ${brandSlugs.join(', ')}:`, error);
    return { min: 0, max: 100 };
  }
}

// Get products for a specific category and brand combination with pagination
export async function getProductsByCategorySlugAndBrandsWithTotal(
  categorySlug: string,
  brandSlugs: string[],
  page = 1,
  per_page = 10,
  orderby = 'date',
  order = 'desc',
  min_price?: number,
  max_price?: number
): Promise<{ products: Product[], total: number }> {
  try {
    // If no brands selected, use category-only query
    if (brandSlugs.length === 0) {
      return await getProductsByCategorySlugWithTotal(categorySlug, page, per_page, orderby, order, min_price, max_price);
    }

    // Get category ID
    const category = await getCategoryBySlug(categorySlug);
    if (!category) {
      console.error(`Category not found for slug: ${categorySlug}`);
      return { products: [], total: 0 };
    }

    // Get all products for this category (we need all to filter by brands)
    let allProducts: Product[] = [];
    let apiPage = 1;
    const apiPerPage = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await api.get('products', {
        per_page: apiPerPage,
        page: apiPage,
        status: 'publish',
        category: category.id
      });

      const products = response.data as Product[];

      // Filter products by selected brands (client-side filtering using taxonomy brands)
      const filteredProducts = products.filter(product => {
        // Use taxonomy brands from API instead of meta_data
        if (!product.brands || product.brands.length === 0) return false;

        // Check if any of the product's brands match the selected brand slugs
        const productBrandSlugs = product.brands.map(brand => brand.slug);
        const hasMatchingBrand = productBrandSlugs.some(slug => brandSlugs.includes(slug));


        return hasMatchingBrand;
      });

      allProducts = [...allProducts, ...filteredProducts];

      // Check if there are more pages
      hasMore = products.length === apiPerPage;
      apiPage++;

      // Safety limit to prevent infinite loops
      if (apiPage > 20) break;
    }

    // Apply price filtering if specified
    if (min_price !== undefined || max_price !== undefined) {
      allProducts = allProducts.filter(product => {
        const productPrice = parseFloat(product.price) || 0;

        if (min_price !== undefined && productPrice < min_price) return false;
        if (max_price !== undefined && productPrice > max_price) return false;

        return true;
      });
    }


    // Apply pagination to filtered results
    const startIndex = (page - 1) * per_page;
    const endIndex = startIndex + per_page;
    const paginatedProducts = allProducts.slice(startIndex, endIndex);

    return {
      products: paginatedProducts,
      total: allProducts.length
    };
  } catch (error) {
    console.error(`Error fetching products for category ${categorySlug} and brands ${brandSlugs.join(', ')}:`, error);
    return { products: [], total: 0 };
  }
}

// Get products filtered by multiple brand slugs only (with price filtering support)
export async function getProductsByBrandSlugs(
  brandSlugs: string[],
  page = 1,
  per_page = 10,
  orderby = 'date',
  order = 'desc',
  min_price?: number,
  max_price?: number
): Promise<{ products: Product[], total: number }> {
  // Create cache key for deduplication
  const cacheKey = JSON.stringify({ brandSlugs: brandSlugs.sort(), page, per_page, orderby, order, min_price, max_price });

  // Check if we already have this request in progress
  if (requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey)!;
  }

  const requestId = Math.random().toString(36).substr(2, 9);

  // Create the promise and cache it
  const requestPromise = (async (): Promise<{ products: Product[], total: number }> => {
  try {
    if (brandSlugs.length === 0) {
      // If no brands selected, return all products with price filter
      return await getProducts(page, per_page, orderby, order, min_price, max_price);
    }


    // Step 1: Get brand IDs from slugs
    const brandIds: number[] = [];
    for (const slug of brandSlugs) {
      const brand = await getBrandBySlug(slug);
      if (brand) {
        brandIds.push(brand.id);
      }
    }

    if (brandIds.length === 0) {
      return { products: [], total: 0 };
    }


    // Step 2: Use WordPress API to get product IDs filtered by brands
    const allProductIds: number[] = [];

    try {
      let wpPage = 1;
      const wpPerPage = 100; // Get more IDs per request

      while (true) {
        const wpResponse = await wpApi.get('product', {
          params: {
            product_brand: brandIds.join(','),
            per_page: wpPerPage,
            page: wpPage,
            _fields: 'id' // Only get IDs to save bandwidth
          }
        });

        const products = wpResponse.data as Array<{ id: number }>;

        if (products.length === 0) break;

        allProductIds.push(...products.map(p => p.id));

        if (products.length < wpPerPage) break; // Last page
        wpPage++;

        // Safety limit
        if (wpPage > 10) break;
      }
    } catch (wpError) {
      console.error('❌ WordPress API failed:', wpError);

      // Fallback to simple WooCommerce filtering with limited pages
      return await getProductsManuallyFilteredByBrand(brandSlugs, page, per_page, min_price, max_price);
    }


    if (allProductIds.length === 0) {
      return { products: [], total: 0 };
    }

    // Step 3: Apply pagination to product IDs
    const startIndex = (page - 1) * per_page;
    const endIndex = startIndex + per_page;
    const paginatedIds = allProductIds.slice(startIndex, endIndex);


    // Step 4: Get actual product data from WooCommerce API
    // IMPORTANT: Don't add price filters here if we have them, because it breaks pagination
    const params: {
      include: string;
      per_page: number;
      orderby: string;
      order: string;
      status: string;
    } = {
      include: paginatedIds.join(','),
      per_page,
      orderby,
      order,
      status: 'publish'
    };

    const response = await api.get('products', params);
    let products = response.data as Product[];

    // Step 5: Smart price filtering with pagination recovery
    if (min_price !== undefined || max_price !== undefined) {
      products = products.filter(product => {
        const productPrice = parseFloat(product.price) || 0;
        if (min_price !== undefined && productPrice < min_price) return false;
        if (max_price !== undefined && productPrice > max_price) return false;
        return true;
      });


      // If we got 0 products, try to search more aggressively
      if (products.length === 0 && allProductIds.length > endIndex) {

        let searchOffset = endIndex;
        const maxSearchAttempts = 3;
        let attemptCount = 0;

        while (products.length === 0 && attemptCount < maxSearchAttempts && searchOffset < allProductIds.length) {
          attemptCount++;
          const batchSize = Math.min(50, allProductIds.length - searchOffset);
          const searchIds = allProductIds.slice(searchOffset, searchOffset + batchSize);

          if (searchIds.length === 0) break;


          const searchParams = {
            include: searchIds.join(','),
            per_page: batchSize,
            orderby,
            order,
            status: 'publish'
          };

          const searchResponse = await api.get('products', searchParams);
          const candidateProducts = (searchResponse.data as Product[]).filter(product => {
            const productPrice = parseFloat(product.price) || 0;
            if (min_price !== undefined && productPrice < min_price) return false;
            if (max_price !== undefined && productPrice > max_price) return false;
            return true;
          });

          if (candidateProducts.length > 0) {
            products = candidateProducts.slice(0, per_page);
            break;
          }

          searchOffset += batchSize;
        }

        // If still no products after aggressive search
        if (products.length === 0) {
        }
      }
    }

    // Calculate accurate total when price filters are applied
    let finalTotal = allProductIds.length; // Default: use total from brand filtering

    if (min_price !== undefined || max_price !== undefined) {

      // Calculate accurate total using batching approach

      try {
        let allFilteredProducts = 0;
        let batchStart = 0;
        const batchSize = 100;

        while (batchStart < allProductIds.length) {
          const batchIds = allProductIds.slice(batchStart, batchStart + batchSize);
          const batchParams = {
            include: batchIds.join(','),
            per_page: batchSize,
            status: 'publish'
          };

          const batchResponse = await api.get('products', batchParams);
          const batchProducts = batchResponse.data as Product[];

          const filteredCount = batchProducts.filter(product => {
            const productPrice = parseFloat(product.price) || 0;
            if (min_price !== undefined && productPrice < min_price) return false;
            if (max_price !== undefined && productPrice > max_price) return false;
            return true;
          }).length;


          allFilteredProducts += filteredCount;
          batchStart += batchSize;
        }

        finalTotal = allFilteredProducts;
      } catch (error) {
        console.error(`⚠️ [${requestId}] Error calculating accurate total, using brand total:`, error);
        finalTotal = allProductIds.length;
      }
    }


    return {
      products,
      total: finalTotal
    };

  } catch (error) {
    console.error(`❌ [${requestId}] Error fetching products for brands ${brandSlugs.join(', ')}:`, error);
    return { products: [], total: 0 };
  }
  })();

  // Cache the request
  requestCache.set(cacheKey, requestPromise);

  // Clear cache after request completes (success or failure)
  requestPromise.finally(() => {
    setTimeout(() => requestCache.delete(cacheKey), 1000); // Keep cache for 1 second
  });

  return requestPromise;
}

// Simple fallback function for when WordPress API fails
async function getProductsManuallyFilteredByBrand(
  brandSlugs: string[],
  page: number,
  per_page: number,
  min_price?: number,
  max_price?: number
): Promise<{ products: Product[], total: number }> {

  // Get a reasonable number of products and filter manually
  const maxPages = 3; // Limit to prevent timeout
  const allMatchingProducts: Product[] = [];

  for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
    const params: {
      per_page: number;
      page: number;
      status: string;
      min_price?: number;
      max_price?: number;
    } = {
      per_page: 50,
      page: currentPage,
      status: 'publish'
    };

    // Add price filters to reduce server load
    if (min_price !== undefined) params.min_price = min_price;
    if (max_price !== undefined) params.max_price = max_price;

    const response = await api.get('products', params);
    const products = response.data as Product[];

    if (products.length === 0) break;

    // Filter by brands client-side
    const matchingProducts = products.filter(product => {
      const productBrandSlugs = product.brands?.map(brand => brand.slug) || [];
      return productBrandSlugs.some(slug => brandSlugs.includes(slug));
    });

    allMatchingProducts.push(...matchingProducts);


    // Stop early if we have enough results
    if (allMatchingProducts.length >= page * per_page) break;
  }

  // Apply pagination
  const startIndex = (page - 1) * per_page;
  const endIndex = startIndex + per_page;
  const paginatedProducts = allMatchingProducts.slice(startIndex, endIndex);


  return {
    products: paginatedProducts,
    total: allMatchingProducts.length
  };
}


// Get most popular/best selling products using reports endpoint (more accurate)
export async function getMostPopularProducts(per_page = 5): Promise<Product[]> {
  try {
    // First, try to get top sellers from reports endpoint
    try {
      const topSellersResponse = await api.get('reports/top_sellers', {
        period: 'year', // Same as the WP admin report
        per_page: per_page * 2 // Get more to filter available ones
      });

      if (topSellersResponse.data && Array.isArray(topSellersResponse.data)) {
        // Get the product IDs from top sellers report
        const topSellerIds = topSellersResponse.data.map((item: TopSellerReportItem) => item.product_id);

        // Fetch full product details for these IDs
        const productPromises = topSellerIds.slice(0, per_page * 2).map((id: number) =>
          api.get(`products/${id}`).catch(() => null)
        );

        const productResponses = await Promise.all(productPromises);
        const products = productResponses
          .filter(response => response?.data)
          .map(response => response!.data as Product)
          .filter(product => product.stock_status === 'instock')
          .slice(0, per_page);

        if (products.length > 0) {
          return products;
        }
      }
    } catch {
    }

    // Fallback to popularity ordering
    const response = await api.get('products', {
      orderby: 'popularity',
      order: 'desc',
      per_page: per_page * 2,
      status: 'publish'
    });

    const products = (response.data as Product[]).filter(product => product.stock_status === 'instock').slice(0, per_page);
    return products;
  } catch (error) {
    console.error('Error fetching most popular products:', error);
    return [];
  }
}

/**
 * Test the new plugin debug endpoint
 */
export async function testPluginDebugEndpoint(productId: number) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';
    const debugUrl = `${baseUrl}/wp-json/dreamshop/v1/debug/product/${productId}`;


    const response = await fetch(debugUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    
    return data;
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    throw error;
  }
}

interface PluginFilterParams {
  category?: string;
  brands?: string;
  availability?: string;
  shipping?: string;
  min_price?: number;
  max_price?: number;
  page?: number;
  per_page?: number;
}

/**
 * NEW PLUGIN API - Get filtered products using the advanced filters plugin
 */
export async function getFilteredProductsPlugin(filters: {
  category?: string;
  brands?: string[];
  availability?: string[];
  shipping?: string[];
  min_price?: number;
  max_price?: number;
  exclude_sold_out?: boolean;
  on_sale?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
  orderby?: string;
  order?: string;
}): Promise<{ products: Product[], total: number, total_pages: number }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';

    // Build query parameters
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.brands && filters.brands.length > 0) params.append('brands', filters.brands.join(','));
    if (filters.availability && filters.availability.length > 0) params.append('availability', filters.availability.join(','));
    if (filters.shipping && filters.shipping.length > 0) params.append('shipping', filters.shipping.join(','));
    if (filters.min_price !== undefined) params.append('min_price', filters.min_price.toString());
    if (filters.max_price !== undefined) params.append('max_price', filters.max_price.toString());
    if (filters.exclude_sold_out) params.append('exclude_sold_out', 'true');
    if (filters.on_sale) params.append('on_sale', 'true');
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.per_page) params.append('per_page', filters.per_page.toString());
    if (filters.orderby) params.append('orderby', filters.orderby);
    if (filters.order) params.append('order', filters.order.toUpperCase()); // Plugin expects uppercase

    const filterUrl = `${baseUrl}/wp-json/dreamshop/v1/products/filter?${params.toString()}`;

    const response = await fetch(filterUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Plugin API error! status: ${response.status}. Response: ${errorText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Plugin API returned error');
    }

    // Convert plugin format to expected format
    const products: Product[] = data.data.products.map((product: {
      id: string;
      name: string;
      slug: string;
      price: string;
      regular_price: string;
      sale_price: string;
      on_sale: boolean;
      date_on_sale_from?: string;
      date_on_sale_to?: string;
      stock_status: string;
      images: Array<{ id: string; src: string; src_large: string; alt: string }>;
      permalink: string;
      short_description: string;
      attributes: PluginProductAttribute[];
      has_deposit_option?: boolean;
    }) => ({
      id: parseInt(product.id),
      name: product.name,
      slug: product.slug,
      price: product.price,
      regular_price: product.regular_price,
      sale_price: product.sale_price,
      on_sale: product.on_sale,
      date_on_sale_from: product.date_on_sale_from,
      date_on_sale_to: product.date_on_sale_to,
      stock_status: product.stock_status,
      images: product.images,
      permalink: product.permalink,
      short_description: product.short_description,
      has_deposit_option: product.has_deposit_option,
      // Add any missing fields with defaults
      description: '',
      categories: [],
      tags: [],
      attributes: product.attributes || [],
      variations: [],
      meta_data: []
    }));

    return {
      products,
      total: data.data.total,
      total_pages: data.data.total_pages
    };

  } catch (error) {
    console.error('❌ Plugin API error:', error);
    throw error;
  }
}

/**
 * NEW PLUGIN API - Get filter options (brands, categories, availability, shipping, price range)
 */
export async function getFilterOptionsPlugin(): Promise<{
  brands: Brand[];
  categories: ExtendedCategory[];
  availability: AttributeValue[];
  shipping_times: AttributeValue[];
  price_range: { min: number; max: number };
}> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';
    const optionsUrl = `${baseUrl}/wp-json/dreamshop/v1/filter-options`;


    const response = await fetch(optionsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Plugin API error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Plugin API returned error');
    }

    // Convert plugin format to expected format
    const brands: Brand[] = data.data.brands.map((brand: { id: number; name: string; slug: string; count: number }) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      count: brand.count
    }));

    const categories: ExtendedCategory[] = data.data.categories.map((category: { id: number; name: string; slug: string; count: number }) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      count: category.count,
      parent: 0,
      image: null,
      menu_order: 0,
      description: ''
    }));

    const availability: AttributeValue[] = data.data.availability.map((item: { id: number; name: string; slug: string; count: number }) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      count: item.count
    }));

    const shipping_times: AttributeValue[] = data.data.shipping_times.map((item: { id: number; name: string; slug: string; count: number }) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      count: item.count
    }));

    return {
      brands,
      categories,
      availability,
      shipping_times,
      price_range: data.data.price_range
    };

  } catch (error) {
    console.error('❌ Plugin filter options error:', error);
    throw error;
  }
}

/**
 * NEW PLUGIN API - Get filter options for specific category
 */
export async function getCategoryFilterOptionsPlugin(categorySlug: string): Promise<{
  brands: Brand[];
  categories: ExtendedCategory[];
  availability: AttributeValue[];
  shipping_times: AttributeValue[];
  price_range: { min: number; max: number };
}> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';
    const optionsUrl = `${baseUrl}/wp-json/dreamshop/v1/filter-options/${categorySlug}`;


    const response = await fetch(optionsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Plugin API error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Plugin API returned error');
    }

    // Convert plugin format to expected format
    const brands: Brand[] = data.data.brands.map((brand: { id: number; name: string; slug: string; count: number }) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      count: brand.count
    }));

    const categories: ExtendedCategory[] = data.data.categories.map((category: { id: number; name: string; slug: string; count: number }) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      count: category.count,
      parent: 0,
      image: null,
      children: [],
      menu_order: 0,
      description: ''
    }));

    const availability: AttributeValue[] = data.data.availability.map((item: { id: number; name: string; slug: string; count: number }) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      count: item.count
    }));

    const shipping_times: AttributeValue[] = data.data.shipping_times.map((item: { id: number; name: string; slug: string; count: number }) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      count: item.count
    }));


    return {
      brands,
      categories,
      availability,
      shipping_times,
      price_range: data.data.price_range
    };

  } catch (error) {
    console.error('❌ Error getting category filter options from plugin:', error);

    // Fallback to general filter options
    return await getFilterOptionsPlugin();
  }
}

/**
 * Test the new plugin filter endpoint
 */
export async function testPluginFilterEndpoint(filters: PluginFilterParams = {}) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';

    // Build query parameters
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.brands) params.append('brands', filters.brands);
    if (filters.availability) params.append('availability', filters.availability);
    if (filters.shipping) params.append('shipping', filters.shipping);
    if (filters.min_price) params.append('min_price', filters.min_price.toString());
    if (filters.max_price) params.append('max_price', filters.max_price.toString());
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.per_page) params.append('per_page', filters.per_page.toString());

    const filterUrl = `${baseUrl}/wp-json/dreamshop/v1/products/filter?${params.toString()}`;


    const response = await fetch(filterUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error('❌ Filter endpoint error:', error);
    throw error;
  }
}

/**
 * Get shipping class ID for a product using the DreamShop Filters plugin
 * This is used to ensure all products have shipping_class_id before checkout
 */
export async function getProductShippingClassId(productId: number): Promise<number> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';

    // Use the product details endpoint from the DreamShop plugin
    const filterUrl = `${baseUrl}/wp-json/dreamshop/v1/products/${productId}`;

    const response = await fetch(filterUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`Failed to get shipping class for product ${productId}`);
      return 0;
    }

    const result = await response.json();

    // The plugin returns { success: true, data: { shipping_class_id: ... } }
    if (result.success && result.data) {
      return result.data.shipping_class_id || 0;
    }

    return 0;
  } catch (error) {
    console.error(`Error fetching shipping class for product ${productId}:`, error);
    return 0;
  }
}
