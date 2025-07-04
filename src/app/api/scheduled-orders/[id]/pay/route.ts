import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// Chiave segreta per verificare i token JWT
const JWT_SECRET = process.env.JWT_SECRET || 'dwi37ljio_5tk_3jt3';

export async function POST(request: NextRequest) {
  // Ottieni l'id dal percorso dell'URL invece di usare params
  const id = request.nextUrl.pathname.split('/').pop() || '';
  console.log('DEPRECATO: API /scheduled-orders/[id]/pay - Reindirizzamento a stripe-pay per ID:', id);
  
  // Ottieni il token dall'header Authorization
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('API Payment: Token non fornito o formato non valido');
    return NextResponse.json({ error: 'Token non fornito o formato non valido' }, { status: 401 });
  }
  
  const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
  
  try {
    // Verifica il token
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    
    if (!decoded || !decoded.id) {
      console.error('API Payment: Token decodificato non valido o mancante ID utente');
      return NextResponse.json({ error: 'Token non valido o ID utente mancante' }, { status: 401 });
    }
    
    console.log(`API Payment: Endpoint deprecato. Reindirizzamento a stripe-pay per ordine: ${id}`);
    
    // IMPORTANTE: questo endpoint è deprecato e viene mantenuto per compatibilità,
    // ma non crea più sessioni di pagamento per evitare doppie transazioni.
    // Restituiamo un messaggio che segnala di usare stripe-pay o paypal-pay a seconda del metodo desiderato.
    
    return NextResponse.json({
      success: false,
      error: 'Endpoint deprecato. Usa /stripe-pay o /paypal-pay per elaborare pagamenti.',
      deprecated: true
    });
    
  } catch (error) {
    console.error('Errore nella verifica del token:', error);
    return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
  }
}
