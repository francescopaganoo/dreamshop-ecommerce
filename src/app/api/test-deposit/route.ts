import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const productId = url.searchParams.get('productId') || '1';
  
  console.log('Test endpoint - product ID:', productId);
  
  // Test diretto dell'endpoint WordPress
  try {
    const wpEndpoint = `${process.env.WORDPRESS_API_URL}/wp-json/dreamshop/v1/products/${productId}/deposit-options`;
    
    console.log('Calling WordPress endpoint:', wpEndpoint);
    
    const response = await fetch(wpEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log('Response parsed successfully');
    } catch (e) {
      console.log('Failed to parse response as JSON');
      responseData = { raw: responseText };
    }

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      data: responseData,
      endpoint: wpEndpoint
    });
  } catch (error: any) {
    console.error('Error testing endpoint:', error);
    return NextResponse.json({
      error: error.message || 'Unknown error',
      stack: error.stack
    }, { status: 500 });
  }
}
