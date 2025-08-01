import { NextRequest, NextResponse } from 'next/server';
import api from '@/lib/woocommerce';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

interface DecodedToken {
  id: number;
  email: string;
}

interface ShippingAddress {
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

export async function POST(request: NextRequest) {
  try {
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
    
    // Ottieni i dati dell'indirizzo dal body della richiesta
    const shippingAddress: ShippingAddress = await request.json();
    
    // Valida i campi obbligatori
    if (!shippingAddress.first_name || !shippingAddress.last_name || 
        !shippingAddress.address_1 || !shippingAddress.city || 
        !shippingAddress.state || !shippingAddress.postcode || 
        !shippingAddress.country) {
      return NextResponse.json({ 
        error: 'Campi obbligatori mancanti' 
      }, { status: 400 });
    }
    
    // Prepara i dati per WooCommerce
    const updateData = {
      shipping: {
        first_name: shippingAddress.first_name,
        last_name: shippingAddress.last_name,
        address_1: shippingAddress.address_1,
        address_2: shippingAddress.address_2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        postcode: shippingAddress.postcode,
        country: shippingAddress.country
      }
    };
    
    // Aggiorna l'utente in WooCommerce
    const response = await api.put(`customers/${decoded.id}`, updateData);
    
    if (!response.data) {
      throw new Error('Errore nell\'aggiornamento dell\'utente');
    }
    
    console.log('Indirizzo di spedizione salvato con successo per utente:', decoded.id);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Indirizzo di spedizione salvato con successo' 
    });
    
  } catch (error) {
    console.error('Errore nel salvataggio dell\'indirizzo di spedizione:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}