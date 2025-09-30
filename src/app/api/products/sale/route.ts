import { NextRequest, NextResponse } from 'next/server';
import { getProductsOnSale } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '6', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    
    
    const products = await getProductsOnSale(page, limit, 'date', 'desc');
    
    
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching sale products:', error);
    return NextResponse.json({ error: 'Failed to fetch sale products' }, { status: 500 });
  }
}