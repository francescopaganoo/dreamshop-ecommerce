import { NextRequest, NextResponse } from 'next/server';
import api from '@/lib/woocommerce';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

export async function GET(request: NextRequest) {
  try {
    // Ottieni il token dall'header Authorization
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token non fornito' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    // Verifica il token JWT
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
      console.log('Token decodificato:', decoded);
    } catch (jwtError) {
      console.error('Errore JWT:', jwtError);
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
    // Test chiamata a WooCommerce
    try {
      console.log('Test chiamata WooCommerce per user ID:', decoded.id);
      const userData = await api.get(`customers/${decoded.id}`);
      console.log('Dati utente WooCommerce:', JSON.stringify(userData.data, null, 2));
      
      return NextResponse.json({
        tokenDecoded: decoded,
        userDataExists: !!userData.data,
        userData: userData.data
      });
    } catch (wooError: any) {
      console.error('Errore WooCommerce:', wooError);
      return NextResponse.json({
        error: 'Errore WooCommerce',
        details: wooError.message || wooError.toString(),
        tokenDecoded: decoded
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('Errore generale:', error);
    return NextResponse.json({
      error: 'Errore generale',
      details: error.message || error.toString()
    }, { status: 500 });
  }
}