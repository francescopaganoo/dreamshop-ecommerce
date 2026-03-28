'use client';

import { getFilteredProductsPlugin, Product, Category, ExtendedCategory, Brand, AttributeValue } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import CategorySidebar from '@/components/CategorySidebar';
import MobileFilterButton from '@/components/MobileFilterButton';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface CategoryPageClientProps {
  category: Category;
  categorySlug: string;
  initialProducts: Product[];
  initialTotal: number;
  initialSearchString: string;
  categories: ExtendedCategory[];
  brands: Brand[];
  availabilityOptions: AttributeValue[];
  shippingTimeOptions: AttributeValue[];
  priceRange: { min: number; max: number };
}

function CategoryPageClientContent({
  category,
  categorySlug,
  initialProducts,
  initialTotal,
  initialSearchString,
  categories,
  brands,
  availabilityOptions,
  shippingTimeOptions,
  priceRange,
}: CategoryPageClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [totalProducts, setTotalProducts] = useState(initialTotal);
  const [selectedBrandSlugs, setSelectedBrandSlugs] = useState<string[]>([]);
  const [selectedAvailabilitySlugs, setSelectedAvailabilitySlugs] = useState<string[]>([]);
  const [selectedShippingTimeSlugs, setSelectedShippingTimeSlugs] = useState<string[]>([]);
  const [selectedPriceRange, setSelectedPriceRange] = useState<{ min: number; max: number } | undefined>(undefined);
  const [excludeSoldOut, setExcludeSoldOut] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const brandsParam = searchParams.get('brands') || '';
  const availabilityParam = searchParams.get('availability') || '';
  const shippingParam = searchParams.get('shipping') || '';
  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');
  const excludeSoldOutParam = searchParams.get('excludeSoldOut') === 'true';
  const perPage = 12;

  const brandSlugsFromUrl = useMemo(() => {
    return brandsParam ? brandsParam.split(',') : [];
  }, [brandsParam]);

  const availabilitySlugsFromUrl = useMemo(() => {
    return availabilityParam ? availabilityParam.split(',') : [];
  }, [availabilityParam]);

  const shippingSlugsFromUrl = useMemo(() => {
    return shippingParam ? shippingParam.split(',') : [];
  }, [shippingParam]);

  const priceRangeFromUrl = useMemo(() => {
    if (minPriceParam && maxPriceParam) {
      return { min: parseInt(minPriceParam, 10), max: parseInt(maxPriceParam, 10) };
    }
    return undefined;
  }, [minPriceParam, maxPriceParam]);

  // Sync URL params to state
  useEffect(() => {
    setSelectedBrandSlugs(brandSlugsFromUrl);
    setSelectedAvailabilitySlugs(availabilitySlugsFromUrl);
    setSelectedShippingTimeSlugs(shippingSlugsFromUrl);
    setSelectedPriceRange(priceRangeFromUrl);
    setExcludeSoldOut(excludeSoldOutParam);
  }, [brandSlugsFromUrl, availabilitySlugsFromUrl, shippingSlugsFromUrl, priceRangeFromUrl, excludeSoldOutParam]);

  // Track which search params we already have data for
  const currentSearchString = searchParams.toString();
  const [loadedSearchString, setLoadedSearchString] = useState(initialSearchString);

  // Re-fetch products when URL params change
  useEffect(() => {
    if (currentSearchString === loadedSearchString) return;

    const abortController = new AbortController();

    async function fetchProducts() {
      setFilterLoading(true);
      try {
        const minPrice = minPriceParam ? parseInt(minPriceParam, 10) : undefined;
        const maxPrice = maxPriceParam ? parseInt(maxPriceParam, 10) : undefined;

        const filters = {
          category: categorySlug,
          brands: brandSlugsFromUrl.length > 0 ? brandSlugsFromUrl : undefined,
          availability: availabilitySlugsFromUrl.length > 0 ? availabilitySlugsFromUrl : undefined,
          shipping: shippingSlugsFromUrl.length > 0 ? shippingSlugsFromUrl : undefined,
          min_price: minPrice,
          max_price: maxPrice,
          exclude_sold_out: excludeSoldOutParam,
          page,
          per_page: perPage,
          orderby: 'date',
          order: 'desc'
        };

        const response = await getFilteredProductsPlugin(filters, abortController.signal);
        if (!abortController.signal.aborted) {
          setProducts(response.products);
          setTotalProducts(response.total);
          setLoadedSearchString(currentSearchString);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Error fetching category products:', error);
      } finally {
        if (!abortController.signal.aborted) {
          setFilterLoading(false);
        }
      }
    }

    fetchProducts();
    return () => abortController.abort();
  }, [currentSearchString, loadedSearchString, categorySlug, brandSlugsFromUrl, availabilitySlugsFromUrl, shippingSlugsFromUrl, minPriceParam, maxPriceParam, excludeSoldOutParam, page, perPage]);

  const handleApplyFilters = async (filters: {
    brandSlugs: string[];
    availabilitySlugs: string[];
    shippingTimeSlugs: string[];
    priceRange: { min: number; max: number };
    excludeSoldOut: boolean;
  }) => {
    setIsApplyingFilters(true);

    try {
      const newSearchParams = new URLSearchParams();

      if (filters.brandSlugs.length > 0) {
        newSearchParams.set('brands', filters.brandSlugs.join(','));
      }
      if (filters.availabilitySlugs.length > 0) {
        newSearchParams.set('availability', filters.availabilitySlugs.join(','));
      }
      if (filters.shippingTimeSlugs.length > 0) {
        newSearchParams.set('shipping', filters.shippingTimeSlugs.join(','));
      }
      if (filters.priceRange.min > priceRange.min || filters.priceRange.max < priceRange.max) {
        newSearchParams.set('minPrice', filters.priceRange.min.toString());
        newSearchParams.set('maxPrice', filters.priceRange.max.toString());
      }
      if (filters.excludeSoldOut) {
        newSearchParams.set('excludeSoldOut', 'true');
      }

      newSearchParams.delete('page');
      router.push(`/category/${categorySlug}?${newSearchParams.toString()}`);
    } finally {
      setTimeout(() => {
        setIsApplyingFilters(false);
      }, 500);
    }
  };

  const maxPage = Math.ceil(totalProducts / perPage);

  return (
    <>
      {/* Mobile Filter Button */}
      <MobileFilterButton onClick={() => setIsSidebarOpen(true)} />

      {/* Category Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">{category.name}</h1>
      </div>

      {/* Main content with sidebar */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:order-first">
          <CategorySidebar
            categories={categories}
            availabilityOptions={availabilityOptions}
            shippingTimeOptions={shippingTimeOptions}
            brands={brands}
            currentCategorySlug={categorySlug}
            selectedBrandSlugs={selectedBrandSlugs}
            selectedAvailabilitySlugs={selectedAvailabilitySlugs}
            selectedShippingTimeSlugs={selectedShippingTimeSlugs}
            priceRange={priceRange}
            selectedPriceRange={selectedPriceRange}
            excludeSoldOut={excludeSoldOut}
            onApplyFilters={handleApplyFilters}
            isApplyingFilters={isApplyingFilters}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
        </div>

        {/* Products Grid */}
        <div className="flex-1">
          {filterLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-bred-600 mb-4"></div>
                <p className="text-gray-600">Caricamento prodotti...</p>
              </div>
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {products
                  .filter((product, index, self) =>
                    index === self.findIndex(p => p.id === product.id)
                  )
                  .map((product: Product, index: number) => (
                    <ProductCard
                      key={`${product.id}-${index}`}
                      product={product}
                      priority={index < 6}
                    />
                  ))}
              </div>

              {/* Pagination */}
              {maxPage > 1 && (
                <div className="mt-8 flex justify-center">
                  <div className="flex items-center space-x-1 overflow-x-auto">
                    {page > 1 && (() => {
                      const prevParams = new URLSearchParams(searchParams.toString());
                      prevParams.set('page', (page - 1).toString());
                      return (
                        <Link
                          href={`/category/${categorySlug}?${prevParams.toString()}`}
                          className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 mr-1 sm:mr-2 text-sm sm:text-base whitespace-nowrap"
                        >
                          <span className="hidden sm:inline">Precedente</span>
                          <span className="sm:hidden">&#8249;</span>
                        </Link>
                      );
                    })()}

                    {(() => {
                      const pageNumbers = [];
                      const maxVisible = 7;
                      const start = Math.max(1, page - Math.floor(maxVisible / 2));
                      const end = Math.min(maxPage, start + maxVisible - 1);

                      if (start > 1) {
                        const firstParams = new URLSearchParams(searchParams.toString());
                        firstParams.set('page', '1');
                        pageNumbers.push(
                          <Link key={1} href={`/category/${categorySlug}?${firstParams.toString()}`}
                            className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 text-sm sm:text-base">
                            1
                          </Link>
                        );
                        if (start > 2) {
                          pageNumbers.push(
                            <span key="dots1" className="px-1 sm:px-2 py-2 text-gray-500 text-sm sm:text-base">...</span>
                          );
                        }
                      }

                      for (let i = start; i <= end; i++) {
                        if (i === page) {
                          pageNumbers.push(
                            <span key={i} className="px-2 sm:px-3 py-2 bg-bred-500 text-white rounded-md font-medium cursor-not-allowed text-sm sm:text-base">
                              {i}
                            </span>
                          );
                        } else {
                          const pageParams = new URLSearchParams(searchParams.toString());
                          pageParams.set('page', i.toString());
                          pageNumbers.push(
                            <Link key={i} href={`/category/${categorySlug}?${pageParams.toString()}`}
                              className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 text-sm sm:text-base">
                              {i}
                            </Link>
                          );
                        }
                      }

                      if (end < maxPage) {
                        if (end < maxPage - 1) {
                          pageNumbers.push(
                            <span key="dots2" className="px-1 sm:px-2 py-2 text-gray-500 text-sm sm:text-base">...</span>
                          );
                        }
                        const lastParams = new URLSearchParams(searchParams.toString());
                        lastParams.set('page', maxPage.toString());
                        pageNumbers.push(
                          <Link key={maxPage} href={`/category/${categorySlug}?${lastParams.toString()}`}
                            className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 text-sm sm:text-base">
                            {maxPage}
                          </Link>
                        );
                      }

                      return pageNumbers;
                    })()}

                    {page < maxPage && (() => {
                      const nextParams = new URLSearchParams(searchParams.toString());
                      nextParams.set('page', (page + 1).toString());
                      return (
                        <Link
                          href={`/category/${categorySlug}?${nextParams.toString()}`}
                          className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 ml-1 sm:ml-2 text-sm sm:text-base whitespace-nowrap"
                        >
                          <span className="hidden sm:inline">Successivo</span>
                          <span className="sm:hidden">&#8250;</span>
                        </Link>
                      );
                    })()}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Nessun prodotto trovato in questa categoria.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function CategoryPageClient(props: CategoryPageClientProps) {
  return <CategoryPageClientContent {...props} />;
}
