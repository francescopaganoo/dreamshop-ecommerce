'use client';

import React, { useState, useEffect } from 'react';
import { Product, getFilteredProductsPlugin } from '@/lib/api';
import ProductList from '@/components/ProductList';
import { FaFire } from 'react-icons/fa';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface OfferteClientProps {
  initialProducts: Product[];
  initialTotal: number;
  initialPage: number;
  productsPerPage: number;
}

export default function OfferteClient({ initialProducts, initialTotal, initialPage, productsPerPage }: OfferteClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPage = parseInt(searchParams?.get('page') || '1', 10);

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [totalProducts, setTotalProducts] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedPage, setLoadedPage] = useState(initialPage);

  const totalPages = Math.ceil(totalProducts / productsPerPage);

  // Re-fetch when URL page changes and differs from what we already have
  useEffect(() => {
    if (currentPage === loadedPage) return;

    const abortController = new AbortController();

    async function fetchProducts() {
      setIsLoading(true);
      try {
        const response = await getFilteredProductsPlugin({
          on_sale: true,
          page: currentPage,
          per_page: productsPerPage,
          orderby: 'date',
          order: 'desc'
        }, abortController.signal);
        if (!abortController.signal.aborted) {
          setProducts(response.products);
          setTotalProducts(response.total);
          setLoadedPage(currentPage);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Errore nel caricamento dei prodotti in offerta:', error);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    fetchProducts();
    return () => abortController.abort();
  }, [currentPage, loadedPage, productsPerPage]);

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (page === 1) {
      params.delete('page');
    } else {
      params.set('page', page.toString());
    }
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: true });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
            <div className="aspect-square bg-gray-200 rounded-lg mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <FaFire className="mx-auto text-6xl text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Nessuna offerta al momento</h2>
        <p className="text-gray-600">
          Al momento non ci sono prodotti in offerta. Torna presto per scoprire le nostre promozioni!
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Product Count */}
      <div className="mb-8">
        <p className="text-gray-600">
          Pagina {currentPage} - {products.length} di {totalProducts} prodotti in offerta
        </p>
      </div>

      {/* Products Grid */}
      <ProductList products={products} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-12 flex justify-center">
          <div className="flex items-center space-x-1 overflow-x-auto">
            {/* Precedente */}
            {currentPage > 1 && (
              <button
                onClick={() => goToPage(currentPage - 1)}
                className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 mr-1 sm:mr-2 text-sm sm:text-base whitespace-nowrap"
              >
                <span className="hidden sm:inline">Precedente</span>
                <span className="sm:hidden">&#8249;</span>
              </button>
            )}

            {/* Numeri pagina */}
            {(() => {
              const pageNumbers = [];
              const maxVisible = 7;
              const start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
              const end = Math.min(totalPages, start + maxVisible - 1);

              if (start > 1) {
                pageNumbers.push(
                  <button key={1} onClick={() => goToPage(1)}
                    className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 text-sm sm:text-base">
                    1
                  </button>
                );
                if (start > 2) {
                  pageNumbers.push(
                    <span key="dots1" className="px-1 sm:px-2 py-2 text-gray-500 text-sm sm:text-base">...</span>
                  );
                }
              }

              for (let i = start; i <= end; i++) {
                if (i === currentPage) {
                  pageNumbers.push(
                    <span key={i} className="px-2 sm:px-3 py-2 bg-bred-500 text-white rounded-md font-medium cursor-not-allowed text-sm sm:text-base">
                      {i}
                    </span>
                  );
                } else {
                  pageNumbers.push(
                    <button key={i} onClick={() => goToPage(i)}
                      className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 text-sm sm:text-base">
                      {i}
                    </button>
                  );
                }
              }

              if (end < totalPages) {
                if (end < totalPages - 1) {
                  pageNumbers.push(
                    <span key="dots2" className="px-1 sm:px-2 py-2 text-gray-500 text-sm sm:text-base">...</span>
                  );
                }
                pageNumbers.push(
                  <button key={totalPages} onClick={() => goToPage(totalPages)}
                    className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 text-sm sm:text-base">
                    {totalPages}
                  </button>
                );
              }

              return pageNumbers;
            })()}

            {/* Successivo */}
            {currentPage < totalPages && (
              <button
                onClick={() => goToPage(currentPage + 1)}
                className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 ml-1 sm:ml-2 text-sm sm:text-base whitespace-nowrap"
              >
                <span className="hidden sm:inline">Successivo</span>
                <span className="sm:hidden">&#8250;</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
