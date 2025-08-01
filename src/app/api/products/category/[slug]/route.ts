import { NextRequest, NextResponse } from 'next/server';
import { getProductsByCategorySlug } from '@/lib/api';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const categorySlug = resolvedParams.slug;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '6', 10);
    
    const products = await getProductsByCategorySlug(categorySlug, 1, limit, 'date', 'desc');
    
    return NextResponse.json(products);
  } catch (error) {
    console.error(`Error fetching products for category ${params.slug}:`, error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}