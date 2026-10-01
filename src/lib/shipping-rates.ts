import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';

// Calcolo delle tariffe di spedizione dalle zone WooCommerce. Solo lato server:
// usa le chiavi REST di WooCommerce.
//
// E' l'unica fonte del costo di spedizione: la usano sia /api/shipping/methods
// (checkout) sia i pagamenti Apple Pay / Google Pay, che ricalcolano qui la
// spedizione prima di addebitare invece di fidarsi dell'importo del browser.

const api = new WooCommerceRestApi({
  url: process.env.NEXT_PUBLIC_WORDPRESS_URL!,
  consumerKey: process.env.NEXT_PUBLIC_WC_CONSUMER_KEY!,
  consumerSecret: process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET!,
  version: "wc/v3",
});

export type ShippingAddressType = {
  first_name?: string;
  last_name?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country: string;
};

export interface ShippingCartItem {
  product_id: number;
  quantity: number;
  variation_id?: number;
  shipping_class_id?: number;
}

interface ShippingZone {
  id: number;
  name: string;
  order: number;
}

interface ShippingLocation {
  code: string;
  type: string;
}

interface ShippingMethod {
  id: number;
  method_id: string;
  title: string;
  enabled: boolean;
  settings: {
    cost?: {
      value: string;
    };
    requires?: {
      value: string;
    };
    min_amount?: {
      value: string;
    };
    type?: {
      value: string;
    };
    no_class_cost?: {
      value: string;
    };
    [key: string]: {
      value: string;
    } | unknown;
  };
}

export interface ShippingMethodResponse {
  id: string;
  title: string;
  description: string;
  cost: number;
  min_amount?: number;
  free_shipping?: boolean;
}

// Funzione per calcolare il costo di spedizione basato sulle classi
function calculateShippingCost(method: ShippingMethod, cartItems: ShippingCartItem[]): number {
  const baseCost = method.settings.cost ? parseFloat(method.settings.cost.value || '0') : 0;
  const calculationType = method.settings.type ? method.settings.type.value : 'class';

  // Se non ci sono prodotti nel carrello, usa il costo base
  if (!cartItems || cartItems.length === 0) {
    return baseCost;
  }

  // Se il tipo è 'class', trova il costo più alto tra le classi presenti
  // La spedizione viene calcolata solo 1 volta per ordine
  if (calculationType === 'class') {
    let maxCost = baseCost;

    for (const item of cartItems) {
      const shippingClassId = item.shipping_class_id || 0;
      let classCost = baseCost;

      // Cerca il costo specifico per questa classe
      if (shippingClassId > 0) {
        const classKey = `class_cost_${shippingClassId}`;
        const classSetting = method.settings[classKey] as { value: string } | undefined;
        if (classSetting && classSetting.value) {
          const classValue = classSetting.value;
          if (classValue && classValue !== '' && classValue !== 'N/A') {
            classCost = parseFloat(classValue);
          }
        }
      } else {
        // Usa il costo per "Nessuna classe di spedizione"
        if (method.settings.no_class_cost && method.settings.no_class_cost.value) {
          const noClassValue = method.settings.no_class_cost.value;
          if (noClassValue && noClassValue !== '' && noClassValue !== 'N/A') {
            classCost = parseFloat(noClassValue);
          }
        }
      }

      maxCost = Math.max(maxCost, classCost);
    }

    return maxCost;
  }

  // Se il tipo è 'order', trova la classe più costosa e applica una sola volta
  if (calculationType === 'order') {
    let maxCost = baseCost;

    for (const item of cartItems) {
      const shippingClassId = item.shipping_class_id || 0;
      let classCost = baseCost;

      if (shippingClassId > 0) {
        const classKey = `class_cost_${shippingClassId}`;
        const classSetting = method.settings[classKey] as { value: string } | undefined;
        if (classSetting && classSetting.value) {
          const classValue = classSetting.value;
          if (classValue && classValue !== '' && classValue !== 'N/A') {
            classCost = parseFloat(classValue);
          }
        }
      } else {
        if (method.settings.no_class_cost && method.settings.no_class_cost.value) {
          const noClassValue = method.settings.no_class_cost.value;
          if (noClassValue && noClassValue !== '' && noClassValue !== 'N/A') {
            classCost = parseFloat(noClassValue);
          }
        }
      }

      maxCost = Math.max(maxCost, classCost);
    }

    return maxCost;
  }

  return baseCost;
}

/**
 * Metodi di spedizione disponibili per un paese, con il costo calcolato sulle
 * classi di spedizione degli articoli. Gli errori di WooCommerce vengono
 * propagati: sta al chiamante decidere come gestirli.
 * `error` e' valorizzato quando il paese non rientra in nessuna zona.
 */
export async function getShippingMethodsForAddress(
  shippingAddress: ShippingAddressType,
  cartTotal: number,
  cartItems: ShippingCartItem[]
): Promise<{ methods: ShippingMethodResponse[]; error?: string }> {
  // Ottieni le zone di spedizione
  const response = await api.get('shipping/zones');
  const zones = response.data as ShippingZone[];

  if (!zones || zones.length === 0) {
    return {
      methods: [{
        id: 'flat_rate',
        title: 'Spedizione standard',
        description: 'Consegna in 3-5 giorni lavorativi',
        cost: 7.00
      }]
    };
  }

  // Trova la zona corrispondente al paese dell'utente
  let matchingZone: { zone: ShippingZone; methods: ShippingMethod[] } | null = null;
  let defaultZone: { zone: ShippingZone; methods: ShippingMethod[] } | null = null;

  for (const zone of zones) {
    // Ottieni i metodi di spedizione per questa zona
    const methodsResponse = await api.get(`shipping/zones/${zone.id}/methods`);
    const methods = methodsResponse.data as ShippingMethod[];

    if (methods && methods.length > 0) {
      // Se è la zona 0, è la zona predefinita (resto del mondo)
      if (zone.id === 0) {
        defaultZone = { zone, methods };
      }

      // Controlla se questa zona include il paese dell'utente
      const locationsResponse = await api.get(`shipping/zones/${zone.id}/locations`);
      const locations = locationsResponse.data as ShippingLocation[];

      const matchesCountry = locations.some((loc) =>
        loc.type === 'country' && loc.code === shippingAddress.country
      ) as boolean;

      // Per il continente Asia, controlla se il paese è asiatico
      const matchesContinent = locations.some((loc) =>
        loc.type === 'continent' && loc.code === 'AS' &&
        ['CN', 'JP', 'KR', 'SG', 'HK', 'TW', 'TH', 'MY', 'VN', 'PH', 'ID', 'IN'].includes(shippingAddress.country)
      ) as boolean;

      if (matchesCountry || matchesContinent) {
        matchingZone = { zone, methods };
        break;
      }
    }
  }

  // Usa la zona corrispondente o quella predefinita
  const zoneToUse = matchingZone || defaultZone;

  if (zoneToUse && zoneToUse.methods.length > 0) {
    // Filtra i metodi di spedizione attivi
    const activeMethods = zoneToUse.methods.filter(m => m.enabled);

    if (activeMethods.length > 0) {
      const shippingMethods: ShippingMethodResponse[] = activeMethods.map(method => {
        // Calcola il costo basato sulle classi di spedizione
        const cost = calculateShippingCost(method, cartItems);
        const minAmount = method.settings.min_amount ? parseFloat(method.settings.min_amount.value || '0') : 0;
        const requires = method.settings.requires ? method.settings.requires.value : '';

        // Verifica se la spedizione gratuita è disponibile
        const isFreeShipping = method.method_id === 'free_shipping';
        let isAvailable = true;

        // Controlla i requisiti per la spedizione gratuita
        if (isFreeShipping) {
          if (requires === 'min_amount' && cartTotal < minAmount) {
            isAvailable = false;
          }
          // Se requires è vuoto o diverso da 'min_amount', la spedizione gratuita è sempre disponibile
        }

        // Se il metodo non è disponibile, non includerlo
        if (!isAvailable) {
          return null;
        }

        return {
          id: method.method_id,
          title: method.title,
          description: isFreeShipping
            ? `Spedizione gratuita per ordini superiori a ${minAmount}€`
            : 'Consegna in 3-5 giorni lavorativi',
          cost: isFreeShipping ? 0 : cost,
          min_amount: isFreeShipping ? minAmount : undefined,
          free_shipping: isFreeShipping
        };
      }).filter(Boolean) as ShippingMethodResponse[];

      return { methods: shippingMethods };
    }
  }

  // Se non è stata trovata nessuna zona, il paese non è supportato
  return {
    error: `Spedizione non disponibile per ${shippingAddress.country}`,
    methods: []
  };
}

// ============================================================================
// SPEDIZIONE PER APPLE PAY / GOOGLE PAY
// ============================================================================

/** Il paese non rientra in nessuna zona: indirizzo non spedibile. */
export class ShippingUnavailableError extends Error {}

export interface WalletShippingItem {
  product_id: number;
  variation_id?: number | null;
  quantity: number;
}

export interface WalletShippingQuote {
  id: string;
  title: string;
  description: string;
  cost: number;
  /** Costo in centesimi, da confrontare con l'importo dell'opzione del wallet. */
  amountCents: number;
}

/**
 * Classe di spedizione letta da WooCommerce, mai dal browser: il carrello puo'
 * contenere prodotti senza shipping_class_id (listing del plugin) e un recupero
 * fallito lato client ripiegava in silenzio su 0, cioe' spedizione gratuita.
 * Per una variante vale la sua classe; se non ne ha una propria, quella del padre.
 */
async function getItemShippingClassId(item: WalletShippingItem): Promise<number> {
  if (item.variation_id) {
    const variationResponse = await api.get(`products/${item.product_id}/variations/${item.variation_id}`);
    const variationClassId = Number((variationResponse.data as { shipping_class_id?: number }).shipping_class_id) || 0;
    if (variationClassId > 0) {
      return variationClassId;
    }
  }

  const productResponse = await api.get(`products/${item.product_id}`);
  return Number((productResponse.data as { shipping_class_id?: number }).shipping_class_id) || 0;
}

/**
 * true se il coupon, letto da WooCommerce, da' la spedizione gratuita ed e'
 * ancora utilizzabile. Come nel checkout con carta (couponGrantsFreeShipping),
 * in quel caso la spedizione e' 0. Un errore di lettura viene propagato: non si
 * decide "gratis" ne' "a pagamento" alla cieca.
 */
async function couponGrantsFreeShipping(couponCode: string): Promise<boolean> {
  const code = couponCode.trim().toLowerCase();
  const response = await api.get('coupons', { code });
  const coupons = (Array.isArray(response.data) ? response.data : []) as Array<{
    code: string;
    status?: string;
    free_shipping?: boolean;
    date_expires_gmt?: string | null;
  }>;

  const coupon = coupons.find(c => String(c.code).toLowerCase() === code);
  if (!coupon || !coupon.free_shipping) {
    return false;
  }
  if (coupon.status && coupon.status !== 'publish') {
    return false;
  }
  if (coupon.date_expires_gmt && new Date(`${coupon.date_expires_gmt}Z`).getTime() <= Date.now()) {
    return false;
  }
  return true;
}

/**
 * Spedizione dovuta per un pagamento Apple Pay / Google Pay. Stessa tariffa del
 * checkout (primo metodo disponibile), con le classi lette da WooCommerce, e 0
 * se il coupon applicato da' la spedizione gratuita.
 *
 * Non ripiega mai su 0: se una lettura fallisce o il costo non e' un numero
 * (es. una tariffa "[fee percent=...]") lancia un errore, cosi' il pagamento
 * si blocca invece di partire senza spedizione.
 */
export async function quoteWalletShipping(params: {
  country: string;
  cartTotal: number;
  items: WalletShippingItem[];
  couponCode?: string;
}): Promise<WalletShippingQuote> {
  const { country, cartTotal, items, couponCode } = params;

  if (!country) {
    throw new ShippingUnavailableError('Indirizzo di spedizione non valido');
  }
  if (!items || items.length === 0) {
    throw new Error('Nessun prodotto per il calcolo della spedizione');
  }

  const cartItems: ShippingCartItem[] = await Promise.all(items.map(async (item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    variation_id: item.variation_id || 0,
    shipping_class_id: await getItemShippingClassId(item)
  })));

  const { methods, error } = await getShippingMethodsForAddress({ country }, cartTotal, cartItems);

  if (methods.length === 0) {
    throw new ShippingUnavailableError(error || `Spedizione non disponibile per ${country}`);
  }

  // Il paese deve comunque essere servito: il coupon azzera il costo, non
  // rende spedibile un indirizzo fuori zona.
  if (couponCode && await couponGrantsFreeShipping(couponCode)) {
    return {
      id: 'free_shipping',
      title: 'Spedizione gratuita (coupon)',
      description: 'Spedizione gratuita con il coupon applicato',
      cost: 0,
      amountCents: 0
    };
  }

  const method = methods[0];
  if (typeof method.cost !== 'number' || !Number.isFinite(method.cost) || method.cost < 0) {
    throw new Error(`Costo di spedizione non calcolabile per il metodo "${method.id}" (${country})`);
  }

  return {
    id: method.id,
    title: method.title,
    description: method.description,
    cost: method.cost,
    amountCents: Math.round(method.cost * 100)
  };
}
