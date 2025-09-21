export interface CountryOption {
  code: string;
  name: string;
  zone: string;
}

export async function getAvailableCountries(): Promise<CountryOption[]> {
  try {
    // Determina l'URL base
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');

    const response = await fetch(`${baseUrl}/api/shipping/countries`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Per client-side non usiamo cache specifiche di Next.js
      ...(typeof window === 'undefined' && {
        cache: 'force-cache' as RequestCache,
        next: { revalidate: 3600 }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch countries');
    }

    const data = await response.json();
    return data.countries || [];
  } catch (error) {
    console.error('Errore nel recupero dei paesi:', error);

    // Fallback con i paesi principali se l'API non funziona
    return [
      { code: 'IT', name: 'Italia', zone: 'Italia' },
      { code: 'FR', name: 'Francia', zone: 'Europa' },
      { code: 'DE', name: 'Germania', zone: 'Europa' },
      { code: 'ES', name: 'Spagna', zone: 'Europa' },
      { code: 'GB', name: 'Regno Unito', zone: 'Europa Extra' }
    ];
  }
}