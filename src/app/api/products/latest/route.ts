import { NextRequest, NextResponse } from 'next/server';

// Forza il rendering dinamico per avere sempre i prodotti più recenti
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '8');

    const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';
    const apiUrl = `${baseUrl}/wp-json/dreamshop/v1/products/latest?limit=${limit}`;

    // Chiamata diretta al nuovo endpoint WordPress ottimizzato
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      cache: 'no-store' // Nessuna cache
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WordPress API error! status: ${response.status}. Response: ${errorText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'WordPress API returned error');
    }

    // Restituisci direttamente i prodotti dal nuovo endpoint
    return NextResponse.json(data.data.products, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error fetching latest products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest products' },
      { status: 500 }
    );
  }
}