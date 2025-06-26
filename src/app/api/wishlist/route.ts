import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// Chiave segreta per verificare i token JWT
const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';
const WP_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://be.dreamshop18.com';

// Helper per verificare il token JWT
async function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  } catch (error) {
    console.error('Errore nella verifica del token:', error);
    return null;
  }
}

// GET - Ottiene la wishlist dell'utente
export async function GET(request: NextRequest) {
  try {
    // Ottieni il token dall'header Authorization
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token non fornito' }, { status: 401 });
    }
    
    const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
    
    // Verifica il token
    const decoded = await verifyToken(token);
    
    if (!decoded || !decoded.id) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
    const userId = decoded.id;
    
    // Chiama l'API WordPress per ottenere la wishlist
    const response = await fetch(`${WP_URL}/wp-json/dreamshop/v1/wishlist/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Errore nel recupero della wishlist' }, 
        { status: response.status }
      );
    }
    
    const wishlistData = await response.json();
    return NextResponse.json(wishlistData);
    
  } catch (error) {
    console.error('Errore nel recupero della wishlist:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

// POST - Aggiunge o rimuove un prodotto dalla wishlist
export async function POST(request: NextRequest) {
  try {
    // Ottieni il token dall'header Authorization
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token non fornito' }, { status: 401 });
    }
    
    const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
    
    // Verifica il token
    const decoded = await verifyToken(token);
    
    if (!decoded || !decoded.id) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
    const userId = decoded.id;
    
    // Ottieni i parametri dalla richiesta
    const { action, productId } = await request.json();
    
    if (!action || !productId) {
      return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
    }
    
    let endpoint = '';
    
    // Determina l'endpoint in base all'azione
    if (action === 'add') {
      endpoint = `${WP_URL}/wp-json/dreamshop/v1/wishlist/add`;
    } else if (action === 'remove') {
      endpoint = `${WP_URL}/wp-json/dreamshop/v1/wishlist/remove`;
    } else if (action === 'check') {
      endpoint = `${WP_URL}/wp-json/dreamshop/v1/wishlist/is-in-wishlist`;
    } else {
      return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
    }
    
    // Chiama l'API WordPress
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        product_id: productId,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || `Errore nell'operazione ${action}` }, 
        { status: response.status }
      );
    }
    
    const responseData = await response.json();
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('Errore nell\'operazione wishlist:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
