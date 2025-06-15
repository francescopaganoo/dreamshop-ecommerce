import { getProductsByCategory, getCategories, Product, Category } from '../../../lib/api';
import ProductCard from '../../../components/ProductCard';
import { notFound } from 'next/navigation';
import Link from 'next/link';

// Next.js 15 has a known issue with TypeScript definitions for page components
// where the params type doesn't satisfy the PageProps constraint

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateMetadata({ params }: any) {
  // Attendi i params prima di utilizzarli
  const resolvedParams = await Promise.resolve(params);
  const categoryId = parseInt(resolvedParams.id, 10);
  const categories = await getCategories();
  const category = categories.find((cat: Category) => cat.id === categoryId);
  
  if (!category) {
    return {
      title: 'Category Not Found',
    };
  }
  
  return {
    title: `${category.name} - WooStore`,
    description: `Browse our collection of ${category.name} products.`,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function CategoryPage({ params, searchParams }: any) {
  // Attendi i params e searchParams prima di utilizzarli
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  
  const categoryId = parseInt(resolvedParams.id, 10);
  const page = typeof resolvedSearchParams?.page === 'string' ? parseInt(resolvedSearchParams.page, 10) : 1;
  const perPage = 12;
  
  // Fetch products for this category
  const products = await getProductsByCategory(categoryId, page, perPage);
  
  // Fetch all categories to get the current category name
  const categories = await getCategories();
  const category = categories.find((cat: Category) => cat.id === categoryId);
  
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
                <Link href="/" className="text-blue-600 hover:underline">Home</Link>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-gray-500">/</span>
                <Link href="/categories" className="text-blue-600 hover:underline">Categories</Link>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-gray-500">/</span>
                <span className="text-gray-700">{category.name}</span>
              </li>
            </ol>
          </nav>
          
          {/* Category Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">{category.name}</h1>
            <p className="text-gray-600">
              {category.count} {category.count === 1 ? 'product' : 'products'} available
            </p>
          </div>
          
          {/* Products Grid */}
          {products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product: Product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No products found in this category.</p>
            </div>
          )}
          
          {/* Pagination */}
          <div className="mt-12 flex justify-center">
            <div className="flex space-x-2">
              {page > 1 && (
                <Link 
                  href={`/category/${categoryId}?page=${page - 1}`}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                >
                  Previous
                </Link>
              )}
              
              {products.length === perPage && (
                <Link 
                  href={`/category/${categoryId}?page=${page + 1}`}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
      
    </div>
  );
}