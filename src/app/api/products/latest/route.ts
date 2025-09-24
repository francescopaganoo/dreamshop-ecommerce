import { NextRequest, NextResponse } from 'next/server';
import { getFilteredProductsPlugin } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '8');

    // Ottieni più prodotti per compensare i duplicati e i prodotti fuori stock
    const response = await getFilteredProductsPlugin({
      page: 1,
      per_page: limit * 2, // Prendiamo il doppio per avere margine
      orderby: 'date',
      order: 'desc'
    });

    // Filtra solo i prodotti in stock e rimuovi duplicati
    const seenIds = new Set();
    const uniqueProducts = response.products
      .filter(product => product.stock_status === 'instock')
      .filter(product => {
        if (seenIds.has(product.id)) {
          return false;
        }
        seenIds.add(product.id);
        return true;
      })
      .slice(0, limit); // Prendi solo il numero richiesto

    return NextResponse.json(uniqueProducts);
  } catch (error) {
    console.error('Error fetching latest products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest products' },
      { status: 500 }
    );
  }
}