'use client';

import { getProducts, getMegaMenuCategories, getAvailabilityOptions, getShippingTimeOptions, getBrands, getProductsByBrandSlugs, getProductsByCategorySlugAndBrandSlugs, getProductsByCategorySlug, getBrandsByCategorySlug, calculatePriceRange, filterProductsByPrice, Product, ExtendedCategory, AttributeValue, Brand } from '../../lib/api';
import ProductCard from '../../components/ProductCard';
import CategorySidebar from '../../components/CategorySidebar';
import MobileFilterButton from '../../components/MobileFilterButton';
import Link from 'next/link';
import { FaArrowRight, FaBox, FaEye, FaStar } from 'react-icons/fa';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ProductsPageContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const [availabilityOptions, setAvailabilityOptions] = useState<AttributeValue[]>([]);
  const [shippingTimeOptions, setShippingTimeOptions] = useState<AttributeValue[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandSlugs, setSelectedBrandSlugs] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 100 });
  const [selectedPriceRange, setSelectedPriceRange] = useState<{ min: number; max: number } | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const brandSlug = searchParams.get('brand') || '';
  const brandsParam = searchParams.get('brands') || '';
  const categorySlug = searchParams.get('category') || '';
  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');
  const perPage = 12;

  // Parse multiple brands from URL
  const brandSlugsFromUrl = useMemo(() => {
    return brandsParam ? brandsParam.split(',') : (brandSlug ? [brandSlug] : []);
  }, [brandsParam, brandSlug]);

  // Parse price range from URL
  const priceRangeFromUrl = useMemo(() => {
    if (minPriceParam && maxPriceParam) {
      return {
        min: parseInt(minPriceParam, 10),
        max: parseInt(maxPriceParam, 10)
      };
    }
    return undefined;
  }, [minPriceParam, maxPriceParam]);

  // Update selected brands when URL changes
  useEffect(() => {
    setSelectedBrandSlugs(brandSlugsFromUrl);
  }, [brandSlugsFromUrl]);

  // Update selected price range when URL changes
  useEffect(() => {
    if (priceRangeFromUrl) {
      setSelectedPriceRange(priceRangeFromUrl);
    }
  }, [priceRangeFromUrl]);

  // Handle brand selection change
  const handleBrandSelectionChange = (selectedBrands: string[]) => {
    setSelectedBrandSlugs(selectedBrands);

    // Update URL
    const newSearchParams = new URLSearchParams(searchParams.toString());

    if (selectedBrands.length > 0) {
      newSearchParams.set('brands', selectedBrands.join(','));
      newSearchParams.delete('brand'); // Remove old single brand param
    } else {
      newSearchParams.delete('brands');
      newSearchParams.delete('brand');
    }

    newSearchParams.delete('page'); // Reset to first page when changing filters

    const newUrl = `/products?${newSearchParams.toString()}`;
    window.history.pushState({}, '', newUrl);
  };

  // Handle price range change
  const handlePriceRangeChange = (range: { min: number; max: number }) => {
    setSelectedPriceRange(range);

    // Update URL
    const newSearchParams = new URLSearchParams(searchParams.toString());

    newSearchParams.set('minPrice', range.min.toString());
    newSearchParams.set('maxPrice', range.max.toString());
    newSearchParams.delete('page'); // Reset to first page when changing filters

    const newUrl = `/products?${newSearchParams.toString()}`;
    window.history.pushState({}, '', newUrl);
  };

  useEffect(() => {
    async function fetchData() {
      try {
        // Get categories, availability and shipping data
        const [categoriesData, availabilityData, shippingData] = await Promise.all([
          getMegaMenuCategories(),
          getAvailabilityOptions(),
          getShippingTimeOptions()
        ]);

        // Get brands based on whether we have a category filter
        let brandsData: Brand[];
        if (categorySlug) {
          brandsData = await getBrandsByCategorySlug(categorySlug);
        } else {
          brandsData = await getBrands();
        }

        // Get products based on filters
        let productsResponse: { products: Product[], total: number };
        const currentBrandSlugs = selectedBrandSlugs.length > 0 ? selectedBrandSlugs : brandSlugsFromUrl;

        if (categorySlug && currentBrandSlugs.length > 0) {
          // Both category and brand filters
          productsResponse = await getProductsByCategorySlugAndBrandSlugs(categorySlug, currentBrandSlugs, page, perPage);
        } else if (categorySlug) {
          // Only category filter
          const products = await getProductsByCategorySlug(categorySlug, page, perPage);
          productsResponse = { products, total: products.length };
        } else if (currentBrandSlugs.length > 0) {
          // Only brand filters
          productsResponse = await getProductsByBrandSlugs(currentBrandSlugs, page, perPage);
        } else {
          // No filters
          productsResponse = await getProducts(page, perPage);
        }

        // Store all products for price calculation and filtering
        const allProductsForFiltering = productsResponse.products;

        // Calculate price range from all products
        const calculatedPriceRange = calculatePriceRange(allProductsForFiltering);
        setPriceRange(calculatedPriceRange);

        // Apply price filter if selected
        let finalProducts = allProductsForFiltering;
        if (selectedPriceRange) {
          finalProducts = filterProductsByPrice(allProductsForFiltering, selectedPriceRange);
        }

        setCategories(categoriesData);
        setAvailabilityOptions(availabilityData);
        setShippingTimeOptions(shippingData);
        setBrands(brandsData);
        setProducts(finalProducts);
        setTotalProducts(finalProducts.length);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [page, perPage, selectedBrandSlugs, categorySlug, brandSlugsFromUrl, selectedPriceRange]);
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Caricamento...</div>;
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
      
      <main className="flex-grow py-8 md:py-16">
        <div className="container mx-auto px-4 md:px-6">
          {/* Breadcrumb */}
          <nav className="mb-8 text-sm">
            <ol className="flex items-center space-x-2">
              <li>
                <Link href="/" className="text-bred-600 hover:underline">Home</Link>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-gray-500">/</span>
                <span className="text-gray-700">Tutti i Prodotti</span>
              </li>
            </ol>
          </nav>

          {/* Enhanced Page Header */}
          <div className="relative mb-16 text-center">
            {/* Background decorative elements */}
            <div className="absolute -top-8 -left-8 w-16 h-16 bg-bred-500/10 rounded-full hidden lg:block animate-pulse"></div>
            <div className="absolute -top-4 -right-12 w-24 h-24 bg-orange-500/10 rounded-full hidden lg:block animate-pulse delay-300"></div>
            
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 bg-bred-500/10 text-bred-600 px-4 py-2 rounded-full text-sm font-medium mb-4">
                <FaBox className="animate-bounce" /> CATALOGO
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bangers text-gray-900 mb-6 leading-tight">
                Tutti i <span className="text-bred-500">Prodotti</span>
              </h1>
              <p className="text-gray-600 text-lg max-w-3xl mx-auto mb-8 leading-relaxed">
                Esplora l&apos;intero catalogo dei nostri prodotti. Figure, statue, carte collezionabili e molto altro.
              </p>
              
            </div>
          </div>

          {/* Mobile Filter Button */}
          <MobileFilterButton onClick={() => setIsSidebarOpen(true)} />
          
          {/* Main content with sidebar */}
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar */}
            <div className="lg:order-first">
              <CategorySidebar
                categories={categories}
                availabilityOptions={availabilityOptions}
                shippingTimeOptions={shippingTimeOptions}
                brands={brands}
                currentCategorySlug={categorySlug || undefined}
                currentBrandSlug={brandSlug || undefined}
                selectedBrandSlugs={selectedBrandSlugs}
                onBrandSelectionChange={handleBrandSelectionChange}
                priceRange={priceRange}
                selectedPriceRange={selectedPriceRange}
                onPriceRangeChange={handlePriceRangeChange}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
              />
            </div>
            
            {/* Products Grid */}
            <div className="flex-1">
              {products.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {products.map((product: Product, index: number) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        priority={index < 6} // Priorità per i primi 6 prodotti (above the fold)
                      />
                    ))}
                  </div>
                  
                  {/* Pagination */}
                  <div className="mt-12 flex justify-center">
                    <div className="flex items-center space-x-1">
                      {/* Precedente */}
                      {page > 1 && (
                        <Link 
                          href={`/products?page=${page - 1}${brandSlug ? `&brand=${encodeURIComponent(brandSlug)}` : ''}`}
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
                              href={`/products?page=1${brandSlug ? `&brand=${encodeURIComponent(brandSlug)}` : ''}`}
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
                                href={`/products?page=${i}${brandSlug ? `&brand=${encodeURIComponent(brandSlug)}` : ''}`}
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
                      {page < Math.ceil(totalProducts / perPage) && (
                        <Link 
                          href={`/products?page=${page + 1}${brandSlug ? `&brand=${encodeURIComponent(brandSlug)}` : ''}`}
                          className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 ml-2"
                        >
                          Successivo
                        </Link>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <div className="max-w-md mx-auto">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <FaBox className="text-gray-400 text-3xl" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessun Prodotto Trovato</h3>
                    <p className="text-gray-500 mb-6">Al momento non ci sono prodotti disponibili.</p>
                    <Link 
                      href="/"
                      className="inline-flex items-center gap-2 bg-bred-500 text-white hover:bg-bred-600 px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      <FaArrowRight className="rotate-180" /> Torna alla Home
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Stats Section */}
          {products.length > 0 && (
            <div className="mt-20 bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="group">
                  <div className="w-16 h-16 bg-bred-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-bred-500/20 transition-colors">
                    <FaBox className="text-bred-500 text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">5000+</h3>
                  <p className="text-gray-600">Prodotti disponibili</p>
                </div>
                
                <div className="group">
                  <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-orange-500/20 transition-colors">
                    <FaStar className="text-orange-500 text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Premium</h3>
                  <p className="text-gray-600">Qualità Prodotti</p>
                </div>
                
                <div className="group">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-500/20 transition-colors">
                    <FaEye className="text-green-500 text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">100%</h3>
                  <p className="text-gray-600">Qualità Garantita</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Caricamento...</div>}>
      <ProductsPageContent />
    </Suspense>
  );
}
