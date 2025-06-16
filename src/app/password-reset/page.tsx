'use client';

import React, { useState } from 'react';
import Link from 'next/link';


export default function PasswordResetPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Gestisce l'invio del form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      if (!response.ok) {
        throw new Error('Errore durante la richiesta di reset della password');
      }
      
      setSuccess('Ti abbiamo inviato un\'email con le istruzioni per reimpostare la password.');
      setEmail(''); // Pulisci il campo email
    } catch (error) {
      console.error('Errore durante la richiesta di reset della password:', error);
      setError('Si è verificato un errore durante la richiesta di reset della password. Riprova più tardi.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col">
      
      <main className="flex-grow py-8">
        <div className="container mx-auto px-4 max-w-md">
          <h1 className="text-3xl font-bold mb-8 text-center text-gray-600">Recupera la tua password</h1>
          
          {error && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-md">
              {success}
            </div>
          )}
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="mb-6 text-gray-600">
              Inserisci il tuo indirizzo email e ti invieremo un link per reimpostare la password.
            </p>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 px-4 rounded-md text-white font-medium ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-bred-500 hover:bg-bred-700'}`}
              >
                {isSubmitting ? 'Invio in corso...' : 'Invia link di reset'}
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
