'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';


export default function EditAccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, updateUser } = useAuth();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Reindirizza l'utente se non è autenticato
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);
  
  // Popola il form con i dati dell'utente quando sono disponibili
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || ''
      }));
    }
  }, [user]);
  
  // Gestisce i cambiamenti nei campi del form
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Gestisce l'invio del form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verifica che le password corrispondano se si sta cambiando la password
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setError('Le nuove password non corrispondono');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Define a type for user update data
      interface UserUpdateData {
        firstName?: string;
        lastName?: string;
        email?: string;
        password?: string;
      }
      
      // Prepara i dati da aggiornare
      const updateData: UserUpdateData = {};
      
      if (formData.firstName !== user?.firstName) updateData.firstName = formData.firstName;
      if (formData.lastName !== user?.lastName) updateData.lastName = formData.lastName;
      if (formData.email !== user?.email) updateData.email = formData.email;
      
      // Aggiungi la nuova password se specificata
      if (formData.newPassword) {
        updateData.password = formData.newPassword;
      }
      
      // Aggiorna i dati dell'utente
      const success = await updateUser(updateData);
      
      if (success) {
        setSuccess('I tuoi dati sono stati aggiornati con successo');
        
        // Resetta i campi della password
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
      } else {
        setError('Aggiornamento fallito. Riprova.');
      }
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dell\'account:', error);
      setError('Si è verificato un errore durante l\'aggiornamento dell\'account. Riprova più tardi.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Mostra un messaggio di caricamento se l'autenticazione è in corso
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">

        
        <main className="flex-grow py-8">
          <div className="container mx-auto px-4">
            <p className="text-center">Caricamento in corso...</p>
          </div>
        </main>
        
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-white">
      
      <main className="flex-grow py-8">
        <div className="container mx-auto px-4 max-w-md">
          <div className="mb-6">
            <Link href="/account" className="text-bred-500 hover:text-bred-700">
              ← Torna al tuo account
            </Link>
          </div>
          
          <h1 className="text-3xl font-bold mb-8 text-gray-600">Modifica account</h1>
          
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
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-600">Dettagli account</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      Nome *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500 text-gray-700"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Cognome *
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500 text-gray-700"
                      required
                    />
                  </div>
                </div>
                
                <div className="mb-6">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500 text-gray-700"
                    required
                  />
                </div>
              </div>
              
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-600">Cambio password</h2>
                <p className="text-sm text-gray-600 mb-4">Lascia vuoti questi campi se non vuoi cambiare la password.</p>
                
                <div className="mb-6">
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Password attuale (lascia vuoto per non cambiarla)
                  </label>
                  <input
                    type="password"
                    id="currentPassword"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500 text-gray-700"
                  />
                </div>
                
                <div className="mb-6">
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Nuova password (lascia vuoto per non cambiarla)
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                    minLength={6}
                  />
                </div>
                
                <div className="mb-6">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Conferma nuova password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                    minLength={6}
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 px-4 rounded-md text-white font-medium ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-bred-500 hover:bg-bred-700'}`}
              >
                {isSubmitting ? 'Salvataggio in corso...' : 'Salva modifiche'}
              </button>
            </form>
          </div>
        </div>
      </main>

    </div>
  );
}
