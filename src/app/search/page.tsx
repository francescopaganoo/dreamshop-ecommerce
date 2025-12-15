'use client';

import { getFilteredProductsPlugin, getFilterOptionsPlugin, Product, Brand, AttributeValue, matchesAllWords } from '../../lib/api';
import ProductCard from '../../components/ProductCard';
import CategorySidebar from '../../components/CategorySidebar';
import MobileFilterButton from '../../components/MobileFilterButton';
import Link from 'next/link';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// Next.js 15 has a known issue with TypeScript definitions for page components
// where the params type doesn't satisfy the PageProps constraint

function SearchPageContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [availabilityOptions, setAvailabilityOptions] = useState<AttributeValue[]>([]);
  const [shippingTimeOptions, setShippingTimeOptions] = useState<AttributeValue[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 100 });
  const [selectedPriceRange, setSelectedPriceRange] = useState<{ min: number; max: number } | undefined>(undefined);
  const [selectedBrandSlugs, setSelectedBrandSlugs] = useState<string[]>([]);
  const [selectedAvailabilitySlugs, setSelectedAvailabilitySlugs] = useState<string[]>([]);
  const [selectedShippingTimeSlugs, setSelectedShippingTimeSlugs] = useState<string[]>([]);
  const [excludeSoldOut, setExcludeSoldOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  const searchQuery = searchParams.get('q') || '';
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
  const perPage = 12;

  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');
  const brandsParam = searchParams.get('brands');
  const availabilityParam = searchParams.get('availability');
  const shippingParam = searchParams.get('shipping');
  const excludeSoldOutParam = searchParams.get('excludeSoldOut') === 'true';

  // Create selected price range from URL params
  const getSelectedPriceRangeFromUrl = useCallback(() => {
    if (minPriceParam && maxPriceParam) {
      return {
        min: parseInt(minPriceParam, 10),
        max: parseInt(maxPriceParam, 10)
      };
    }
    return undefined;
  }, [minPriceParam, maxPriceParam]);

  useEffect(() => {
    setSelectedPriceRange(getSelectedPriceRangeFromUrl());
  }, [minPriceParam, maxPriceParam, getSelectedPriceRangeFromUrl]);

  // Update selected filters from URL
  useEffect(() => {
    if (brandsParam) {
      setSelectedBrandSlugs(brandsParam.split(','));
    } else {
      setSelectedBrandSlugs([]);
    }

    if (availabilityParam) {
      setSelectedAvailabilitySlugs(availabilityParam.split(','));
    } else {
      setSelectedAvailabilitySlugs([]);
    }

    if (shippingParam) {
      setSelectedShippingTimeSlugs(shippingParam.split(','));
    } else {
      setSelectedShippingTimeSlugs([]);
    }

    setExcludeSoldOut(excludeSoldOutParam);
  }, [brandsParam, availabilityParam, shippingParam, excludeSoldOutParam]);

  // Apply all filters at once
  const handleApplyFilters = async (filters: {
    brandSlugs: string[];
    availabilitySlugs: string[];
    shippingTimeSlugs: string[];
    priceRange: { min: number; max: number };
    excludeSoldOut: boolean;
  }) => {
    setIsApplyingFilters(true);

    try {
      setSelectedBrandSlugs(filters.brandSlugs);
      setSelectedAvailabilitySlugs(filters.availabilitySlugs);
      setSelectedShippingTimeSlugs(filters.shippingTimeSlugs);
      setSelectedPriceRange(filters.priceRange);
      setExcludeSoldOut(filters.excludeSoldOut);

      // Build new URL with all filters
      const newSearchParams = new URLSearchParams();

      if (searchQuery) {
        newSearchParams.set('q', searchQuery);
      }

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

      // Reset to first page
      newSearchParams.delete('page');

      const newUrl = `/search?${newSearchParams.toString()}`;
      router.push(newUrl);
    } finally {
      setTimeout(() => {
        setIsApplyingFilters(false);
        setFilterLoading(false);
      }, 500);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Get filter options
        const filterOptions = await getFilterOptionsPlugin();

        setAvailabilityOptions(filterOptions.availability);
        setShippingTimeOptions(filterOptions.shipping_times);
        setBrands(filterOptions.brands);
        setPriceRange(filterOptions.price_range);

        // If no search query, don't fetch products
        if (!searchQuery) {
          setProducts([]);
          setTotalProducts(0);
          setLoading(false);
          return;
        }

        // Parse price filters from URL
        const minPrice = minPriceParam ? parseInt(minPriceParam, 10) : undefined;
        const maxPrice = maxPriceParam ? parseInt(maxPriceParam, 10) : undefined;

        // Per ricerche multi-parola, usa ogni parola separatamente per la ricerca API
        // poi filtra i risultati lato client per trovare i prodotti che matchano tutte le parole
        const searchWords = searchQuery.trim().split(/\s+/).filter(word => word.length > 0);
        const isMultiWordSearch = searchWords.length > 1;

        let allProducts: Product[] = [];
        let apiTotal = 0;

        if (isMultiWordSearch) {
          // Cerca con ogni parola separatamente e combina i risultati
          const searchPromises = searchWords.map(word =>
            getFilteredProductsPlugin({
              search: word,
              brands: selectedBrandSlugs.length > 0 ? selectedBrandSlugs : undefined,
              availability: selectedAvailabilitySlugs.length > 0 ? selectedAvailabilitySlugs : undefined,
              shipping: selectedShippingTimeSlugs.length > 0 ? selectedShippingTimeSlugs : undefined,
              min_price: minPrice,
              max_price: maxPrice,
              exclude_sold_out: excludeSoldOut,
              per_page: 100, // Fetch more to have enough for filtering
              orderby: 'date',
              order: 'desc'
            })
          );

          const results = await Promise.all(searchPromises);

          // Combina tutti i prodotti e rimuovi duplicati
          const productMap = new Map<number, Product>();
          results.forEach(result => {
            result.products.forEach(product => {
              productMap.set(product.id, product);
            });
          });
          allProducts = Array.from(productMap.values());
        } else {
          // Ricerca singola parola - usa il comportamento normale
          const filters = {
            search: searchQuery,
            brands: selectedBrandSlugs.length > 0 ? selectedBrandSlugs : undefined,
            availability: selectedAvailabilitySlugs.length > 0 ? selectedAvailabilitySlugs : undefined,
            shipping: selectedShippingTimeSlugs.length > 0 ? selectedShippingTimeSlugs : undefined,
            min_price: minPrice,
            max_price: maxPrice,
            exclude_sold_out: excludeSoldOut,
            page,
            per_page: perPage,
            orderby: 'date',
            order: 'desc'
          };
          const productsResponse = await getFilteredProductsPlugin(filters);
          allProducts = productsResponse.products;
          apiTotal = productsResponse.total; // Usa il totale dall'API
        }

        // Filtra i prodotti usando la ricerca multi-parola lato client
        const filteredProducts = allProducts.filter(product =>
          matchesAllWords(product.name, searchQuery)
        );

        // Per ricerche multi-parola, applica la paginazione lato client
        if (isMultiWordSearch) {
          const startIndex = (page - 1) * perPage;
          const paginatedProducts = filteredProducts.slice(startIndex, startIndex + perPage);
          setProducts(paginatedProducts);
          setTotalProducts(filteredProducts.length);
        } else {
          // Per ricerche singola parola, usa il totale dall'API per la paginazione corretta
          setProducts(filteredProducts);
          setTotalProducts(apiTotal);
        }
      } catch (error) {
        console.error('Error fetching search results:', error);
      } finally {
        setLoading(false);
        setFilterLoading(false);
      }
    }

    fetchData();
  }, [searchQuery, page, perPage, selectedBrandSlugs, selectedAvailabilitySlugs, selectedShippingTimeSlugs, excludeSoldOut, minPriceParam, maxPriceParam, excludeSoldOutParam]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Caricamento...</div>;
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
                <span className="text-gray-700">Ricerca{searchQuery && `: "${searchQuery}"`}</span>
              </li>
            </ol>
          </nav>

          {/* Mobile Filter Button */}
          {searchQuery && <MobileFilterButton onClick={() => setIsSidebarOpen(true)} />}

          {/* Search Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2 text-gray-900">
              {searchQuery
                ? `Risultati di ricerca per "${searchQuery}"`
                : 'Cerca prodotti'
              }
            </h1>
          </div>

          {/* Search Form */}
          {!searchQuery && (
            <div className="mb-12 max-w-2xl mx-auto">
              <form action="/search" method="get" className="flex">
                <input
                  type="text"
                  name="q"
                  placeholder="Cerca prodotti..."
                  className="flex-grow px-4 py-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-bred-500"
                  required
                />
                <button
                  type="submit"
                  className="bg-bred-500 text-white px-6 py-3 rounded-r-md font-medium hover:bg-bred-600 transition-colors"
                >
                  Cerca
                </button>
              </form>
            </div>
          )}

          {/* Main content with sidebar */}
          {searchQuery && (
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Sidebar */}
              <div className="lg:order-first">
                <CategorySidebar
                  categories={[]}
                  availabilityOptions={availabilityOptions}
                  shippingTimeOptions={shippingTimeOptions}
                  brands={brands}
                  currentCategorySlug=""
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

              {/* Products Section */}
              <div className="flex-1">
                {/* Products Grid */}
                {filterLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-bred-600 mb-4"></div>
                      <p className="text-gray-600">Applicazione filtri...</p>
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
                    {totalProducts > perPage && (
                      <div className="mt-8 flex justify-center">
                        <div className="flex items-center space-x-1 overflow-x-auto">
                          {/* Precedente */}
                          {page > 1 && (() => {
                            const prevSearchParams = new URLSearchParams(window.location.search);
                            prevSearchParams.set('page', (page - 1).toString());
                            return (
                              <Link
                                href={`/search?${prevSearchParams.toString()}`}
                                className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 mr-1 sm:mr-2 text-sm sm:text-base whitespace-nowrap"
                              >
                                <span className="hidden sm:inline">Precedente</span>
                                <span className="sm:hidden">‹</span>
                              </Link>
                            );
                          })()}

                          {/* Numeri pagina */}
                          {(() => {
                            const pageNumbers = [];
                            const maxVisible = typeof window !== 'undefined' && window.innerWidth < 640 ? 3 : 7;
                            const maxPage = Math.ceil(totalProducts / perPage);

                            const start = Math.max(1, page - Math.floor(maxVisible / 2));
                            const end = Math.min(maxPage, start + maxVisible - 1);

                            // Prima pagina
                            if (start > 1 && (typeof window === 'undefined' || window.innerWidth >= 640 || maxVisible > 3)) {
                              const firstPageParams = new URLSearchParams(window.location.search);
                              firstPageParams.set('page', '1');
                              pageNumbers.push(
                                <Link
                                  key={1}
                                  href={`/search?${firstPageParams.toString()}`}
                                  className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 text-sm sm:text-base"
                                >
                                  1
                                </Link>
                              );

                              if (start > 2) {
                                pageNumbers.push(
                                  <span key="dots1" className="px-1 sm:px-2 py-2 text-gray-500 text-sm sm:text-base">...</span>
                                );
                              }
                            }

                            // Pagine centrali
                            for (let i = start; i <= end; i++) {
                              if (i === page) {
                                pageNumbers.push(
                                  <span
                                    key={i}
                                    className="px-2 sm:px-3 py-2 bg-bred-500 text-white rounded-md font-medium cursor-not-allowed text-sm sm:text-base"
                                  >
                                    {i}
                                  </span>
                                );
                              } else if (i <= maxPage) {
                                const pageParams = new URLSearchParams(window.location.search);
                                pageParams.set('page', i.toString());
                                pageNumbers.push(
                                  <Link
                                    key={i}
                                    href={`/search?${pageParams.toString()}`}
                                    className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 text-sm sm:text-base"
                                  >
                                    {i}
                                  </Link>
                                );
                              }
                            }

                            // Ultima pagina
                            if (end < maxPage && (typeof window === 'undefined' || window.innerWidth >= 640)) {
                              if (end < maxPage - 1) {
                                pageNumbers.push(
                                  <span key="dots2" className="px-1 sm:px-2 py-2 text-gray-500 text-sm sm:text-base">...</span>
                                );
                              }

                              const lastPageParams = new URLSearchParams(window.location.search);
                              lastPageParams.set('page', maxPage.toString());
                              pageNumbers.push(
                                <Link
                                  key={maxPage}
                                  href={`/search?${lastPageParams.toString()}`}
                                  className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 text-sm sm:text-base"
                                >
                                  {maxPage}
                                </Link>
                              );
                            }

                            return pageNumbers;
                          })()}

                          {/* Successivo */}
                          {page < Math.ceil(totalProducts / perPage) && (() => {
                            const nextSearchParams = new URLSearchParams(window.location.search);
                            nextSearchParams.set('page', (page + 1).toString());
                            return (
                              <Link
                                href={`/search?${nextSearchParams.toString()}`}
                                className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 ml-1 sm:ml-2 text-sm sm:text-base whitespace-nowrap"
                              >
                                <span className="hidden sm:inline">Successivo</span>
                                <span className="sm:hidden">›</span>
                              </Link>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <h2 className="text-2xl font-semibold mb-4">Nessun prodotto trovato</h2>
                    <p className="text-gray-600 mb-6">
                      Non abbiamo trovato prodotti corrispondenti alla tua ricerca &quot;{searchQuery}&quot;.
                    </p>
                    <Link
                      href="/"
                      className="bg-bred-500 text-white px-6 py-3 rounded-md font-medium hover:bg-bred-600 transition-colors inline-block"
                    >
                      Torna allo shop
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Caricamento...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
