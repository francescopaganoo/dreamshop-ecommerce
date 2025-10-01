import { NextRequest, NextResponse } from 'next/server';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';

// Initialize the WooCommerce API
const api = new WooCommerceRestApi({
  url: process.env.NEXT_PUBLIC_WORDPRESS_URL!,
  consumerKey: process.env.NEXT_PUBLIC_WC_CONSUMER_KEY!,
  consumerSecret: process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET!,
  version: "wc/v3",
});

// Interfacce
type ShippingAddressType = {
  first_name?: string;
  last_name?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country: string;
};

interface CartItem {
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

interface ShippingMethodResponse {
  id: string;
  title: string;
  description: string;
  cost: number;
  min_amount?: number;
  free_shipping?: boolean;
}

// Funzione per calcolare il costo di spedizione basato sulle classi
function calculateShippingCost(method: ShippingMethod, cartItems: CartItem[]): number {
  const baseCost = method.settings.cost ? parseFloat(method.settings.cost.value || '0') : 0;
  const calculationType = method.settings.type ? method.settings.type.value : 'class';

  // Se non ci sono prodotti nel carrello, usa il costo base
  if (!cartItems || cartItems.length === 0) {
    return baseCost;
  }

  // Se il tipo è 'class', calcola per ogni classe individualmente
  if (calculationType === 'class') {
    let totalCost = 0;

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

      totalCost += classCost * item.quantity;
    }

    return totalCost;
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

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { shipping_address, cart_total = 0, cart_items = [] } = data as {
      shipping_address: ShippingAddressType,
      cart_total: number,
      cart_items?: CartItem[]
    };
    
    if (!shipping_address || !shipping_address.country) {
      return NextResponse.json({ 
        error: 'Indirizzo di spedizione non valido',
        methods: [] 
      });
    }
    
    
    try {
      // Ottieni le zone di spedizione
      const response = await api.get('shipping/zones');
      const zones = response.data as ShippingZone[];
      
      if (!zones || zones.length === 0) {
        return NextResponse.json({ 
          methods: [{
            id: 'flat_rate',
            title: 'Spedizione standard',
            description: 'Consegna in 3-5 giorni lavorativi',
            cost: 7.00
          }] 
        });
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
            loc.type === 'country' && loc.code === shipping_address.country
          ) as boolean;

          // Per il continente Asia, controlla se il paese è asiatico
          const matchesContinent = locations.some((loc) =>
            loc.type === 'continent' && loc.code === 'AS' &&
            ['CN', 'JP', 'KR', 'SG', 'HK', 'TW', 'TH', 'MY', 'VN', 'PH', 'ID', 'IN'].includes(shipping_address.country)
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
            const cost = calculateShippingCost(method, cart_items);
            const minAmount = method.settings.min_amount ? parseFloat(method.settings.min_amount.value || '0') : 0;
            const requires = method.settings.requires ? method.settings.requires.value : '';
            
            // Verifica se la spedizione gratuita è disponibile
            const isFreeShipping = method.method_id === 'free_shipping';
            let isAvailable = true;
            
            // Controlla i requisiti per la spedizione gratuita
            if (isFreeShipping) {
              if (requires === 'min_amount' && cart_total < minAmount) {
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
          
          return NextResponse.json({ methods: shippingMethods });
        }
      }

      // Se non è stata trovata nessuna zona, il paese non è supportato
      return NextResponse.json({
        error: `Spedizione non disponibile per ${shipping_address.country}`,
        methods: []
      });
      
    } catch (error) {
      console.error('API: Errore nel recupero dei metodi di spedizione:', error);
      return NextResponse.json({
        error: 'Errore nel recupero dei metodi di spedizione',
        methods: []
      });
    }
    
  } catch (error) {
    console.error('API: Errore nella richiesta:', error);
    return NextResponse.json({ 
      error: 'Errore nella richiesta',
      methods: []
    });
  }
}
