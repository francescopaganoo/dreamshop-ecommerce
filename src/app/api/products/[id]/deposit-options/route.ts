import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // In Next.js 14+, i params devono essere attesi prima dell'utilizzo
  const resolvedParams = await Promise.resolve(params);
  const productId = resolvedParams.id;
  
  if (!productId) {
    return NextResponse.json(
      { success: false, message: 'ID prodotto non fornito' },
      { status: 400 }
    );
  }

  try {
    // Correzione: uso NEXT_PUBLIC_WORDPRESS_URL invece di WORDPRESS_API_URL
    const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL;
    const wpEndpoint = `${baseUrl}wp-json/dreamshop/v1/products/${productId}/deposit-options`;
    
    console.log(`Chiamando API WordPress per deposito: ${wpEndpoint}`);
    
    const response = await fetch(wpEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
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
    console.error('Errore durante il recupero delle opzioni di acconto:', error);
    return NextResponse.json(
      { success: false, message: 'Errore durante il recupero delle opzioni di acconto' },
      { status: 500 }
    );
  }
}
