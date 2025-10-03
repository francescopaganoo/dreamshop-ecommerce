import { NextRequest, NextResponse } from 'next/server';
import { getFilteredProductsPlugin } from '@/lib/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await params;
    const categorySlug = resolvedParams.slug;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '8', 10);

    // Usa il plugin per ottenere prodotti con attributi completi
    const response = await getFilteredProductsPlugin({
      category: categorySlug,
      page: 1,
      per_page: limit,
      orderby: 'date',
      order: 'desc',
      exclude_sold_out: true
    });

    return NextResponse.json(response.products);
  } catch (error) {
    console.error(`Error fetching products for category ${(await params).slug}:`, error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}