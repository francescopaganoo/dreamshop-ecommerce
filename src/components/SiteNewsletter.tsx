'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSiteFormConfig, type SiteFormConfig } from '../lib/newsletter';
import { useNewsletterSubscribe } from '../hooks/useNewsletterSubscribe';

/**
 * Promotional newsletter form managed from the WordPress plugin backend.
 * Separate from the always-on footer form: the backend toggles it on/off and
 * picks how it appears (popup / sticky banner / inline homepage section) and
 * the frequency-capping conditions, which are enforced here via localStorage.
 *
 * Mount once with `placement="overlay"` in the root layout (handles popup and
 * banner, site-wide) and once with `placement="inline"` on the homepage
 * (handles the inline section). Each instance renders only for its own modes,
 * so the form never appears twice.
 */

const STORAGE_KEY = 'nm_site_form_v1';

interface FormState {
  /** Number of times the user closed the form. */
  dismissed: number;
  /** Epoch ms of the last time it was closed. */
  lastSeen: number;
  /** Whether the user already subscribed through this form. */
  subscribed: boolean;
}

function readState(): FormState {
  if (typeof window === 'undefined') {
    return { dismissed: 0, lastSeen: 0, subscribed: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FormState>;
      return {
        dismissed: Number(parsed.dismissed) || 0,
        lastSeen: Number(parsed.lastSeen) || 0,
        subscribed: Boolean(parsed.subscribed),
      };
    }
  } catch {
    /* ignore malformed storage */
  }
  return { dismissed: 0, lastSeen: 0, subscribed: false };
}

function writeState(state: FormState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage may be unavailable (private mode); fail silently */
  }
}

/**
 * Decide whether the conditions allow showing the overlay (popup/banner).
 */
function isEligible(config: SiteFormConfig, state: FormState): boolean {
  if (state.subscribed) {
    return false;
  }
  if (config.dismiss_limit > 0 && state.dismissed >= config.dismiss_limit) {
    return false;
  }
  if (config.frequency_days > 0 && state.lastSeen > 0) {
    const elapsed = Date.now() - state.lastSeen;
    if (elapsed < config.frequency_days * 24 * 60 * 60 * 1000) {
      return false;
    }
  }
  return true;
}

interface SiteNewsletterProps {
  /** "overlay" → popup/banner (layout); "inline" → homepage section. */
  placement: 'overlay' | 'inline';
}

export default function SiteNewsletter({ placement }: SiteNewsletterProps) {
  const [config, setConfig] = useState<SiteFormConfig | null>(null);
  const [visible, setVisible] = useState(false);

  // Load the backend configuration once.
  useEffect(() => {
    let active = true;
    getSiteFormConfig().then((cfg) => {
      if (active) {
        setConfig(cfg);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // For the homepage inline section, render as soon as the config says so.
  const isInlineMode = config?.enabled && config.mode === 'homepage' && placement === 'inline';
  const isOverlayMode =
    config?.enabled && (config.mode === 'popup' || config.mode === 'banner') && placement === 'overlay';

  // Arm the trigger for overlay modes (popup/banner), respecting conditions.
  useEffect(() => {
    if (!isOverlayMode || !config) {
      return;
    }
    if (!isEligible(config, readState())) {
      return;
    }

    // Banner has no trigger: show it (after a short beat to avoid layout jump).
    if (config.mode === 'banner') {
      const t = window.setTimeout(() => setVisible(true), 600);
      return () => window.clearTimeout(t);
    }

    // Popup triggers: delay | scroll | exit.
    if (config.trigger === 'delay') {
      const t = window.setTimeout(() => setVisible(true), Math.max(0, config.delay) * 1000);
      return () => window.clearTimeout(t);
    }

    if (config.trigger === 'scroll') {
      const onScroll = () => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const percent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 100;
        if (percent >= config.scroll_percent) {
          setVisible(true);
          window.removeEventListener('scroll', onScroll);
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      return () => window.removeEventListener('scroll', onScroll);
    }

    if (config.trigger === 'exit') {
      const onMouseOut = (e: MouseEvent) => {
        if (e.clientY <= 0) {
          setVisible(true);
          document.removeEventListener('mouseout', onMouseOut);
        }
      };
      document.addEventListener('mouseout', onMouseOut);
      return () => document.removeEventListener('mouseout', onMouseOut);
    }
  }, [isOverlayMode, config]);

  const handleClose = useCallback(() => {
    setVisible(false);
    const state = readState();
    writeState({ ...state, dismissed: state.dismissed + 1, lastSeen: Date.now() });
  }, []);

  const handleSubscribed = useCallback(() => {
    const state = readState();
    writeState({ ...state, subscribed: true, lastSeen: Date.now() });
  }, []);

  if (!config || !config.enabled) {
    return null;
  }

  if (isInlineMode) {
    return <InlineSection config={config} onSubscribed={handleSubscribed} />;
  }

  if (isOverlayMode && visible) {
    if (config.mode === 'popup') {
      return <PopupForm config={config} onClose={handleClose} onSubscribed={handleSubscribed} />;
    }
    return <BannerForm config={config} onClose={handleClose} onSubscribed={handleSubscribed} />;
  }

  return null;
}

/* ---------------------------------------------------------------------------
 * Shared form fields
 * ------------------------------------------------------------------------- */

interface FieldsProps {
  config: SiteFormConfig;
  onSubscribed: () => void;
  /** Tailwind colour theme: "dark" for overlays, "light" for the homepage. */
  theme: 'dark' | 'light';
}

function NewsletterFields({ config, onSubscribed, theme }: FieldsProps) {
  const {
    email,
    setEmail,
    privacyAccepted,
    setPrivacyAccepted,
    hp,
    setHp,
    isSubmitting,
    message,
    handleSubmit,
  } = useNewsletterSubscribe({ list: config.list, onSuccess: onSubscribed });

  const inputClass =
    theme === 'dark'
      ? 'flex-grow px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-bred-500 focus:border-transparent transition-all disabled:opacity-50'
      : 'flex-grow px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-bred-500 focus:border-transparent transition-all disabled:opacity-50';

  const labelClass = theme === 'dark' ? 'text-sm text-gray-300' : 'text-sm text-gray-600';

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="La tua email..."
          required
          disabled={isSubmitting}
          aria-label="Email"
          className={inputClass}
        />

        {/* Honeypot: kept off-screen, must remain empty for real users. */}
        <input
          type="text"
          name="company"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />

        <button
          type="submit"
          disabled={isSubmitting || !email.trim() || !privacyAccepted}
          className="bg-gradient-to-r from-bred-500 to-bred-500 hover:from-bred-600 hover:to-bred-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-bred-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap"
        >
          {isSubmitting ? 'Invio...' : 'Iscriviti'}
        </button>
      </div>

      <div className="mt-3 flex items-start gap-2">
        <input
          id={`site-newsletter-privacy-${theme}`}
          type="checkbox"
          checked={privacyAccepted}
          onChange={(e) => setPrivacyAccepted(e.target.checked)}
          disabled={isSubmitting}
          className="mt-0.5 h-4 w-4 rounded border-gray-400 text-bred-500 focus:ring-bred-500"
        />
        <label htmlFor={`site-newsletter-privacy-${theme}`} className={labelClass}>
          Accetto l&apos;
          <Link
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-bred-500 hover:text-bred-600 underline"
          >
            informativa sulla privacy
          </Link>
          {' '}*
        </label>
      </div>

      {message && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}

/* ---------------------------------------------------------------------------
 * Layouts
 * ------------------------------------------------------------------------- */

interface OverlayProps {
  config: SiteFormConfig;
  onClose: () => void;
  onSubscribed: () => void;
}

function PopupForm({ config, onClose, onSubscribed }: OverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={config.title}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-8 shadow-2xl border border-gray-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute right-4 top-4 text-gray-400 hover:text-white text-2xl leading-none"
        >
          &times;
        </button>
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold mb-2 text-white">{config.title}</h3>
          <p className="text-gray-300">{config.description}</p>
        </div>
        <NewsletterFields config={config} onSubscribed={onSubscribed} theme="dark" />
      </div>
    </div>
  );
}

function BannerForm({ config, onClose, onSubscribed }: OverlayProps) {
  const anchor = config.position === 'top' ? 'top-0' : 'bottom-0';
  return (
    <div className={`fixed ${anchor} inset-x-0 z-[1000] bg-gray-900/95 backdrop-blur border-t border-gray-700/50 shadow-2xl`}>
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="md:flex-shrink-0 md:max-w-sm pr-8">
            <h3 className="text-lg font-bold text-white">{config.title}</h3>
            <p className="text-sm text-gray-300">{config.description}</p>
          </div>
          <div className="flex-grow">
            <NewsletterFields config={config} onSubscribed={onSubscribed} theme="dark" />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute right-4 top-3 text-gray-400 hover:text-white text-2xl leading-none"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

interface InlineProps {
  config: SiteFormConfig;
  onSubscribed: () => void;
}

function InlineSection({ config, onSubscribed }: InlineProps) {
  return (
    <section className="py-16 bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <span className="text-bred-500 font-medium">NEWSLETTER</span>
            <h2 className="text-3xl font-bold mb-2 text-gray-900">{config.title}</h2>
            <p className="text-gray-600">{config.description}</p>
          </div>
          <div className="max-w-md mx-auto">
            <NewsletterFields config={config} onSubscribed={onSubscribed} theme="light" />
          </div>
        </div>
      </div>
    </section>
  );
}
