import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Estrai l'ID dal percorso URL come negli altri route handler del progetto
  const productId = request.nextUrl.pathname.split('/')[3]; // /api/products/[id]/deposit-options
  
  if (!productId) {
    return NextResponse.json(
      { success: false, message: 'ID prodotto non fornito' },
      { status: 400 }
    );
  }

  try {
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

    // Gestione speciale per errore 400 - Prodotto senza opzioni di acconto
    if (response.status === 400) {
      console.log(`Prodotto ${productId} non supporta acconti`);
      return NextResponse.json({
        success: true, // Impostiamo success: true per non far scattare messaggi di errore nel frontend
        deposit_enabled: false, // Indichiamo esplicitamente che l'acconto non è disponibile
        product_id: productId,
        message: "Acconto non disponibile per questo prodotto"
      });
    }
    
    // Altri tipi di errori
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
