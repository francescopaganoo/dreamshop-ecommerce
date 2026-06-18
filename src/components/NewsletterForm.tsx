'use client';

import { useState } from 'react';
import Link from 'next/link';
import { subscribeNewsletter } from '../lib/newsletter';

/**
 * Newsletter / contact subscription form.
 * Submits to the `newsletter-manager` WordPress plugin (double opt-in).
 */
export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  // Honeypot: hidden from humans, often filled by bots.
  const [hp, setHp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      const result = await subscribeNewsletter({ email: email.trim(), hp });

      if (result.success) {
        setMessage({
          type: 'success',
          text: result.message || 'Controlla la tua casella di posta per confermare l\'iscrizione.',
        });
        setEmail('');
        setPrivacyAccepted(false);
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

  return (
    <div className="mt-16 p-8 bg-gradient-to-r from-bred-500/10 to-purple-500/10 rounded-2xl border border-gray-700/50">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold mb-2">Resta Sempre Aggiornato!</h3>
        <p className="text-gray-300">Ricevi in anteprima le ultime novità e offerte esclusive</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="La tua email..."
            required
            disabled={isSubmitting}
            aria-label="Email"
            className="flex-grow px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-bred-500 focus:border-transparent transition-all disabled:opacity-50"
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

        <div className="mt-3 flex items-start justify-center gap-2">
          <input
            id="newsletter-privacy"
            type="checkbox"
            checked={privacyAccepted}
            onChange={(e) => setPrivacyAccepted(e.target.checked)}
            disabled={isSubmitting}
            className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-800 text-bred-500 focus:ring-bred-500"
          />
          <label htmlFor="newsletter-privacy" className="text-sm text-gray-300">
            Accetto l&apos;
            <Link
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-bred-400 hover:text-bred-300 underline"
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
            className={`mt-3 text-sm text-center ${
              message.type === 'success' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
}
