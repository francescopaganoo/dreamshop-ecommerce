import { searchProducts, Product } from '../../lib/api';
import ProductCard from '../../components/ProductCard';
import { Metadata } from 'next';
import Link from 'next/link';

// Next.js 15 has a known issue with TypeScript definitions for page components
// where the params type doesn't satisfy the PageProps constraint

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateMetadata({ searchParams }: any): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams.q || '';
  
  return {
    title: `Search results for "${searchQuery}" - WooStore`,
    description: `Browse products matching your search for "${searchQuery}"`,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function SearchPage({ searchParams }: any) {
  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams.q || '';
  const page = resolvedSearchParams.page ? parseInt(resolvedSearchParams.page, 10) : 1;
  const perPage = 12;
  
  // If no search query is provided, we'll show an empty state
  const searchResult = searchQuery
    ? await searchProducts(searchQuery, page, perPage)
    : { products: [], total: 0 };

  const products = searchResult.products;
  const totalProducts = searchResult.total;
  
  return (
    <div className="min-h-screen flex flex-col">
      
      <main className="flex-grow py-8">
        <div className="container mx-auto px-4">
          {/* Search Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 text-gray-600">
              {searchQuery 
                ? `Risultati di ricerca per "${searchQuery}"`
                : 'Search Products'
              }
            </h1>
            {searchQuery && (
              <p className="text-gray-600">
                {products.length} {products.length === 1 ? 'prodotto' : 'prodotti'}
              </p>
            )}
          </div>
          
          {/* Search Form */}
          {!searchQuery && (
            <div className="mb-12 max-w-2xl mx-auto">
              <form action="/search" method="get" className="flex">
                <input
                  type="text"
                  name="q"
                  placeholder="What are you looking for?"
                  className="flex-grow px-4 py-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-3 rounded-r-md font-medium hover:bg-blue-700 transition-colors"
                >
                  Search
                </button>
              </form>
            </div>
          )}
          
          {/* Search Results */}
          {searchQuery && (
            <>
              {products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {products.map((product: Product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <h2 className="text-2xl font-semibold mb-4">No products found</h2>
                  <p className="text-gray-600 mb-6">
                    We couldn&apos;t find any products matching your search for &quot;{searchQuery}&quot;.
                  </p>
                  <Link
                    href="/"
                    className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                  >
                    Torna allo shop
                  </Link>
                </div>
              )}
              
              {/* Pagination */}
              {totalProducts > perPage && (
                <div className="mt-12 flex justify-center">
                  <div className="flex items-center space-x-1">
                    {/* Precedente */}
                    {page > 1 && (
                      <Link
                        href={`/search?q=${encodeURIComponent(searchQuery)}&page=${page - 1}`}
                        className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 mr-2"
                      >
                        Precedente
                      </Link>
                    )}

                    {/* Numeri pagina */}
                    {(() => {
                      const pageNumbers = [];
                      const maxVisible = 7;
                      const maxPage = Math.ceil(totalProducts / perPage);

                      const start = Math.max(1, page - Math.floor(maxVisible / 2));
                      const end = Math.min(maxPage, start + maxVisible - 1);

                      // Aggiungi prima pagina se non è visibile
                      if (start > 1) {
                        pageNumbers.push(
                          <Link
                            key={1}
                            href={`/search?q=${encodeURIComponent(searchQuery)}&page=1`}
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
                          pageNumbers.push(
                            <Link
                              key={i}
                              href={`/search?q=${encodeURIComponent(searchQuery)}&page=${i}`}
                              className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                            >
                              {i}
                            </Link>
                          );
                        }
                      }

                      // Aggiungi ultima pagina se non è visibile
                      if (end < maxPage) {
                        if (end < maxPage - 1) {
                          pageNumbers.push(
                            <span key="dots2" className="px-2 py-2 text-gray-500">...</span>
                          );
                        }

                        pageNumbers.push(
                          <Link
                            key={maxPage}
                            href={`/search?q=${encodeURIComponent(searchQuery)}&page=${maxPage}`}
                            className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                          >
                            {maxPage}
                          </Link>
                        );
                      }

                      return pageNumbers;
                    })()}

                    {/* Successivo */}
                    {page < Math.ceil(totalProducts / perPage) && (
                      <Link
                        href={`/search?q=${encodeURIComponent(searchQuery)}&page=${page + 1}`}
                        className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 ml-2"
                      >
                        Successivo
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

    </div>
  );
}
