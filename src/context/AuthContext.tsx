'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getReturnUrl, clearReturnUrl } from '../lib/auth';

// Definizione del tipo utente
export interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
}

// Definizione dell'interfaccia del contesto di autenticazione
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; redirectUrl?: string }>;
  register: (userData: RegisterData) => Promise<boolean>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => Promise<boolean>;
}

// Dati per la registrazione
export interface RegisterData {
  email: string;
  password: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

// Creazione del contesto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider del contesto
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Verifica se l'utente è già autenticato al caricamento della pagina
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Controlla se esiste un token nel localStorage
        const storedToken = localStorage.getItem('woocommerce_token');
        
        if (storedToken) {
          // Verifica la validità del token
          const response = await fetch('/api/auth/validate', {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            setToken(storedToken);
          } else {
            // Token non valido, rimuovilo
            localStorage.removeItem('woocommerce_token');
            setUser(null);
            setToken(null);
          }
        }
      } catch (error) {
        console.error('Errore durante la verifica dell\'autenticazione:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Funzione di login
  const login = async (email: string, password: string): Promise<{ success: boolean; redirectUrl?: string }> => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) {
        throw new Error('Login fallito');
      }
      
      const data = await response.json();
      
      // Salva il token nel localStorage
      localStorage.setItem('woocommerce_token', data.token);
      setToken(data.token);
      
      // Imposta i dati dell'utente
      setUser(data.user);
      setIsLoading(false);
      
      // Recupera l'URL di ritorno se esiste
      const returnUrl = getReturnUrl();
      if (returnUrl) {
        clearReturnUrl();
        return { success: true, redirectUrl: returnUrl };
      }
      
      return { success: true, redirectUrl: '/account' };
    } catch (error) {
      console.error('Errore durante il login:', error);
      setIsLoading(false);
      return { success: false };
    }
  };

  // Funzione di registrazione
  const register = async (userData: RegisterData): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        throw new Error('Registrazione fallita');
      }
      
      const data = await response.json();
      
      // Salva il token nel localStorage
      localStorage.setItem('woocommerce_token', data.token);
      
      // Imposta i dati dell'utente
      setUser(data.user);
      setIsLoading(false);
      
      return true;
    } catch (error) {
      console.error('Errore durante la registrazione:', error);
      setIsLoading(false);
      return false;
    }
  };

  // Funzione di logout
  const logout = () => {
    // Rimuovi il token dal localStorage
    localStorage.removeItem('woocommerce_token');
    
    // Reimposta lo stato dell'utente e del token
    setUser(null);
    setToken(null);
  };

  // Funzione per aggiornare i dati dell'utente
  const updateUser = async (userData: Partial<User>): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const token = localStorage.getItem('woocommerce_token');
      
      if (!token) {
        throw new Error('Utente non autenticato');
      }
      
      const response = await fetch('/api/auth/update-user', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        throw new Error('Aggiornamento fallito');
      }
      
      const data = await response.json();
      
      // Aggiorna i dati dell'utente
      setUser(prevUser => prevUser ? { ...prevUser, ...data.user } : null);
      setIsLoading(false);
      
      return true;
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dell\'utente:', error);
      setIsLoading(false);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      token,
      login,
      register,
      logout,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook personalizzato per utilizzare il contesto di autenticazione
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth deve essere utilizzato all\'interno di un AuthProvider');
  }
  
  return context;
}
