'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { confirmNewsletter } from '@/lib/newsletter';

type Status = 'loading' | 'success' | 'error';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  // Guard against React 18 StrictMode double-invocation in dev.
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token) {
      setStatus('error');
      setMessage('Token di conferma mancante.');
      return;
    }

    confirmNewsletter(token)
      .then((result) => {
        setStatus('success');
        setMessage(result.message || 'Iscrizione confermata. Grazie!');
      })
      .catch((error: unknown) => {
        setStatus('error');
        setMessage(
          error instanceof Error ? error.message : 'Link di conferma non valido o scaduto.'
        );
      });
  }, [token]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
        {status === 'loading' && (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-bred-500" />
            <h1 className="text-xl font-semibold text-gray-900">Conferma in corso…</h1>
            <p className="mt-2 text-gray-600">Stiamo confermando la tua iscrizione.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl">
              ✓
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Iscrizione confermata!</h1>
            <p className="mt-2 text-gray-600">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 text-2xl">
              ✕
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Conferma non riuscita</h1>
            <p className="mt-2 text-gray-600">{message}</p>
          </>
        )}

        <Link
          href="/"
          className="mt-6 inline-block bg-bred-500 hover:bg-bred-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
        >
          Torna allo shop
        </Link>
      </div>
    </div>
  );
}

export default function NewsletterConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <ConfirmContent />
    </Suspense>
  );
}
