import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';
import jwt from 'jsonwebtoken';

// Chiave segreta per firmare i token JWT (in produzione, usare una variabile d'ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email e password sono richiesti' }, { status: 400 });
    }
    
    // Autenticazione con WooCommerce
    try {
      // WooCommerce non ha un endpoint di login diretto, quindi dobbiamo usare un approccio alternativo
      // Recupera i clienti con l'email fornita
      // Uso di string template per evitare problemi di tipo con params
      const response = await api.get(`customers?email=${encodeURIComponent(email)}`);
      
      const customers = response.data;
      
      if (!Array.isArray(customers) || customers.length === 0) {
        return NextResponse.json({ error: 'Utente non trovato' }, { status: 401 });
      }
      
      const user = customers[0];
      
      // Nota: WooCommerce REST API non permette di verificare direttamente la password
      // In un'implementazione reale, dovresti usare l'API di WordPress per l'autenticazione
      // Qui stiamo semplificando per scopi dimostrativi
      
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
      
    } catch (error) {
      console.error('Errore durante l\'autenticazione:', error);
      return NextResponse.json({ error: 'Errore di autenticazione' }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Errore durante il login:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
