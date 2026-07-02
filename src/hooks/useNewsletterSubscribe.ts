'use client';

import { useState } from 'react';
import { subscribeNewsletter } from '../lib/newsletter';

export interface UseNewsletterSubscribeOptions {
  /** Target list id; omit/0 to use the backend default site list. */
  list?: number;
  /** Called after a successful subscription (double opt-in email sent). */
  onSuccess?: () => void;
}

export interface NewsletterMessage {
  type: 'success' | 'error';
  text: string;
}

/**
 * Shared newsletter subscription logic (email + privacy consent + honeypot,
 * double opt-in). Used by both the footer form and the promotional site form
 * so the submit behaviour stays in one place.
 */
export function useNewsletterSubscribe(options: UseNewsletterSubscribeOptions = {}) {
  const { list, onSuccess } = options;

  const [email, setEmail] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  // Honeypot: hidden from humans, often filled by bots.
  const [hp, setHp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<NewsletterMessage | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Inserisci la tua email' });
      return;
    }

    if (!privacyAccepted) {
      setMessage({ type: 'error', text: 'Devi accettare l\'informativa sulla privacy per continuare' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const result = await subscribeNewsletter({
        email: email.trim(),
        privacy_consent: privacyAccepted,
        ...(list && list > 0 ? { list } : {}),
        hp,
      });

      if (result.success) {
        setMessage({
          type: 'success',
          text: result.message || 'Controlla la tua casella di posta per confermare l\'iscrizione.',
        });
        setEmail('');
        setPrivacyAccepted(false);
        onSuccess?.();
      } else {
        setMessage({
          type: 'error',
          text: result.message || 'Errore durante l\'iscrizione. Riprova più tardi.',
        });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Errore di connessione. Riprova più tardi.';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    email,
    setEmail,
    privacyAccepted,
    setPrivacyAccepted,
    hp,
    setHp,
    isSubmitting,
    message,
    handleSubmit,
  };
}
