import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const productId = url.searchParams.get('productId') || '1';
  
  
  // Test diretto dell'endpoint WordPress
  try {
    const wpEndpoint = `${process.env.WORDPRESS_API_URL}/wp-json/dreamshop/v1/products/${productId}/deposit-options`;
    
    
    const response = await fetch(wpEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const responseText = await response.text();

    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // Rimoviamo il parametro non utilizzato
      responseData = { raw: responseText };
    }

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      data: responseData,
      endpoint: wpEndpoint
    });
  } catch (error: Error | unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error testing endpoint:', error);
    return NextResponse.json({
      error: errorMessage || 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace available'
    }, { status: 500 });
  }
}
