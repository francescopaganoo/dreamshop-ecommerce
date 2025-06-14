import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';
import jwt from 'jsonwebtoken';

// Chiave segreta per verificare i token JWT (in produzione, usare una variabile d'ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function PUT(request: NextRequest) {
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
      
      // Ottieni i dati da aggiornare
      const userData = await request.json();
      
      // Define a type for user update data that's compatible with WooCommerceData
      interface UserUpdateData {
        first_name?: string;
        last_name?: string;
        email?: string;
        password?: string;
        [key: string]: unknown; // Add index signature to make it compatible with WooCommerceData
      }
      
      // Prepara i dati per l'aggiornamento
      const updateData: UserUpdateData = {};
      
      if (userData.firstName !== undefined) updateData.first_name = userData.firstName;
      if (userData.lastName !== undefined) updateData.last_name = userData.lastName;
      if (userData.email !== undefined) updateData.email = userData.email;
      if (userData.password !== undefined) updateData.password = userData.password;
      
      // Define interface for WooCommerce customer response
      interface WooCommerceCustomer {
        id: number;
        username: string;
        email: string;
        first_name: string;
        last_name: string;
      }
      
      // Aggiorna l'utente in WooCommerce
      const response = await api.put(`customers/${decoded.id}`, updateData);
      const user = response.data as WooCommerceCustomer;
      
      if (!user) {
        return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
      }
      
      // Restituisci i dati aggiornati dell'utente
      return NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          displayName: `${user.first_name} ${user.last_name}`.trim()
        }
      });
      
    } catch (error) {
      console.error('Errore durante la verifica del token:', error);
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
  } catch (error) {
    console.error('Errore durante l\'aggiornamento dell\'utente:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
