'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Product, getFilteredProductsPlugin, ExtendedCategory, Brand, AttributeValue } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import CategorySidebar from '@/components/CategorySidebar';
import MobileFilterButton from '@/components/MobileFilterButton';
import { FaFire } from 'react-icons/fa';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface OfferteClientProps {
  initialProducts: Product[];
  initialTotal: number;
  initialSearchString: string;
  productsPerPage: number;
  categories: ExtendedCategory[];
  brands: Brand[];
  availabilityOptions: AttributeValue[];
  shippingTimeOptions: AttributeValue[];
  priceRange: { min: number; max: number };
}

export default function OfferteClient({
  initialProducts,
  initialTotal,
  initialSearchString,
  productsPerPage,
  categories,
  brands,
  availabilityOptions,
  shippingTimeOptions,
  priceRange,
}: OfferteClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [totalProducts, setTotalProducts] = useState(initialTotal);
  const [filterLoading, setFilterLoading] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const brandsParam = searchParams.get('brands') || '';
  const availabilityParam = searchParams.get('availability') || '';
  const shippingParam = searchParams.get('shipping') || '';
  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');
  const excludeSoldOutParam = searchParams.get('excludeSoldOut') === 'true';

  const brandSlugsFromUrl = useMemo(() => (brandsParam ? brandsParam.split(',') : []), [brandsParam]);
  const availabilitySlugsFromUrl = useMemo(() => (availabilityParam ? availabilityParam.split(',') : []), [availabilityParam]);
  const shippingSlugsFromUrl = useMemo(() => (shippingParam ? shippingParam.split(',') : []), [shippingParam]);
  const priceRangeFromUrl = useMemo(() => {
    if (minPriceParam && maxPriceParam) {
      return { min: parseInt(minPriceParam, 10), max: parseInt(maxPriceParam, 10) };
    }
    return undefined;
  }, [minPriceParam, maxPriceParam]);

  const [selectedBrandSlugs, setSelectedBrandSlugs] = useState<string[]>(brandSlugsFromUrl);
  const [selectedAvailabilitySlugs, setSelectedAvailabilitySlugs] = useState<string[]>(availabilitySlugsFromUrl);
  const [selectedShippingTimeSlugs, setSelectedShippingTimeSlugs] = useState<string[]>(shippingSlugsFromUrl);
  const [selectedPriceRange, setSelectedPriceRange] = useState<{ min: number; max: number } | undefined>(priceRangeFromUrl);
  const [excludeSoldOut, setExcludeSoldOut] = useState(excludeSoldOutParam);

  useEffect(() => {
    setSelectedBrandSlugs(brandSlugsFromUrl);
    setSelectedAvailabilitySlugs(availabilitySlugsFromUrl);
    setSelectedShippingTimeSlugs(shippingSlugsFromUrl);
    setSelectedPriceRange(priceRangeFromUrl);
    setExcludeSoldOut(excludeSoldOutParam);
  }, [brandSlugsFromUrl, availabilitySlugsFromUrl, shippingSlugsFromUrl, priceRangeFromUrl, excludeSoldOutParam]);

  const currentSearchString = searchParams.toString();
  const [loadedSearchString, setLoadedSearchString] = useState(initialSearchString);

  useEffect(() => {
    if (currentSearchString === loadedSearchString) return;

    const abortController = new AbortController();

    async function fetchProducts() {
      setFilterLoading(true);
      try {
        const minPrice = minPriceParam ? parseInt(minPriceParam, 10) : undefined;
        const maxPrice = maxPriceParam ? parseInt(maxPriceParam, 10) : undefined;

        const response = await getFilteredProductsPlugin({
          on_sale: true,
          brands: brandSlugsFromUrl.length > 0 ? brandSlugsFromUrl : undefined,
          availability: availabilitySlugsFromUrl.length > 0 ? availabilitySlugsFromUrl : undefined,
          shipping: shippingSlugsFromUrl.length > 0 ? shippingSlugsFromUrl : undefined,
          min_price: minPrice,
          max_price: maxPrice,
          exclude_sold_out: excludeSoldOutParam,
          page,
          per_page: productsPerPage,
          orderby: 'date',
          order: 'desc'
        }, abortController.signal);

        if (!abortController.signal.aborted) {
          setProducts(response.products);
          setTotalProducts(response.total);
          setLoadedSearchString(currentSearchString);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Errore nel caricamento dei prodotti in offerta:', error);
      } finally {
        if (!abortController.signal.aborted) {
          setFilterLoading(false);
        }
      }
    }

    fetchProducts();
    return () => abortController.abort();
  }, [currentSearchString, loadedSearchString, brandSlugsFromUrl, availabilitySlugsFromUrl, shippingSlugsFromUrl, minPriceParam, maxPriceParam, excludeSoldOutParam, page, productsPerPage]);

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
      const query = newSearchParams.toString();
      router.push(`/offerte${query ? `?${query}` : ''}`);
    } finally {
      setTimeout(() => {
        setIsApplyingFilters(false);
      }, 500);
    }
  };

  const totalPages = Math.ceil(totalProducts / productsPerPage);

  return (
    <>
      <MobileFilterButton onClick={() => setIsSidebarOpen(true)} />

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:order-first">
          <CategorySidebar
            categories={categories}
            availabilityOptions={availabilityOptions}
            shippingTimeOptions={shippingTimeOptions}
            brands={brands}
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

        {/* Products */}
        <div className="flex-1">
          {filterLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(productsPerPage)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-lg mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16">
              <FaFire className="mx-auto text-6xl text-gray-300 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Nessuna offerta trovata</h2>
              <p className="text-gray-600">
                Prova a modificare i filtri o torna presto per scoprire nuove promozioni!
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-gray-600">
                  Pagina {page} - {products.length} di {totalProducts} prodotti in offerta
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {products
                  .filter((product, index, self) => index === self.findIndex(p => p.id === product.id))
                  .map((product: Product, index: number) => (
                    <ProductCard
                      key={`${product.id}-${index}`}
                      product={product}
                      priority={index < 6}
                    />
                  ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-12 flex justify-center">
                  <div className="flex items-center space-x-1 overflow-x-auto">
                    {page > 1 && (() => {
                      const prevParams = new URLSearchParams(searchParams.toString());
                      prevParams.set('page', (page - 1).toString());
                      return (
                        <Link
                          href={`/offerte?${prevParams.toString()}`}
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
                      const end = Math.min(totalPages, start + maxVisible - 1);

                      if (start > 1) {
                        const firstParams = new URLSearchParams(searchParams.toString());
                        firstParams.set('page', '1');
                        pageNumbers.push(
                          <Link key={1} href={`/offerte?${firstParams.toString()}`}
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
                            <Link key={i} href={`/offerte?${pageParams.toString()}`}
                              className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 text-sm sm:text-base">
                              {i}
                            </Link>
                          );
                        }
                      }

                      if (end < totalPages) {
                        if (end < totalPages - 1) {
                          pageNumbers.push(
                            <span key="dots2" className="px-1 sm:px-2 py-2 text-gray-500 text-sm sm:text-base">...</span>
                          );
                        }
                        const lastParams = new URLSearchParams(searchParams.toString());
                        lastParams.set('page', totalPages.toString());
                        pageNumbers.push(
                          <Link key={totalPages} href={`/offerte?${lastParams.toString()}`}
                            className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 text-sm sm:text-base">
                            {totalPages}
                          </Link>
                        );
                      }

                      return pageNumbers;
                    })()}

                    {page < totalPages && (() => {
                      const nextParams = new URLSearchParams(searchParams.toString());
                      nextParams.set('page', (page + 1).toString());
                      return (
                        <Link
                          href={`/offerte?${nextParams.toString()}`}
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
          )}
        </div>
      </div>
    </>
  );
}
