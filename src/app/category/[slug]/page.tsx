'use client';

import { getProductsByCategorySlug, getCategoryBySlug, getMegaMenuCategories, getBrandsByCategorySlug, Product, Category, ExtendedCategory, Brand } from '../../../lib/api';
import ProductCard from '../../../components/ProductCard';
import CategorySidebar from '../../../components/CategorySidebar';
import MobileFilterButton from '../../../components/MobileFilterButton';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, use } from 'react';

// Next.js 15 has a known issue with TypeScript definitions for page components
// where the params type doesn't satisfy the PageProps constraint

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const resolvedParams = use(params) as { slug: string };
  const resolvedSearchParams = use(searchParams) as { page?: string };
  
  const categorySlug = resolvedParams.slug;
  const page = typeof resolvedSearchParams?.page === 'string' ? parseInt(resolvedSearchParams.page, 10) : 1;
  const perPage = 12;

  // Handle brand selection change - redirect to products page with filters
  const handleBrandSelectionChange = (selectedBrands: string[]) => {
    if (selectedBrands.length > 0) {
      const brandsParam = selectedBrands.join(',');
      const url = `/products?category=${encodeURIComponent(categorySlug)}&brands=${encodeURIComponent(brandsParam)}`;
      window.location.href = url;
    }
  };
  
  useEffect(() => {
    async function fetchData() {
      try {
        const [categoryData, productsData, categoriesData, brandsData] = await Promise.all([
          getCategoryBySlug(categorySlug),
          getProductsByCategorySlug(categorySlug, page, perPage),
          getMegaMenuCategories(),
          getBrandsByCategorySlug(categorySlug)
        ]);

        setCategory(categoryData);
        setProducts(productsData);
        setCategories(categoriesData);
        setBrands(brandsData);
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
                availabilityOptions={[]}
                shippingTimeOptions={[]}
                brands={brands}
                currentCategorySlug={categorySlug}
                selectedBrandSlugs={[]}
                onBrandSelectionChange={handleBrandSelectionChange}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
              />
            </div>
            
            {/* Products Section */}
            <div className="flex-1">
              {/* Products Grid */}
              {products.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {products.map((product: Product, index: number) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      priority={index < 6} // Priorità per i primi 6 prodotti (above the fold)
                    />
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
            <div className="flex items-center space-x-1">
              {/* Precedente */}
              {page > 1 && (
                <Link 
                  href={`/category/${categorySlug}?page=${page - 1}`}
                  className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 mr-2"
                >
                  Precedente
                </Link>
              )}
              
              {/* Numeri pagina */}
              {(() => {
                const pageNumbers = [];
                const maxVisible = 7; // Numero massimo di pagine da mostrare
                const hasNextPage = products.length === perPage;
                
                // Se non sappiamo quante pagine ci sono, mostriamo un range intorno alla pagina corrente
                const start = Math.max(1, page - Math.floor(maxVisible / 2));
                const end = start + maxVisible - 1;
                
                // Aggiungi prima pagina se non è visibile
                if (start > 1) {
                  pageNumbers.push(
                    <Link 
                      key={1}
                      href={`/category/${categorySlug}?page=1`}
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
                  } else if (i < page || (i > page && i <= page + 2 && hasNextPage)) {
                    pageNumbers.push(
                      <Link 
                        key={i}
                        href={`/category/${categorySlug}?page=${i}`}
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
              {products.length === perPage && (
                <Link 
                  href={`/category/${categorySlug}?page=${page + 1}`}
                  className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 ml-2"
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