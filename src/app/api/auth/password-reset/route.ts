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
    
    // Invia la richiesta di reset password al WordPress custom endpoint
    try {
      const backendUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL;
      const frontendUrl = process.env.NODE_ENV === 'production'
        ? 'https://dreamshop18.com' // Sostituisci con il tuo dominio frontend
        : 'http://localhost:3000';

      const response = await fetch(`${backendUrl}wp-json/custom/v1/password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          frontend_url: frontendUrl
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Restituisci una risposta di successo
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Errore durante la richiesta di reset password a WordPress:', error);

      // Anche in caso di errore, restituisci una risposta di successo per non rivelare informazioni sensibili
      return NextResponse.json({ success: true });
    }
    
  } catch (error) {
    console.error('Errore durante la richiesta di reset password:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
