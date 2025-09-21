'use client';

import { getMegaMenuCategories, getFilteredProductsPlugin, getFilterOptionsPlugin, Product, ExtendedCategory, AttributeValue, Brand } from '../../lib/api';
import ProductCard from '../../components/ProductCard';
import CategorySidebar from '../../components/CategorySidebar';
import MobileFilterButton from '../../components/MobileFilterButton';
import Link from 'next/link';
import { FaArrowRight, FaBox, FaEye, FaStar } from 'react-icons/fa';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function ProductsPageContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const [availabilityOptions, setAvailabilityOptions] = useState<AttributeValue[]>([]);
  const [shippingTimeOptions, setShippingTimeOptions] = useState<AttributeValue[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandSlugs, setSelectedBrandSlugs] = useState<string[]>([]);
  const [selectedAvailabilitySlugs, setSelectedAvailabilitySlugs] = useState<string[]>([]);
  const [selectedShippingTimeSlugs, setSelectedShippingTimeSlugs] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 100 });
  const [selectedPriceRange, setSelectedPriceRange] = useState<{ min: number; max: number } | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const brandSlug = searchParams.get('brand') || '';
  const brandsParam = searchParams.get('brands') || '';
  const categorySlug = searchParams.get('category') || '';
  const availabilityParam = searchParams.get('availability') || '';
  const shippingParam = searchParams.get('shipping') || '';
  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');
  const perPage = 12;

  // Parse multiple brands from URL
  const brandSlugsFromUrl = useMemo(() => {
    return brandsParam ? brandsParam.split(',') : (brandSlug ? [brandSlug] : []);
  }, [brandsParam, brandSlug]);

  // Parse availability from URL
  const availabilitySlugsFromUrl = useMemo(() => {
    return availabilityParam ? availabilityParam.split(',') : [];
  }, [availabilityParam]);

  // Parse shipping from URL
  const shippingSlugsFromUrl = useMemo(() => {
    return shippingParam ? shippingParam.split(',') : [];
  }, [shippingParam]);

  // Parse price range from URL
  const priceRangeFromUrl = useMemo(() => {
    if (minPriceParam && maxPriceParam) {
      return {
        min: parseInt(minPriceParam, 10),
        max: parseInt(maxPriceParam, 10)
      };
    }
    return undefined;
  }, [minPriceParam, maxPriceParam]);

  // Update selected filters when URL changes
  useEffect(() => {
    setSelectedBrandSlugs(brandSlugsFromUrl);
    setSelectedAvailabilitySlugs(availabilitySlugsFromUrl);
    setSelectedShippingTimeSlugs(shippingSlugsFromUrl);
    setSelectedPriceRange(priceRangeFromUrl);
  }, [brandSlugsFromUrl, availabilitySlugsFromUrl, shippingSlugsFromUrl, priceRangeFromUrl]);




  // Handle apply filters (new plugin approach)
  const handleApplyFilters = async (filters: {
    brandSlugs: string[];
    availabilitySlugs: string[];
    shippingTimeSlugs: string[];
    priceRange: { min: number; max: number };
  }) => {
    console.log('🎯 Applying filters with plugin:', filters);

    // Start loading state
    setIsApplyingFilters(true);

    try {
      // Update states
      setSelectedBrandSlugs(filters.brandSlugs);
      setSelectedAvailabilitySlugs(filters.availabilitySlugs);
      setSelectedShippingTimeSlugs(filters.shippingTimeSlugs);
      setSelectedPriceRange(filters.priceRange);

      // Build new URL with all filters
      const newSearchParams = new URLSearchParams();

      if (categorySlug) {
        newSearchParams.set('category', categorySlug);
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

      // Reset to first page
      newSearchParams.delete('page');

      const newUrl = `/products?${newSearchParams.toString()}`;
      console.log('🚀 Applying filters, navigating to:', newUrl);
      router.push(newUrl);
    } finally {
      // Stop loading states after a short delay to prevent flashing
      setTimeout(() => {
        setIsApplyingFilters(false);
        setFilterLoading(false);
      }, 500);
    }
  };


  useEffect(() => {
    async function fetchData() {
      try {
        console.log('useEffect fetchData triggered with plugin approach:', {
          page,
          categorySlug,
          brandSlugsFromUrl,
          availabilitySlugsFromUrl,
          shippingSlugsFromUrl,
          minPriceParam,
          maxPriceParam
        });

        // Get filter options and categories using plugin
        const [filterOptions, categoriesData] = await Promise.all([
          getFilterOptionsPlugin(),
          getMegaMenuCategories()
        ]);

        // Set filter options from plugin
        setAvailabilityOptions(filterOptions.availability);
        setShippingTimeOptions(filterOptions.shipping_times);
        setBrands(filterOptions.brands);
        setPriceRange(filterOptions.price_range);

        // Parse price filters from URL
        const minPrice = minPriceParam ? parseInt(minPriceParam, 10) : undefined;
        const maxPrice = maxPriceParam ? parseInt(maxPriceParam, 10) : undefined;

        // Get current filter values
        const currentBrandSlugs = selectedBrandSlugs.length > 0 ? selectedBrandSlugs : brandSlugsFromUrl;
        const currentAvailabilitySlugs = selectedAvailabilitySlugs.length > 0 ? selectedAvailabilitySlugs : availabilitySlugsFromUrl;
        const currentShippingSlugs = selectedShippingTimeSlugs.length > 0 ? selectedShippingTimeSlugs : shippingSlugsFromUrl;

        // Build filters object for plugin
        const filters = {
          category: categorySlug || undefined,
          brands: currentBrandSlugs.length > 0 ? currentBrandSlugs : undefined,
          availability: currentAvailabilitySlugs.length > 0 ? currentAvailabilitySlugs : undefined,
          shipping: currentShippingSlugs.length > 0 ? currentShippingSlugs : undefined,
          min_price: minPrice,
          max_price: maxPrice,
          page,
          per_page: perPage,
          orderby: 'date',
          order: 'desc'
        };

        console.log('Fetching products with plugin filters:', filters);

        // Get products using plugin
        const productsResponse = await getFilteredProductsPlugin(filters);

        console.log('Plugin API response:', {
          productsCount: productsResponse.products.length,
          total: productsResponse.total,
          total_pages: productsResponse.total_pages
        });

        setCategories(categoriesData);
        setProducts(productsResponse.products);
        setTotalProducts(productsResponse.total);
      } catch (error) {
        console.error('Error fetching data with plugin:', error);
      } finally {
        setLoading(false);
        setFilterLoading(false);
      }
    }

    fetchData();
  }, [page, perPage, selectedBrandSlugs, selectedAvailabilitySlugs, selectedShippingTimeSlugs, categorySlug, brandSlugsFromUrl, availabilitySlugsFromUrl, shippingSlugsFromUrl, minPriceParam, maxPriceParam]);
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Caricamento...</div>;
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
            {/* Background decorative elements */}
            <div className="absolute -top-8 -left-8 w-16 h-16 bg-bred-500/10 rounded-full hidden lg:block animate-pulse"></div>
            <div className="absolute -top-4 -right-12 w-24 h-24 bg-orange-500/10 rounded-full hidden lg:block animate-pulse delay-300"></div>
            
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 bg-bred-500/10 text-bred-600 px-4 py-2 rounded-full text-sm font-medium mb-4">
                <FaBox className="animate-bounce" /> CATALOGO
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bangers text-gray-900 mb-6 leading-tight">
                Tutti i <span className="text-bred-500">Prodotti</span>
              </h1>
              <p className="text-gray-600 text-lg max-w-3xl mx-auto mb-8 leading-relaxed">
                Esplora l&apos;intero catalogo dei nostri prodotti. Figure, statue, carte collezionabili e molto altro.
              </p>
              
            </div>
          </div>

          {/* Mobile Filter Button */}
          <MobileFilterButton onClick={() => setIsSidebarOpen(true)} />
          
          {/* Main content with sidebar */}
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar */}
            <div className="lg:order-first">
              <CategorySidebar
                categories={categories}
                availabilityOptions={availabilityOptions}
                shippingTimeOptions={shippingTimeOptions}
                brands={brands}
                currentCategorySlug={categorySlug || undefined}
                currentBrandSlug={brandSlug || undefined}
                selectedBrandSlugs={selectedBrandSlugs}
                selectedAvailabilitySlugs={selectedAvailabilitySlugs}
                selectedShippingTimeSlugs={selectedShippingTimeSlugs}
                priceRange={priceRange}
                selectedPriceRange={selectedPriceRange}
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
                    <p className="text-gray-600">Applicazione filtro prezzo...</p>
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
                          priority={index < 6} // Priorità per i primi 6 prodotti (above the fold)
                        />
                      ))}
                  </div>
                  
                  {/* Pagination */}
                  <div className="mt-12 flex justify-center">
                    <div className="flex items-center space-x-1">
                      {/* Precedente */}
                      {page > 1 && (() => {
                        const prevSearchParams = new URLSearchParams(searchParams.toString());
                        prevSearchParams.set('page', (page - 1).toString());
                        return (
                          <Link
                            href={`/products?${prevSearchParams.toString()}`}
                            className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 mr-2"
                          >
                            Precedente
                          </Link>
                        );
                      })()}
                      
                      {/* Numeri pagina */}
                      {(() => {
                        const pageNumbers = [];
                        const maxVisible = 7;
                        const maxPage = Math.ceil(totalProducts / perPage);
                        
                        const start = Math.max(1, page - Math.floor(maxVisible / 2));
                        const end = Math.min(maxPage, start + maxVisible - 1);
                        
                        // Aggiungi prima pagina se non è visibile
                        if (start > 1) {
                          const firstPageParams = new URLSearchParams(searchParams.toString());
                          firstPageParams.set('page', '1');
                          pageNumbers.push(
                            <Link
                              key={1}
                              href={`/products?${firstPageParams.toString()}`}
                              className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                            >
                              1
                            </Link>
                          );
                          
                          if (start > 2) {
                            pageNumbers.push(
                              <span key="dots1" className="px-2 py-2 text-gray-500">...</span>
                            );
                          }
                        }
                        
                        // Pagine centrali
                        for (let i = start; i <= end; i++) {
                          if (i === page) {
                            pageNumbers.push(
                              <span 
                                key={i}
                                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md font-medium cursor-not-allowed"
                              >
                                {i}
                              </span>
                            );
                          } else if (i <= maxPage) {
                            const pageParams = new URLSearchParams(searchParams.toString());
                            pageParams.set('page', i.toString());
                            pageNumbers.push(
                              <Link
                                key={i}
                                href={`/products?${pageParams.toString()}`}
                                className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                              >
                                {i}
                              </Link>
                            );
                          }
                        }
                        
                        return pageNumbers;
                      })()}
                      
                      {/* Successivo */}
                      {page < Math.ceil(totalProducts / perPage) && (() => {
                        const nextSearchParams = new URLSearchParams(searchParams.toString());
                        nextSearchParams.set('page', (page + 1).toString());
                        return (
                          <Link
                            href={`/products?${nextSearchParams.toString()}`}
                            className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 ml-2"
                          >
                            Successivo
                          </Link>
                        );
                      })()}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <div className="max-w-md mx-auto">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <FaBox className="text-gray-400 text-3xl" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessun Prodotto Trovato</h3>
                    <p className="text-gray-500 mb-6">Al momento non ci sono prodotti disponibili.</p>
                    <Link 
                      href="/"
                      className="inline-flex items-center gap-2 bg-bred-500 text-white hover:bg-bred-600 px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      <FaArrowRight className="rotate-180" /> Torna alla Home
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Stats Section */}
          {products.length > 0 && (
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
          )}
        </div>
      </main>
      
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Caricamento...</div>}>
      <ProductsPageContent />
    </Suspense>
  );
}
