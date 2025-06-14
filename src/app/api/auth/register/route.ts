import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';
import jwt from 'jsonwebtoken';

// Chiave segreta per firmare i token JWT (in produzione, usare una variabile d'ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName, username } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email e password sono richiesti' }, { status: 400 });
    }
    
    // Crea un nuovo cliente in WooCommerce
    try {
      const customerData = {
        email,
        first_name: firstName || '',
        last_name: lastName || '',
        username: username || email, // Se non viene fornito uno username, usa l'email
        password
      };
      
      const response = await api.post('customers', customerData);
      
      if (!response.data) {
        throw new Error('Errore nella creazione dell\'utente');
      }
      
      // Define interface for WooCommerce customer response
      interface WooCommerceCustomer {
        id: number;
        username: string;
        email: string;
        first_name: string;
        last_name: string;
      }
      
      const user = response.data as WooCommerceCustomer;
      
      // Crea un token JWT
      const token = jwt.sign(
        { 
          id: user.id,
          email: user.email,
          username: user.username
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      // Restituisci il token e i dati dell'utente
      return NextResponse.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          displayName: `${user.first_name} ${user.last_name}`.trim()
        }
      });
      
    } catch (error: unknown) {
      console.error('Errore durante la registrazione:', error);
      
      // Define a type for WooCommerce API errors
      interface WooCommerceError {
        response?: {
          data?: {
            message?: string;
          };
        };
      }
      
      // Gestisci gli errori specifici di WooCommerce
      if (error && typeof error === 'object' && (error as WooCommerceError).response?.data?.message) {
        const wooError = error as WooCommerceError;
        return NextResponse.json({ error: wooError.response!.data!.message }, { status: 400 });
      }
      
      return NextResponse.json({ error: 'Errore durante la registrazione' }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Errore durante la registrazione:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
