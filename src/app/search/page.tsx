import { searchProducts, Product } from '../../lib/api';
import ProductCard from '../../components/ProductCard';
import { Metadata } from 'next';
import Link from 'next/link';

// Next.js 15 has a known issue with TypeScript definitions for page components
// where the params type doesn't satisfy the PageProps constraint

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateMetadata({ searchParams }: any): Metadata {
  const searchQuery = searchParams.q || '';
  
  return {
    title: `Search results for "${searchQuery}" - WooStore`,
    description: `Browse products matching your search for "${searchQuery}"`,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function SearchPage({ searchParams }: any) {
  const searchQuery = searchParams.q || '';
  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const perPage = 12;
  
  // If no search query is provided, we'll show an empty state
  const products: Product[] = searchQuery 
    ? await searchProducts(searchQuery, page, perPage)
    : [];
  
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
                    Continue Shopping
                  </Link>
                </div>
              )}
              
              {/* Pagination */}
              {products.length === perPage && (
                <div className="mt-12 flex justify-center">
                  <div className="flex space-x-2">
                    {page > 1 && (
                      <Link 
                        href={`/search?q=${encodeURIComponent(searchQuery)}&page=${page - 1}`}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                      >
                        Previous
                      </Link>
                    )}
                    
                    <Link 
                      href={`/search?q=${encodeURIComponent(searchQuery)}&page=${page + 1}`}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                    >
                      Next
                    </Link>
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
