import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token non fornito' }, { status: 400 });
    }

    // Verifica il token con WordPress
    const backendUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL;

    const response = await fetch(`${backendUrl}wp-json/custom/v1/verify-reset-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 400 });
    }

    return NextResponse.json({ valid: true });

  } catch (error) {
    console.error('Errore durante la verifica del token:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}