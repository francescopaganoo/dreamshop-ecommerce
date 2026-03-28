import { getMegaMenuCategories, getFilteredProductsPlugin, getCategoryFilterOptionsPlugin, Product } from '@/lib/api';
import { getCategoryBySlugCached } from '@/lib/cachedApi';
import CategoryPageClient from '@/components/CategoryPageClient';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    minPrice?: string;
    maxPrice?: string;
    brands?: string;
    availability?: string;
    shipping?: string;
    excludeSoldOut?: string;
  }>;
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const initialSearchString = new URLSearchParams(resolvedSearchParams as Record<string, string>).toString();

  // Fetch category, filter options, and mega menu categories in parallel
  const [category, filterOptions, categoriesData] = await Promise.all([
    getCategoryBySlugCached(slug),
    getCategoryFilterOptionsPlugin(slug),
    getMegaMenuCategories()
  ]);

  if (!category) {
    notFound();
  }

  // Build filters from URL search params for initial server fetch
  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const brandSlugs = resolvedSearchParams.brands ? resolvedSearchParams.brands.split(',') : [];
  const availabilitySlugs = resolvedSearchParams.availability ? resolvedSearchParams.availability.split(',') : [];
  const shippingSlugs = resolvedSearchParams.shipping ? resolvedSearchParams.shipping.split(',') : [];
  const minPrice = resolvedSearchParams.minPrice ? parseInt(resolvedSearchParams.minPrice, 10) : undefined;
  const maxPrice = resolvedSearchParams.maxPrice ? parseInt(resolvedSearchParams.maxPrice, 10) : undefined;
  const excludeSoldOut = resolvedSearchParams.excludeSoldOut === 'true';

  // Fetch initial products on the server
  let initialProducts: Product[] = [];
  let initialTotal = 0;

  try {
    const response = await getFilteredProductsPlugin({
      category: slug,
      brands: brandSlugs.length > 0 ? brandSlugs : undefined,
      availability: availabilitySlugs.length > 0 ? availabilitySlugs : undefined,
      shipping: shippingSlugs.length > 0 ? shippingSlugs : undefined,
      min_price: minPrice,
      max_price: maxPrice,
      exclude_sold_out: excludeSoldOut,
      page,
      per_page: 12,
      orderby: 'date',
      order: 'desc'
    });
    initialProducts = response.products;
    initialTotal = response.total;
  } catch (error) {
    console.error('Error fetching initial category products:', error);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow py-8">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <nav className="mb-8 text-sm">
            <ol className="flex items-center space-x-2">
              <li>
                <Link href="/" className="text-bred-600 hover:underline">Home</Link>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-gray-500">/</span>
                <Link href="/categories" className="text-bred-600 hover:underline">Categorie</Link>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-gray-500">/</span>
                <span className="text-gray-700">{category.name}</span>
              </li>
            </ol>
          </nav>

          <CategoryPageClient
            category={category}
            categorySlug={slug}
            initialProducts={initialProducts}
            initialTotal={initialTotal}
            initialSearchString={initialSearchString}
            categories={categoriesData}
            brands={filterOptions.brands}
            availabilityOptions={filterOptions.availability}
            shippingTimeOptions={filterOptions.shipping_times}
            priceRange={filterOptions.price_range}
          />
        </div>
      </main>
    </div>
  );
}
