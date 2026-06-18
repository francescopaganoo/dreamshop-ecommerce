/**
 * Shared cookie-consent state.
 *
 * The banner (CookieConsent) writes the user's choice here and broadcasts it;
 * the tracking layer (TrackingScripts) reads it to load Hotjar/Pixel and to
 * push Google Consent Mode updates. Single source of truth for both.
 */

export interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

export const CONSENT_STORAGE_KEY = 'cookie-consent';
export const CONSENT_DATE_KEY = 'cookie-consent-date';
export const CONSENT_CHANGED_EVENT = 'cookie-consent-changed';

/**
 * Read the stored consent, or null if the user hasn't chosen yet.
 * `necessary` is always true; the others default to false (deny by default).
 */
export function readConsent(): CookiePreferences | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<CookiePreferences>;
    return {
      necessary: true,
      analytics: !!parsed.analytics,
      marketing: !!parsed.marketing,
    };
  } catch {
    return null;
  }
}

/**
 * Persist the consent and broadcast the change so the tracking layer reacts
 * immediately (without a page reload).
 */
export function saveConsent(prefs: CookiePreferences): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(prefs));
  window.localStorage.setItem(CONSENT_DATE_KEY, new Date().toISOString());
  window.dispatchEvent(new CustomEvent<CookiePreferences>(CONSENT_CHANGED_EVENT, { detail: prefs }));
}
