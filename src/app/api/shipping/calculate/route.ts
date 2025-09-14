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
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
};

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
  title: string;
  enabled: boolean;
  settings: {
    cost?: {
      value: string;
    };
    [key: string]: unknown;
  };
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { shipping_address } = data as { shipping_address: ShippingAddressType };
    
    if (!shipping_address || !shipping_address.country) {
      return NextResponse.json({ 
        error: 'Indirizzo di spedizione non valido',
        shipping_cost: 5.99 
      });
    }
    
    
    try {
      // Ottieni le zone di spedizione
      const response = await api.get('shipping/zones');
      const zones = response.data as ShippingZone[];
      
      if (!zones || zones.length === 0) {
        console.log('API: Nessuna zona di spedizione configurata');
        return NextResponse.json({ shipping_cost: 5.99 });
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
          
          if (matchesCountry) {
            matchingZone = { zone, methods };
            break;
          }
        }
      }
      
      // Usa la zona corrispondente o quella predefinita
      const zoneToUse = matchingZone || defaultZone;
      
      if (zoneToUse && zoneToUse.methods.length > 0) {
        // Trova il primo metodo di spedizione attivo
        const activeMethod = zoneToUse.methods.find((m) => m.enabled);
        
        if (activeMethod) {
          // Ottieni il costo di spedizione dal metodo
          if (activeMethod.settings && activeMethod.settings.cost) {
            const cost = parseFloat(activeMethod.settings.cost.value || '0');
            console.log(`API: Costo di spedizione calcolato: ${cost}`);
            return NextResponse.json({ shipping_cost: cost });
          }
        }
      }
      
      const fallbackRates: Record<string, number> = {
        'IT': 7.00,  // Italia
        'FR': 12.50, // Francia
        'DE': 12.50, // Germania
        'ES': 12.50, // Spagna
        'GB': 15.00  // Regno Unito
      };
      
      const countryCode = shipping_address.country;
      const fallbackCost = fallbackRates[countryCode];
      
      if (fallbackCost !== undefined) {
        console.log(`API: Utilizzo valore di fallback per ${countryCode}: ${fallbackCost}`);
        return NextResponse.json({ shipping_cost: fallbackCost });
      }
      
      console.log('API: Utilizzo valore di fallback standard: 5.99');
      return NextResponse.json({ shipping_cost: 5.99 });
      
    } catch (error) {
      console.error('API: Errore nel calcolo della spedizione:', error);
      return NextResponse.json({ 
        error: 'Errore nel calcolo della spedizione',
        shipping_cost: 5.99 
      });
    }
    
  } catch (error) {
    console.error('API: Errore nella richiesta:', error);
    return NextResponse.json({ 
      error: 'Errore nella richiesta',
      shipping_cost: 5.99 
    });
  }
}
