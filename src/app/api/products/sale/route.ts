import { NextRequest, NextResponse } from 'next/server';
import { getProductsOnSale } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '6', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    
    console.log(`API: Caricamento prodotti in offerta - Pagina ${page}, Limite ${limit}`);
    
    const products = await getProductsOnSale(page, limit, 'date', 'desc');
    
    console.log(`API: Trovati ${products.length} prodotti in offerta per pagina ${page}`);
    
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching sale products:', error);
    return NextResponse.json({ error: 'Failed to fetch sale products' }, { status: 500 });
  }
}