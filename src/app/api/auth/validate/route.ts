import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';
import jwt from 'jsonwebtoken';

// Define WooCommerce customer type
interface WooCommerceCustomer {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Necessary for WooCommerce API response fields
}

// Chiave segreta per verificare i token JWT (in produzione, usare una variabile d'ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

export async function GET(request: NextRequest) {
  try {
    // Ottieni il token dall'header Authorization
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token non fornito' }, { status: 401 });
    }
    
    const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
    
    try {
      // Verifica il token
      const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      
      // Ottieni i dati dell'utente da WooCommerce
      const response = await api.get(`customers/${decoded.id}`);
      const user = response.data as WooCommerceCustomer;
      
      if (!user) {
        return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
      }
      
      // Restituisci i dati dell'utente
      return NextResponse.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: `${user.first_name} ${user.last_name}`.trim()
      });
      
    } catch (error) {
      console.error('Errore durante la verifica del token:', error);
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
  } catch (error) {
    console.error('Errore durante la validazione:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
