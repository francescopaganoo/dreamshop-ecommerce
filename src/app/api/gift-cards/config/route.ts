import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL;
    const consumerKey = process.env.NEXT_PUBLIC_WC_CONSUMER_KEY;
    const consumerSecret = process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET;

    if (!wordpressUrl) {
      return NextResponse.json(
        { error: 'WordPress URL non configurato' },
        { status: 500 }
      );
    }

    if (!consumerKey || !consumerSecret) {
      return NextResponse.json(
        { error: 'Credenziali WooCommerce non configurate' },
        { status: 500 }
      );
    }

    const apiUrl = `${wordpressUrl.replace(/\/$/, '')}/wp-json/gift-card/v1/config`;

    // Chiama l'API WordPress con autenticazione
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });


    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gift Card Config API - Error response:', errorText);
      return NextResponse.json(
        { error: 'Errore nel recupero configurazione gift card', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Errore API gift card config:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}