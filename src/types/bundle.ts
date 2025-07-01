import { Product } from '@/lib/api';

// Definizione dei tipi personalizzati per sostituzione degli 'any'
type MetaValue = string | number | boolean | object | null;

interface BundleData {
  pricing_type?: string;
  discount?: string;
  discount_amount?: number;
  shipping_fee?: string;
  optional?: boolean;
  [key: string]: string | number | boolean | undefined;
}

interface BundledItem {
  id: string;
  quantity: number;
  price?: number;
  discount?: number;
  [key: string]: string | number | boolean | undefined;
}

interface BundledBy {
  product_id: number;
  [key: string]: string | number | boolean | object | undefined;
}

// Interfaccia per un singolo elemento del bundle
export interface BundleItem {
  id: string;       // ID del prodotto incluso nel bundle
  sku: string;      // SKU del prodotto incluso
  qty: string;      // Quantità del prodotto nel bundle
  min: string;      // Quantità minima (se configurabile)
  max: string;      // Quantità massima (se configurabile)
}

// Mappa degli elementi del bundle, dove la chiave è un identificatore univoco
export interface BundleItems {
  [key: string]: BundleItem;
}

// Metadati specifici del bundle che possono essere presenti nei meta_data
export interface BundleMetadata {
  woosb_ids?: string;           // IDs dei prodotti nel bundle in formato stringa
  woosb_products?: BundleItems; // Oggetto con i prodotti del bundle
  // Altri possibili campi di metadati del bundle
}

// Estensione dell'interfaccia Product per includere i campi dei bundle
export interface BundleProduct extends Product {
  meta_data?: Array<{
    key: string;
    value: MetaValue;
  }>;
  // Campi che potrebbero essere direttamente nell'oggetto prodotto
  woosb_ids?: string;
  woosb_products?: BundleItems;
  bundle_data?: BundleData;
  bundled_items?: BundledItem[];
  bundle_items?: BundledItem[];
  bundled_by?: BundledBy;
  bundled_item_ids?: string[];
}

// Funzione di utilità per verificare se un prodotto è un bundle
export function isBundle(product: Product): product is BundleProduct {
  // Verifica il tipo di prodotto (woosb è il tipo specifico per i bundle)
  if (product.type === 'woosb') {
    return true;
  }
  
  const bundleProduct = product as BundleProduct;
  
  // Verifica se il prodotto ha campi specifici dei bundle
  if (bundleProduct.woosb_ids || bundleProduct.woosb_products) {
    return true;
  }
  
  // Verifica nei metadati
  if (bundleProduct.meta_data) {
    return bundleProduct.meta_data.some(meta => 
      // Cerca specificamente la chiave woosb_ids che contiene i dati del bundle
      (meta.key === 'woosb_ids' && meta.value) ||
      // Fallback su altre possibili chiavi
      (meta.key === '_woosb_ids' && meta.value) ||
      (meta.key === 'woosb_products' && meta.value) ||
      (meta.key === '_woosb_products' && meta.value)
    );
  }
  
  return false;
}

// Funzione per estrarre i prodotti del bundle dai metadati o dai campi diretti
export function getBundleItems(product: BundleProduct): BundleItems | null {
  // Controlla se woosb_products è direttamente nell'oggetto prodotto
  if (product.woosb_products) {
    return product.woosb_products;
  }
  
  // Controlla nei metadati
  if (product.meta_data) {
    // Cerca prima woosb_ids che è il campo corretto in base alla struttura fornita
    const woosb_ids_meta = product.meta_data.find(meta => 
      meta.key === 'woosb_ids' || meta.key === '_woosb_ids'
    );
    
    if (woosb_ids_meta && woosb_ids_meta.value) {
      // Verifica che il valore sia effettivamente un oggetto BundleItems
      const value = woosb_ids_meta.value;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return value as BundleItems;
      }
    }
    
    // Fallback su altri possibili nomi di campo
    const woosb_products_meta = product.meta_data.find(meta => 
      meta.key === '_woosb_products' || meta.key === 'woosb_products'
    );
    
    if (woosb_products_meta && woosb_products_meta.value) {
      // Verifica che il valore sia effettivamente un oggetto BundleItems
      const value = woosb_products_meta.value;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return value as BundleItems;
      }
    }
  }
  
  return null;
}

// Funzione per ottenere gli ID dei prodotti nel bundle
export function getBundleProductIds(product: BundleProduct): string[] {
  const bundleItems = getBundleItems(product);
  
  if (bundleItems) {
    return Object.values(bundleItems).map(item => item.id);
  }
  
  return [];
}
