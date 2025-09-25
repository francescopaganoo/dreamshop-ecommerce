'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export default function PasswordResetTokenPage({ params }: PageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const router = useRouter();
  const { token } = use(params);

  // Verifica la validità del token al caricamento della pagina
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await fetch('/api/auth/verify-reset-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        if (response.ok) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
        }
      } catch (error) {
        console.error('Errore durante la verifica del token:', error);
        setTokenValid(false);
      }
    };

    if (token) {
      // Pulisci immediatamente il return_url per evitare redirect indesiderati
      if (typeof window !== 'undefined') {
        localStorage.removeItem('return_url');
      }
      verifyToken();
    }
  }, [token]);

  // Gestisce l'invio del form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Le password non coincidono');
      return;
    }

    if (password.length < 6) {
      setError('La password deve essere lunga almeno 6 caratteri');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante il reset della password');
      }

      setSuccess(true);

      // Reindirizza al login dopo 2 secondi e pulisci la cronologia
      setTimeout(() => {
        // Pulisci qualsiasi dato di sessione che potrebbe interferire
        if (typeof window !== 'undefined') {
          // Pulisci localStorage da eventuali token vecchi
          localStorage.removeItem('authToken');
          localStorage.removeItem('resetToken');
          // Pulisci l'URL di ritorno che potrebbe contenere il token
          localStorage.removeItem('return_url');
          // Pulisci sessionStorage
          sessionStorage.clear();
          // Pulisci la cronologia del browser
          window.history.replaceState(null, '', '/login');
        }
        router.replace('/login');
      }, 2000);

    } catch (error) {
      console.error('Errore durante il reset della password:', error);
      setError(error instanceof Error ? error.message : 'Si è verificato un errore durante il reset della password. Riprova più tardi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-grow py-8">
          <div className="container mx-auto px-4 max-w-md">
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <p>Verifica del token in corso...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-grow py-8">
          <div className="container mx-auto px-4 max-w-md">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold mb-4 text-red-600">Token non valido</h1>
                <p className="text-gray-600 mb-6">
                  Il link per il reset della password è scaduto o non valido.
                </p>
                <Link
                  href="/password-reset"
                  className="bg-bred-500 hover:bg-bred-700 text-white font-medium py-3 px-6 rounded-md inline-block"
                >
                  Richiedi nuovo reset
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-grow py-8">
          <div className="container mx-auto px-4 max-w-md">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-center">
                <h1 className="text-3xl font-bold mb-4 text-green-600">Password aggiornata!</h1>
                <p className="text-gray-600 mb-6">
                  La tua password è stata aggiornata con successo. Verrai reindirizzato alla pagina di login.
                </p>
                <button
                  onClick={() => {
                    // Pulisci qualsiasi dato di sessione che potrebbe interferire
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('authToken');
                      localStorage.removeItem('resetToken');
                      // Pulisci l'URL di ritorno che potrebbe contenere il token
                      localStorage.removeItem('return_url');
                      sessionStorage.clear();
                      window.history.replaceState(null, '', '/login');
                    }
                    router.replace('/login');
                  }}
                  className="bg-bred-500 hover:bg-bred-700 text-white font-medium py-3 px-6 rounded-md inline-block"
                >
                  Vai al login
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow py-8">
        <div className="container mx-auto px-4 max-w-md">
          <h1 className="text-3xl font-bold mb-8 text-center text-gray-600">Nuova Password</h1>

          {error && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="mb-6 text-gray-600">
              Inserisci la tua nuova password.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Nuova Password *
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                  required
                  minLength={6}
                />
              </div>

              <div className="mb-6">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Conferma Password *
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 px-4 rounded-md text-white font-medium ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-bred-500 hover:bg-bred-700'}`}
              >
                {isSubmitting ? 'Aggiornamento in corso...' : 'Aggiorna password'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Ricordi la tua password?{' '}
                <Link href="/login" className="text-bred-500 hover:text-bred-700">
                  Torna al login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}