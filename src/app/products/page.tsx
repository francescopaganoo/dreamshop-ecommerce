import { getMegaMenuCategories, getFilteredProductsPlugin, getFilterOptionsPlugin, Product } from '@/lib/api';
import ProductsClient from '@/components/ProductsClient';
import Link from 'next/link';
import { FaBox, FaStar, FaEye } from 'react-icons/fa';

interface ProductsPageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    brand?: string;
    brands?: string;
    availability?: string;
    shipping?: string;
    minPrice?: string;
    maxPrice?: string;
    excludeSoldOut?: string;
  }>;
}

const DEFAULT_FILTER_OPTIONS = {
  brands: [],
  availability: [],
  shipping_times: [],
  price_range: { min: 0, max: 10000 },
  categories: [],
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const initialSearchString = new URLSearchParams(params as Record<string, string>).toString();

  // Fetch filter options and categories on the server with fallback
  const [filterResult, categoriesResult] = await Promise.allSettled([
    getFilterOptionsPlugin(),
    getMegaMenuCategories()
  ]);

  const filterOptions = filterResult.status === 'fulfilled' ? filterResult.value : DEFAULT_FILTER_OPTIONS;
  const categoriesData = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];

  // Build filters from URL search params
  const page = parseInt(params.page || '1', 10);
  const brandSlugs = params.brands ? params.brands.split(',') : (params.brand ? [params.brand] : []);
  const availabilitySlugs = params.availability ? params.availability.split(',') : [];
  const shippingSlugs = params.shipping ? params.shipping.split(',') : [];
  const minPrice = params.minPrice ? parseInt(params.minPrice, 10) : undefined;
  const maxPrice = params.maxPrice ? parseInt(params.maxPrice, 10) : undefined;
  const excludeSoldOut = params.excludeSoldOut === 'true';

  // Fetch initial products on the server
  let initialProducts: Product[] = [];
  let initialTotal = 0;

  try {
    const response = await getFilteredProductsPlugin({
      category: params.category || undefined,
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
    console.error('Error fetching initial products:', error);
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">

      <main className="flex-grow py-8 md:py-16">
        <div className="container mx-auto px-4 md:px-6">
          {/* Breadcrumb */}
          <nav className="mb-8 text-sm">
            <ol className="flex items-center space-x-2">
              <li>
                <Link href="/" className="text-bred-600 hover:underline">Home</Link>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-gray-500">/</span>
                <span className="text-gray-700">Tutti i Prodotti</span>
              </li>
            </ol>
          </nav>

          {/* Enhanced Page Header */}
          <div className="relative mb-16 text-center">
            <div className="absolute -top-8 -left-8 w-16 h-16 bg-bred-500/10 rounded-full hidden lg:block animate-pulse"></div>
            <div className="absolute -top-4 -right-12 w-24 h-24 bg-orange-500/10 rounded-full hidden lg:block animate-pulse delay-300"></div>

            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 bg-bred-500/10 text-bred-600 px-4 py-2 rounded-full text-sm font-medium mb-4">
                <FaBox /> CATALOGO
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bangers text-gray-900 mb-6 leading-tight">
                Tutti i <span className="text-bred-500">Prodotti</span>
              </h1>
              <p className="text-gray-600 text-lg max-w-3xl mx-auto mb-8 leading-relaxed">
                Esplora l&apos;intero catalogo dei nostri prodotti. Figure, statue, carte collezionabili e molto altro.
              </p>
            </div>
          </div>

          <ProductsClient
            initialProducts={initialProducts}
            initialTotal={initialTotal}
            initialSearchString={initialSearchString}
            categories={categoriesData}
            brands={filterOptions.brands}
            availabilityOptions={filterOptions.availability}
            shippingTimeOptions={filterOptions.shipping_times}
            priceRange={filterOptions.price_range}
          />

          {/* Stats Section */}
          <div className="mt-20 bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="group">
                  <div className="w-16 h-16 bg-bred-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-bred-500/20 transition-colors">
                    <FaBox className="text-bred-500 text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">5000+</h3>
                  <p className="text-gray-600">Prodotti disponibili</p>
                </div>

                <div className="group">
                  <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-orange-500/20 transition-colors">
                    <FaStar className="text-orange-500 text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Premium</h3>
                  <p className="text-gray-600">Qualità Prodotti</p>
                </div>

                <div className="group">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-500/20 transition-colors">
                    <FaEye className="text-green-500 text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">100%</h3>
                  <p className="text-gray-600">Qualità Garantita</p>
                </div>
              </div>
            </div>
        </div>
      </main>

    </div>
  );
}
