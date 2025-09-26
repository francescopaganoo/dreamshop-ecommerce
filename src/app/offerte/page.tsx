'use client';

import React, { useState, useEffect } from 'react';
import { Product, getFilteredProductsPlugin } from '@/lib/api';
import ProductList from '@/components/ProductList';
import { FaFire } from 'react-icons/fa';
import { FaTags } from 'react-icons/fa';

export default function OffertePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const productsPerPage = 12; // Numero ottimale per distribuire meglio i prodotti

  const fetchProducts = async (page: number) => {
    setIsLoading(true);
    try {
      // Usa il plugin dreamshop-advanced-filters per ottenere solo prodotti in offerta
      const response = await getFilteredProductsPlugin({
        on_sale: true,
        page,
        per_page: productsPerPage,
        orderby: 'date',
        order: 'desc'
      });

      console.log('Offerte Plugin Response:', response);

      setProducts(response.products);
      setTotalProducts(response.total);

      // Calcola se ci sono più pagine
      const totalPages = Math.ceil(response.total / productsPerPage);
      setHasMorePages(page < totalPages);

    } catch (error) {
      console.error('Errore nel caricamento dei prodotti in offerta:', error);
      setProducts([]);
      setTotalProducts(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(currentPage);
  }, [currentPage]);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    // Scroll to top quando cambia pagina
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50">

          <div className="relative mb-16 pt-16 text-center">
            {/* Background decorative elements */}
            <div className="absolute -top-8 -left-8 w-16 h-16 bg-bred-500/10 rounded-full hidden lg:block animate-pulse"></div>
            <div className="absolute -top-4 -right-12 w-24 h-24 bg-orange-500/10 rounded-full hidden lg:block animate-pulse delay-300"></div>
            
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 bg-bred-500/10 text-bred-600 px-4 py-2 rounded-full text-sm font-medium mb-4">
                <FaTags className="animate-spin-slow" /> ESPLORA
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bangers text-gray-900 mb-6 leading-tight">
                Tutte le <span className="text-bred-500">Offerte</span>
              </h1>
              <p className="text-gray-600 text-lg max-w-3xl mx-auto mb-8 leading-relaxed">
                Approfitta delle nostre promozioni speciali e aggiungi pezzi unici alla tua collezione
              </p>
              
            </div>
          </div>

      {/* Products Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          
          {isLoading ? (
            // Skeleton loading
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
          ) : products.length > 0 ? (
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
              <div className="flex justify-center items-center space-x-4 mt-12">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-red-50 hover:text-red-600 border border-gray-300'
                  }`}
                >
                  Precedente
                </button>
                
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={!hasMorePages}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    !hasMorePages
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-red-50 hover:text-red-600 border border-gray-300'
                  }`}
                >
                  Successiva
                </button>
              </div>
            </>
          ) : (
            // Empty state
            <div className="text-center py-16">
              <FaFire className="mx-auto text-6xl text-gray-300 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Nessuna offerta al momento</h2>
              <p className="text-gray-600">
                Al momento non ci sono prodotti in offerta. Torna presto per scoprire le nostre promozioni!
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}