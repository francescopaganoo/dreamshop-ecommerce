import { NextRequest, NextResponse } from 'next/server';
import api from '@/lib/woocommerce';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

interface DecodedToken {
  id: number;
  email: string;
}

interface WooCommerceUser {
  id: number;
  email: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    email?: string;
    phone?: string;
  };
  shipping?: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    console.log('API addresses: Iniziata richiesta indirizzi');
    
    // Ottieni il token dall'header Authorization
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('API: Token non fornito o formato non valido');
      return NextResponse.json({ error: 'Token non fornito' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    // Verifica il token JWT
    let decoded: DecodedToken;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
      console.log('Token verificato per userId:', decoded.id);
    } catch (jwtError) {
      console.error('Errore nella verifica del token JWT:', jwtError);
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
    console.log('Recupero dati utente da WooCommerce per ID:', decoded.id);
    
    // Recupera i dati dell'utente da WooCommerce
    let userData;
    try {
      userData = await api.get(`customers/${decoded.id}`);
      console.log('Risposta WooCommerce ricevuta');
    } catch (wooError) {
      console.error('Errore nella chiamata a WooCommerce:', wooError);
      return NextResponse.json({ 
        error: 'Errore nel recupero dei dati utente' 
      }, { status: 500 });
    }
    
    if (!userData.data) {
      console.error('Dati utente non trovati in WooCommerce');
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    }
    
    console.log('Dati utente recuperati con successo');
    const user = userData.data as WooCommerceUser;
    
    console.log('Estrazione indirizzi...');
    // Estrai gli indirizzi
    const addresses = {
      billing: user.billing ? {
        first_name: user.billing.first_name || '',
        last_name: user.billing.last_name || '',
        company: user.billing.company || '',
        address_1: user.billing.address_1 || '',
        address_2: user.billing.address_2 || '',
        city: user.billing.city || '',
        state: user.billing.state || '',
        postcode: user.billing.postcode || '',
        country: user.billing.country || 'IT',
        email: user.billing.email || user.email || '',
        phone: user.billing.phone || ''
      } : null,
      shipping: user.shipping ? {
        first_name: user.shipping.first_name || '',
        last_name: user.shipping.last_name || '',
        address_1: user.shipping.address_1 || '',
        address_2: user.shipping.address_2 || '',
        city: user.shipping.city || '',
        state: user.shipping.state || '',
        postcode: user.shipping.postcode || '',
        country: user.shipping.country || 'IT'
      } : null
    };
    
    console.log('Indirizzi estratti e pronti per la risposta');
    return NextResponse.json(addresses);
    
  } catch (error) {
    console.error('Errore nel recupero degli indirizzi:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}