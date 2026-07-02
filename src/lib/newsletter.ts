/**
 * API functions for the newsletter / contact subscription form.
 * Talks to the `newsletter-manager` WordPress plugin via its REST namespace.
 */

const WORDPRESS_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL;

export interface NewsletterSubscription {
  email: string;
  /** Optional contact name. */
  name?: string;
  /** Optional list id. When 0/omitted the backend uses the default site list. */
  list?: number;
  /** GDPR privacy consent — required by the backend. */
  privacy_consent: boolean;
  /** Honeypot — must stay empty; filled only by bots. */
  hp?: string;
}

export interface NewsletterResponse {
  success: boolean;
  message: string;
}

export interface NewsletterList {
  id: number;
  name: string;
  description: string;
  subscriber_count: number;
}

/**
 * Configuration of the promotional site form (popup / banner / homepage
 * section), managed from the WordPress plugin settings. Separate from the
 * always-on footer form. Conditions are enforced client-side via localStorage.
 */
export interface SiteFormConfig {
  enabled: boolean;
  mode: 'popup' | 'banner' | 'homepage';
  /** Banner anchoring; only used in banner mode. */
  position: 'top' | 'bottom';
  title: string;
  description: string;
  /** Popup trigger; only used in popup mode. */
  trigger: 'delay' | 'scroll' | 'exit';
  /** Seconds to wait before showing (delay trigger). */
  delay: number;
  /** Percent of page scrolled before showing (scroll trigger). */
  scroll_percent: number;
  /** After this many closes, stop showing to the user. 0 = never hide. */
  dismiss_limit: number;
  /** Days to wait before showing again after a close. 0 = every visit. */
  frequency_days: number;
  /** Target list id; 0 means the backend default site list. */
  list: number;
}

function apiBase(): string {
  return (WORDPRESS_URL || '').replace(/\/$/, '');
}

/**
 * Subscribe a contact. The plugin uses double opt-in, so a confirmation email
 * is sent and the returned message asks the user to check their inbox.
 */
export async function subscribeNewsletter(
  subscription: NewsletterSubscription
): Promise<NewsletterResponse> {
  const response = await fetch(`${apiBase()}/wp-json/newsletter-manager/v1/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscription),
  });

  const result = await response.json();

  if (!response.ok) {
    // WordPress REST errors come back as { code, message, data }.
    throw new Error(result?.message || 'Errore durante l\'iscrizione');
  }

  return result;
}

/**
 * Confirm a double opt-in subscription given the token from the email link.
 */
export async function confirmNewsletter(token: string): Promise<NewsletterResponse> {
  const response = await fetch(`${apiBase()}/wp-json/newsletter-manager/v1/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.message || 'Link di conferma non valido o scaduto');
  }

  return result;
}

/**
 * Fetch the available newsletter lists (id + name).
 */
export async function getNewsletterLists(): Promise<NewsletterList[]> {
  const response = await fetch(`${apiBase()}/wp-json/newsletter-manager/v1/lists`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Errore durante il caricamento delle liste');
  }

  return response.json();
}

/**
 * Fetch the promotional site-form configuration (popup / banner / homepage).
 * Returns null on any error so callers can simply skip rendering the form.
 */
export async function getSiteFormConfig(): Promise<SiteFormConfig | null> {
  try {
    const response = await fetch(`${apiBase()}/wp-json/newsletter-manager/v1/site-form`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as SiteFormConfig;
  } catch {
    return null;
  }
}
