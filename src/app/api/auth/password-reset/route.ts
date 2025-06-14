import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email non fornita' }, { status: 400 });
    }
    
    // Verifica che l'email esista nel sistema WooCommerce
    // Uso di string template per evitare problemi di tipo con params
    const customersResponse = await api.get(`customers?email=${encodeURIComponent(email)}&per_page=1`);
    
    const customers = customersResponse.data;
    
    if (!Array.isArray(customers) || customers.length === 0) {
      // Non rivelare se l'email esiste o meno per motivi di sicurezza
      return NextResponse.json({ success: true });
    }
    
    // Invia la richiesta di reset password a WooCommerce
    try {
      await api.post('customers/password-reset', {
        email: email
      });
      
      // Restituisci una risposta di successo
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Errore durante la richiesta di reset password a WooCommerce:', error);
      
      // Anche in caso di errore, restituisci una risposta di successo per non rivelare informazioni sensibili
      return NextResponse.json({ success: true });
    }
    
  } catch (error) {
    console.error('Errore durante la richiesta di reset password:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
