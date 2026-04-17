import { getFilteredProductsPlugin, getSaleFilterOptionsPlugin, getMegaMenuCategories, Product } from '@/lib/api';
import OfferteClient from '@/components/OfferteClient';
import { FaTags } from 'react-icons/fa';

const PRODUCTS_PER_PAGE = 12;

interface OffertePageProps {
  searchParams: Promise<{
    page?: string;
    minPrice?: string;
    maxPrice?: string;
    brands?: string;
    availability?: string;
    shipping?: string;
    excludeSoldOut?: string;
    category?: string;
  }>;
}

export default async function OffertePage({ searchParams }: OffertePageProps) {
  const resolvedSearchParams = await searchParams;
  const initialSearchString = new URLSearchParams(resolvedSearchParams as Record<string, string>).toString();

  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const categorySlug = resolvedSearchParams.category || undefined;
  const brandSlugs = resolvedSearchParams.brands ? resolvedSearchParams.brands.split(',') : [];
  const availabilitySlugs = resolvedSearchParams.availability ? resolvedSearchParams.availability.split(',') : [];
  const shippingSlugs = resolvedSearchParams.shipping ? resolvedSearchParams.shipping.split(',') : [];
  const minPrice = resolvedSearchParams.minPrice ? parseInt(resolvedSearchParams.minPrice, 10) : undefined;
  const maxPrice = resolvedSearchParams.maxPrice ? parseInt(resolvedSearchParams.maxPrice, 10) : undefined;
  const excludeSoldOut = resolvedSearchParams.excludeSoldOut === 'true';

  const [filterOptions, categoriesData] = await Promise.all([
    getSaleFilterOptionsPlugin(categorySlug),
    getMegaMenuCategories()
  ]);

  let initialProducts: Product[] = [];
  let initialTotal = 0;

  try {
    const response = await getFilteredProductsPlugin({
      on_sale: true,
      category: categorySlug,
      brands: brandSlugs.length > 0 ? brandSlugs : undefined,
      availability: availabilitySlugs.length > 0 ? availabilitySlugs : undefined,
      shipping: shippingSlugs.length > 0 ? shippingSlugs : undefined,
      min_price: minPrice,
      max_price: maxPrice,
      exclude_sold_out: excludeSoldOut,
      page,
      per_page: PRODUCTS_PER_PAGE,
      orderby: 'date',
      order: 'desc'
    });
    initialProducts = response.products;
    initialTotal = response.total;
  } catch (error) {
    console.error('Errore nel caricamento iniziale delle offerte:', error);
  }

  const activeCategoryName = categorySlug
    ? categoriesData.find(c => c.slug === categorySlug)?.name
    : undefined;

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">

      <div className="relative mb-16 pt-16 text-center overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-8 left-4 w-16 h-16 bg-bred-500/10 rounded-full hidden lg:block animate-pulse"></div>
        <div className="absolute top-12 right-4 w-24 h-24 bg-orange-500/10 rounded-full hidden lg:block animate-pulse delay-300"></div>

        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 bg-bred-500/10 text-bred-600 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <FaTags /> ESPLORA
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bangers text-gray-900 mb-6 leading-tight">
            {activeCategoryName ? (
              <>Offerte <span className="text-bred-500">{activeCategoryName}</span></>
            ) : (
              <>Tutte le <span className="text-bred-500">Offerte</span></>
            )}
          </h1>
          <p className="text-gray-600 text-lg max-w-3xl mx-auto mb-8 leading-relaxed">
            Approfitta delle nostre promozioni speciali e aggiungi pezzi unici alla tua collezione
          </p>
        </div>
      </div>

      {/* Products Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <OfferteClient
            initialProducts={initialProducts}
            initialTotal={initialTotal}
            initialSearchString={initialSearchString}
            productsPerPage={PRODUCTS_PER_PAGE}
            categories={categoriesData}
            brands={filterOptions.brands}
            availabilityOptions={filterOptions.availability}
            shippingTimeOptions={filterOptions.shipping_times}
            priceRange={filterOptions.price_range}
            activeCategorySlug={categorySlug}
          />
        </div>
      </section>
    </div>
  );
}
