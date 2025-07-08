import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const productId = url.searchParams.get('productId') || '54595';
  
  console.log(`Debug endpoint deposit - product ID: ${productId}`);
  
  try {
    // Ottieni l'URL corretto dall'ambiente
    const wpUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://be.dreamshop18.com';
    const wpEndpoint = `${wpUrl}/wp-json/dreamshop/v1/products/${productId}/deposit-options`;
    
    console.log('Calling WordPress endpoint:', wpEndpoint);
    
    // Effettua la chiamata all'endpoint
    const response = await fetch(wpEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch {
      // Se non è possibile parsare come JSON, restituisci il testo grezzo
      data = { raw: responseText };
    }
    
    // Dati di risposta completi
    return NextResponse.json({
      debug: {
        productId,
        wpUrl,
        endpoint: wpEndpoint,
        status: response.status,
        statusText: response.statusText,
      },
      response: data,
    });
    
  } catch (error: Error | unknown) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    console.error('Error testing deposit endpoint:', errorObj);
    return NextResponse.json({
      error: errorObj.message,
      stack: errorObj.stack
    }, { status: 500 });
  }
}
