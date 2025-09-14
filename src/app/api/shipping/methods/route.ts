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
    [key: string]: unknown;
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

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { shipping_address, cart_total = 0 } = data as { 
      shipping_address: ShippingAddressType,
      cart_total: number
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
        console.log('API: Nessuna zona di spedizione configurata');
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
          
          if (matchesCountry) {
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
            const cost = method.settings.cost ? parseFloat(method.settings.cost.value || '0') : 0;
            const minAmount = method.settings.min_amount ? parseFloat(method.settings.min_amount.value || '0') : 0;
            const requires = method.settings.requires ? method.settings.requires.value : '';
            
            // Verifica se la spedizione gratuita è disponibile
            const isFreeShipping = method.method_id === 'free_shipping';
            let isAvailable = true;
            
            // Controlla i requisiti per la spedizione gratuita
            if (isFreeShipping && requires === 'min_amount' && cart_total < minAmount) {
              isAvailable = false;
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
      
      // Fallback: restituisci un metodo di spedizione standard
      const fallbackRates: Record<string, number> = {
        'IT': 7.00,  // Italia
        'FR': 12.50, // Francia
        'DE': 12.50, // Germania
        'ES': 12.50, // Spagna
        'GB': 15.00  // Regno Unito
      };
      
      const countryCode = shipping_address.country;
      const fallbackCost = fallbackRates[countryCode] || 5.99;
      
      console.log(`API: Utilizzo metodo di fallback per ${countryCode}: ${fallbackCost}€`);
      return NextResponse.json({ 
        methods: [{
          id: 'flat_rate',
          title: 'Spedizione standard',
          description: 'Consegna in 3-5 giorni lavorativi',
          cost: fallbackCost
        }] 
      });
      
    } catch (error) {
      console.error('API: Errore nel recupero dei metodi di spedizione:', error);
      return NextResponse.json({ 
        error: 'Errore nel recupero dei metodi di spedizione',
        methods: [{
          id: 'flat_rate',
          title: 'Spedizione standard',
          description: 'Consegna in 3-5 giorni lavorativi',
          cost: 5.99
        }]
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
