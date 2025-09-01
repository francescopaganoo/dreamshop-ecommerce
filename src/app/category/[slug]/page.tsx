'use client';

import { getProductsByCategorySlug, getCategoryBySlug, getMegaMenuCategories, getAvailabilityOptions, getShippingTimeOptions, Product } from '../../../lib/api';
import ProductCard from '../../../components/ProductCard';
import CategorySidebar from '../../../components/CategorySidebar';
import MobileFilterButton from '../../../components/MobileFilterButton';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, use } from 'react';

// Next.js 15 has a known issue with TypeScript definitions for page components
// where the params type doesn't satisfy the PageProps constraint

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function CategoryPage({ params, searchParams }: any) {
  const [category, setCategory] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [availabilityOptions, setAvailabilityOptions] = useState<any[]>([]);
  const [shippingTimeOptions, setShippingTimeOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const resolvedParams = use(params) as { slug: string };
  const resolvedSearchParams = use(searchParams) as { page?: string };
  
  const categorySlug = resolvedParams.slug;
  const page = typeof resolvedSearchParams?.page === 'string' ? parseInt(resolvedSearchParams.page, 10) : 1;
  const perPage = 12;
  
  useEffect(() => {
    async function fetchData() {
      try {
        const [categoryData, productsData, categoriesData, availabilityData, shippingData] = await Promise.all([
          getCategoryBySlug(categorySlug),
          getProductsByCategorySlug(categorySlug, page, perPage),
          getMegaMenuCategories(),
          getAvailabilityOptions(),
          getShippingTimeOptions()
        ]);
        
        setCategory(categoryData);
        setProducts(productsData);
        setCategories(categoriesData);
        setAvailabilityOptions(availabilityData);
        setShippingTimeOptions(shippingData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [categorySlug, page, perPage]);
  
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
                currentCategorySlug={categorySlug}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
              />
            </div>
            
            {/* Products Section */}
            <div className="flex-1">
              {/* Products Grid */}
              {products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {products.map((product: Product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">Nessun prodotto trovato in questa categoria.</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Pagination */}
          <div className="mt-12 flex justify-center">
            <div className="flex items-center space-x-2">
              {page > 1 && (
                <Link 
                  href={`/category/${categorySlug}?page=${page - 1}`}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                >
                  Precedente
                </Link>
              )}
              
              <span className="px-4 py-2 text-gray-700 font-medium">
                Pagina {page}
              </span>
              
              {products.length === perPage && (
                <Link 
                  href={`/category/${categorySlug}?page=${page + 1}`}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                >
                  Successivo
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
      
    </div>
  );
}