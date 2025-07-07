import { getAuthToken } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Ottieni il token di autenticazione
  const token = await getAuthToken();
  
  if (!token) {
    return NextResponse.json(
      { success: false, message: 'Utente non autenticato' },
      { status: 401 }
    );
  }

  try {
    const wpEndpoint = `${process.env.WORDPRESS_API_URL}/wp-json/dreamshop/v1/cart/deposit-checkout`;
    
    const response = await fetch(wpEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Errore API WordPress: ${response.status}`, errorText);
      return NextResponse.json(
        { success: false, message: `Errore dal server WordPress: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Errore durante il recupero dell\'URL di checkout:', error);
    return NextResponse.json(
      { success: false, message: 'Errore durante il recupero dell\'URL di checkout' },
      { status: 500 }
    );
  }
}
