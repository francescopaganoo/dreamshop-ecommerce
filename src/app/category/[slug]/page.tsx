'use client';

import { getProductsByCategorySlugWithTotal, getCategoryBySlug, getMegaMenuCategories, getBrandsByCategorySlug, getPriceRange, Product, Category, ExtendedCategory, Brand } from '../../../lib/api';
import ProductCard from '../../../components/ProductCard';
import CategorySidebar from '../../../components/CategorySidebar';
import MobileFilterButton from '../../../components/MobileFilterButton';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// Next.js 15 has a known issue with TypeScript definitions for page components
// where the params type doesn't satisfy the PageProps constraint

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; minPrice?: string; maxPrice?: string }>;
}

export default function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 100 });
  const [selectedPriceRange, setSelectedPriceRange] = useState<{ min: number; max: number } | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const resolvedParams = use(params) as { slug: string };
  const resolvedSearchParams = use(searchParams) as { page?: string; minPrice?: string; maxPrice?: string };

  const categorySlug = resolvedParams.slug;
  const page = typeof resolvedSearchParams?.page === 'string' ? parseInt(resolvedSearchParams.page, 10) : 1;
  const perPage = 12;

  // URL search params for price filter
  const searchParamsFromHook = useSearchParams();
  const router = useRouter();
  const minPriceParam = searchParamsFromHook.get('minPrice');
  const maxPriceParam = searchParamsFromHook.get('maxPrice');

  // Create selected price range from URL params
  const getSelectedPriceRangeFromUrl = () => {
    if (minPriceParam && maxPriceParam) {
      return {
        min: parseInt(minPriceParam, 10),
        max: parseInt(maxPriceParam, 10)
      };
    }
    return undefined;
  };

  useEffect(() => {
    setSelectedPriceRange(getSelectedPriceRangeFromUrl());
  }, [minPriceParam, maxPriceParam]);

  // Handle brand selection change - redirect to products page with filters
  const handleBrandSelectionChange = (selectedBrands: string[]) => {
    if (selectedBrands.length > 0) {
      const brandsParam = selectedBrands.join(',');
      const url = `/products?category=${encodeURIComponent(categorySlug)}&brands=${encodeURIComponent(brandsParam)}`;
      window.location.href = url;
    }
  };

  // Handle price range change
  const handlePriceRangeChange = (range: { min: number; max: number }) => {
    console.log('handlePriceRangeChange called with:', range);
    setSelectedPriceRange(range);
    setFilterLoading(true); // Start filter loading
    setProducts([]); // Clear products immediately to avoid flash

    // Update URL using router.push for better reactivity
    const newSearchParams = new URLSearchParams(window.location.search);

    newSearchParams.set('minPrice', range.min.toString());
    newSearchParams.set('maxPrice', range.max.toString());
    newSearchParams.delete('page'); // Reset to first page when changing filters

    const newUrl = `/category/${categorySlug}?${newSearchParams.toString()}`;
    console.log('Category price filter navigating to:', newUrl);
    router.push(newUrl);
  };
  
  useEffect(() => {
    async function fetchData() {
      try {
        // Get category data, categories, brands, and price range
        const [categoryData, categoriesData, brandsData, globalPriceRange] = await Promise.all([
          getCategoryBySlug(categorySlug),
          getMegaMenuCategories(),
          getBrandsByCategorySlug(categorySlug),
          getPriceRange()
        ]);

        // Set price range from server
        setPriceRange(globalPriceRange);

        // Parse price filters from URL
        const minPrice = minPriceParam ? parseInt(minPriceParam, 10) : undefined;
        const maxPrice = maxPriceParam ? parseInt(maxPriceParam, 10) : undefined;

        // Get products for this category with server-side pagination and price filtering
        const productsResponse = await getProductsByCategorySlugWithTotal(
          categorySlug,
          page,
          perPage,
          'date',
          'desc',
          minPrice,
          maxPrice
        );

        setCategory(categoryData);
        setProducts(productsResponse.products);
        setCategories(categoriesData);
        setBrands(brandsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
        setFilterLoading(false); // End filter loading
      }
    }

    fetchData();
  }, [categorySlug, page, perPage, minPriceParam, maxPriceParam]);
  
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
                priceRange={priceRange}
                selectedPriceRange={selectedPriceRange}
                onPriceRangeChange={handlePriceRangeChange}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
              />
            </div>
            
            {/* Products Section */}
            <div className="flex-1">
              {/* Products Grid */}
              {filterLoading || (products.length === 0 && (minPriceParam || maxPriceParam)) ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-bred-600 mb-4"></div>
                    <p className="text-gray-600">Applicazione filtro prezzo...</p>
                  </div>
                </div>
              ) : products.length > 0 ? (
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
                const maxVisible = 7; // Numero massimo di pagine da mostrare
                const hasNextPage = products.length === perPage;
                
                // Se non sappiamo quante pagine ci sono, mostriamo un range intorno alla pagina corrente
                const start = Math.max(1, page - Math.floor(maxVisible / 2));
                const end = start + maxVisible - 1;
                
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
                  } else if (i < page || (i > page && i <= page + 2 && hasNextPage)) {
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
              {products.length === perPage && (() => {
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
        </div>
      </main>
      
    </div>
  );
}