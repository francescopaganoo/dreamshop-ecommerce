import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token o password non forniti' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La password deve essere lunga almeno 6 caratteri' }, { status: 400 });
    }

    // Invia la richiesta di reset password al WordPress
    const backendUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL;

    const response = await fetch(`${backendUrl}wp-json/custom/v1/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        password
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: responseData.message || 'Errore durante il reset della password' }, { status: response.status });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Errore durante il reset della password:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}