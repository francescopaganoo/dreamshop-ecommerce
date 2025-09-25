'use client';

import { getCategoryBySlug, getMegaMenuCategories, getFilteredProductsPlugin, getCategoryFilterOptionsPlugin, Product, Category, ExtendedCategory, Brand, AttributeValue } from '../../../lib/api';
import ProductCard from '../../../components/ProductCard';
import CategorySidebar from '../../../components/CategorySidebar';
import MobileFilterButton from '../../../components/MobileFilterButton';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, use, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// Next.js 15 has a known issue with TypeScript definitions for page components
// where the params type doesn't satisfy the PageProps constraint

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; minPrice?: string; maxPrice?: string; brands?: string; availability?: string; shipping?: string }>;
}

export default function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
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
  
  const resolvedParams = use(params) as { slug: string };
  const resolvedSearchParams = use(searchParams) as { page?: string; minPrice?: string; maxPrice?: string; brands?: string; availability?: string; shipping?: string; excludeSoldOut?: string };

  const categorySlug = resolvedParams.slug;
  const page = typeof resolvedSearchParams?.page === 'string' ? parseInt(resolvedSearchParams.page, 10) : 1;
  const perPage = 12;

  // URL search params for price filter and brands
  const searchParamsFromHook = useSearchParams();
  const router = useRouter();
  const minPriceParam = searchParamsFromHook.get('minPrice');
  const maxPriceParam = searchParamsFromHook.get('maxPrice');
  const brandsParam = searchParamsFromHook.get('brands');
  const availabilityParam = searchParamsFromHook.get('availability');
  const shippingParam = searchParamsFromHook.get('shipping');
  const excludeSoldOutParam = searchParamsFromHook.get('excludeSoldOut') === 'true';

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


  // Apply all filters at once (plugin approach)
  const handleApplyFilters = async (filters: {
    brandSlugs: string[];
    availabilitySlugs: string[];
    shippingTimeSlugs: string[];
    priceRange: { min: number; max: number };
    excludeSoldOut: boolean;
  }) => {
    console.log('🎯 Category applying filters with plugin:', filters);

    // Start loading state
    setIsApplyingFilters(true);

    try {
      // Update states
      setSelectedBrandSlugs(filters.brandSlugs);
      setSelectedAvailabilitySlugs(filters.availabilitySlugs);
      setSelectedShippingTimeSlugs(filters.shippingTimeSlugs);
      setSelectedPriceRange(filters.priceRange);
      setExcludeSoldOut(filters.excludeSoldOut);

      // Build new URL with all filters
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

      // Reset to first page
      newSearchParams.delete('page');

      const newUrl = `/category/${categorySlug}?${newSearchParams.toString()}`;
      console.log('🚀 Category applying filters, navigating to:', newUrl);
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
        console.log('Category useEffect fetchData triggered with plugin approach:', {
          categorySlug,
          page,
          selectedBrandSlugs,
          selectedAvailabilitySlugs,
          selectedShippingTimeSlugs,
          minPriceParam,
          maxPriceParam
        });

        // Get category data, filter options, and categories
        const [categoryData, filterOptions, categoriesData] = await Promise.all([
          getCategoryBySlug(categorySlug),
          getCategoryFilterOptionsPlugin(categorySlug),
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

        // Build filters object for plugin
        const filters = {
          category: categorySlug,
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

        console.log('Fetching category products with plugin filters:', filters);
        console.log('🔍 DEBUG - excludeSoldOut state:', excludeSoldOut);
        console.log('🔍 DEBUG - excludeSoldOutParam from URL:', excludeSoldOutParam);
        console.log('🔍 DEBUG - filters.exclude_sold_out:', filters.exclude_sold_out);

        // Get products using plugin
        const productsResponse = await getFilteredProductsPlugin(filters);

        console.log('Category Plugin API response:', {
          productsCount: productsResponse.products.length,
          total: productsResponse.total,
          total_pages: productsResponse.total_pages
        });

        setCategory(categoryData);
        setProducts(productsResponse.products);
        setTotalProducts(productsResponse.total);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error fetching category data with plugin:', error);
      } finally {
        setLoading(false);
        setFilterLoading(false);
      }
    }

    fetchData();
  }, [categorySlug, page, perPage, selectedBrandSlugs, selectedAvailabilitySlugs, selectedShippingTimeSlugs, excludeSoldOut, minPriceParam, maxPriceParam, excludeSoldOutParam]);
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Caricamento...</div>;
  }
  
  if (!category) {
    notFound();
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
            
            {/* Products Section */}
            <div className="flex-1">
              {/* Products Grid */}
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
                  <div className="mt-8 flex justify-center">
                    <div className="flex items-center space-x-1">
                      {/* Precedente */}
                      {page > 1 && (() => {
                        const prevSearchParams = new URLSearchParams(window.location.search);
                        prevSearchParams.set('page', (page - 1).toString());
                        return (
                          <Link
                            href={`/category/${categorySlug}?${prevSearchParams.toString()}`}
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
                          const firstPageParams = new URLSearchParams(window.location.search);
                          firstPageParams.set('page', '1');
                          pageNumbers.push(
                            <Link
                              key={1}
                              href={`/category/${categorySlug}?${firstPageParams.toString()}`}
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
                            const pageParams = new URLSearchParams(window.location.search);
                            pageParams.set('page', i.toString());
                            pageNumbers.push(
                              <Link
                                key={i}
                                href={`/category/${categorySlug}?${pageParams.toString()}`}
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
                        const nextSearchParams = new URLSearchParams(window.location.search);
                        nextSearchParams.set('page', (page + 1).toString());
                        return (
                          <Link
                            href={`/category/${categorySlug}?${nextSearchParams.toString()}`}
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
                <div className="text-center py-12">
                  <p className="text-gray-500">Nessun prodotto trovato in questa categoria.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
    </div>
  );
}