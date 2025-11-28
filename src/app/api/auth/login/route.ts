import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';
import jwt from 'jsonwebtoken';
import axios from 'axios';

// Chiave segreta per firmare i token JWT (in produzione, usare una variabile d'ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';
const WP_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL!;

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
      
      // Ora utilizziamo JWT per verificare la password
      try {
        // Chiamata all'API JWT di WordPress per autenticare l'utente
        const jwtResponse = await axios.post(`${WP_URL}wp-json/jwt-auth/v1/token`, {
          username: email,
          password: password
        });
        
        const jwtData = jwtResponse.data;
        
        if (!jwtData.token) {
          return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 });
        }
        
        // Crea un token JWT per l'utente con i dati di WooCommerce
        const token = jwt.sign(
          { 
            id: user.id, 
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            // Aggiungiamo il token JWT di WordPress per eventuali richieste future
            wpToken: jwtData.token
          }, 
          JWT_SECRET, 
          { expiresIn: '60d' }
        );
        
        // Imposta il token in un cookie HTTP-only e restituiscilo anche nella risposta
        const responseObj = NextResponse.json({ 
          success: true, 
          token: token, // Aggiungiamo il token nella risposta per localStorage
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name
          }
        });
        
        // Imposta il cookie con il token JWT per sicurezza aggiuntiva
        responseObj.cookies.set({
          name: 'authToken',
          value: token,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7, // 7 giorni
          path: '/',
        });
        
        return responseObj;
        
      } catch (error) {
        console.error('Errore durante l\'autenticazione:', error);
        return NextResponse.json({ error: 'Errore di autenticazione' }, { status: 500 });
      }
      
    } catch (error) {
      console.error('Errore durante il login:', error);
      return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Errore durante il login:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
