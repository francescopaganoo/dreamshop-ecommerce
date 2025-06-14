import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';
import jwt from 'jsonwebtoken';

// Chiave segreta per verificare i token JWT
const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

export async function POST(request: NextRequest) {
  try {
    // Ottieni il token dall'header Authorization
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('API Points Add: Token non fornito o formato non valido');
      return NextResponse.json({ error: 'Token non fornito' }, { status: 401 });
    }
    
    const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
    
    try {
      // Verifica il token
      const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      
      if (!decoded || !decoded.id) {
        console.error('API Points Add: Token decodificato non valido o mancante ID utente');
        return NextResponse.json({ error: 'Token non valido o ID utente mancante' }, { status: 401 });
      }
      
      // Ottieni i dati dalla richiesta
      const { points, description, order_id } = await request.json();
      
      if (!points || isNaN(points)) {
        return NextResponse.json({ error: 'Punti non validi' }, { status: 400 });
      }
      
      console.log(`API Points Add: Aggiunta di ${points} punti per utente ID: ${decoded.id}`);
      
      try {
        // Chiamata all'API personalizzata di WooCommerce per aggiungere punti
        const response = await api.post('points/add', {
          user_id: decoded.id,
          points: points,
          description: description || 'Punti guadagnati dall\'acquisto',
          order_id: order_id || 0
        });
        
        const pointsData = response.data;
        
        return NextResponse.json(pointsData);
      } catch (error: any) {
        console.error('API Points Add: Errore durante l\'aggiunta dei punti:', error.message);
        return NextResponse.json(
          { error: 'Errore durante l\'aggiunta dei punti', details: error.message },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('API Points Add: Errore durante la verifica del token:', error);
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
  } catch (error) {
    console.error('API Points Add: Errore generico:', error);
    return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
  }
}
