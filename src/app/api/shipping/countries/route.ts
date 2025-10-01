import { NextResponse } from 'next/server';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';

const api = new WooCommerceRestApi({
  url: process.env.NEXT_PUBLIC_WORDPRESS_URL!,
  consumerKey: process.env.NEXT_PUBLIC_WC_CONSUMER_KEY!,
  consumerSecret: process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET!,
  version: "wc/v3",
});

// Mappa dei nomi dei paesi
const COUNTRY_NAMES: Record<string, string> = {
  // Europa
  'IT': 'Italia',
  'AT': 'Austria',
  'BE': 'Belgio',
  'HR': 'Croazia',
  'DK': 'Danimarca',
  'FI': 'Finlandia',
  'FR': 'Francia',
  'DE': 'Germania',
  'LU': 'Lussemburgo',
  'GR': 'Grecia',
  'IE': 'Irlanda',
  'MT': 'Malta',
  'NL': 'Paesi Bassi',
  'PT': 'Portogallo',
  'CZ': 'Repubblica Ceca',
  'RO': 'Romania',
  'SK': 'Slovacchia',
  'ES': 'Spagna',
  'SE': 'Svezia',
  'HU': 'Ungheria',
  'GB': 'Regno Unito',
  'US': 'Stati Uniti',
  'CA': 'Canada',
  'AU': 'Australia',
  'JP': 'Giappone',
  'CN': 'Cina',
  'IN': 'India',
  'BR': 'Brasile',
  'MX': 'Messico',
  'KR': 'Corea del Sud',
  'SG': 'Singapore',
  'HK': 'Hong Kong',
  'TW': 'Taiwan',
  'TH': 'Thailandia',
  'MY': 'Malesia',
  'VN': 'Vietnam',
  'PH': 'Filippine',
  'ID': 'Indonesia',
  'PL': 'Polonia',
  'NO': 'Norvegia',
  'CH': 'Svizzera',
  'TR': 'Turchia',
  'RU': 'Russia',
  'ZA': 'Sudafrica',
  'EG': 'Egitto',
  'IL': 'Israele',
  'AE': 'Emirati Arabi Uniti',
  'SA': 'Arabia Saudita',
  'AR': 'Argentina',
  'CL': 'Cile',
  'CO': 'Colombia',
  'PE': 'Perù',
  'NZ': 'Nuova Zelanda'
};

interface ShippingZone {
  id: number;
  name: string;
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

interface CountryOption {
  code: string;
  name: string;
  zone: string;
}

export async function GET() {
  try {
    // Ottieni tutte le zone di spedizione
    const zonesResponse = await api.get('shipping/zones');
    const zones = zonesResponse.data as ShippingZone[];

    if (!zones || zones.length === 0) {
      return NextResponse.json({
        error: 'Nessuna zona di spedizione configurata',
        countries: []
      });
    }

    const countries: CountryOption[] = [];
    const addedCountries = new Set<string>();

    // Cicla attraverso tutte le zone
    for (const zone of zones) {
      try {
        // Prima verifica se la zona ha metodi di spedizione attivi
        const methodsResponse = await api.get(`shipping/zones/${zone.id}/methods`);
        const methods = methodsResponse.data as ShippingMethod[];

        // Verifica se ci sono metodi attivi
        const hasActiveMethods = methods && methods.some(method => method.enabled);

        // Salta le zone senza metodi attivi (come "resto del mondo")
        if (!hasActiveMethods) {
          continue;
        }

        // Ottieni le località per questa zona
        const locationsResponse = await api.get(`shipping/zones/${zone.id}/locations`);
        const locations = locationsResponse.data as ShippingLocation[];

        if (locations && locations.length > 0) {
          for (const location of locations) {
            // Se è un paese specifico
            if (location.type === 'country' && !addedCountries.has(location.code)) {
              const countryName = COUNTRY_NAMES[location.code] || location.code;
              countries.push({
                code: location.code,
                name: countryName,
                zone: zone.name
              });
              addedCountries.add(location.code);
            }
            // Se è un continente (come Asia per la Cina), gestisci i paesi principali
            else if (location.type === 'continent' && location.code === 'AS') {
              // Aggiungi i paesi asiatici principali se non già presenti
              const asianCountries = ['CN', 'JP', 'KR', 'SG', 'HK', 'TW', 'TH', 'MY', 'VN', 'PH', 'ID', 'IN'];
              for (const countryCode of asianCountries) {
                if (!addedCountries.has(countryCode)) {
                  const countryName = COUNTRY_NAMES[countryCode] || countryCode;
                  countries.push({
                    code: countryCode,
                    name: countryName,
                    zone: zone.name
                  });
                  addedCountries.add(countryCode);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Errore nel recupero delle località per la zona ${zone.id}:`, error);
      }
    }

    // Ordina i paesi alfabeticamente, ma metti l'Italia prima
    countries.sort((a, b) => {
      if (a.code === 'IT') return -1;
      if (b.code === 'IT') return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ countries });

  } catch (error) {
    console.error('Errore nel recupero dei paesi:', error);
    return NextResponse.json({
      error: 'Errore nel recupero dei paesi',
      countries: []
    });
  }
}