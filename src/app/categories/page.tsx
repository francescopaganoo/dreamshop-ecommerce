'use client';

import { getMegaMenuCategories, getFilterOptionsPlugin, ExtendedCategory, Brand, AttributeValue } from '../../lib/api';
import CategorySidebar from '../../components/CategorySidebar';
import MobileFilterButton from '../../components/MobileFilterButton';
import Image from 'next/image';
import Link from 'next/link';
import { FaArrowRight, FaTags, FaEye, FaStar } from 'react-icons/fa';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Mapping dei loghi per le categorie specifiche
const CATEGORY_LOGOS: Record<string, string> = {
  'Bleach': '/images/logos/bleach-logo.webp',
  'Demon Slayer': '/images/logos/demon-slayer-logo.webp',
  'Dragon Ball': '/images/logos/dragon-ball-z-logo.webp',
  'Dragon Ball Z': '/images/logos/dragon-ball-z-logo.webp', // Caso alternativo
  'S.H. Figuarts': '/images/logos/figuarts-logo.webp',
  'Ichiban Kuji': '/images/logos/ichiban-kuji-logo.webp',
  'Jujutsu Kaisen': '/images/logos/jujutsu-kaisen-logo.webp',
  'My Hero Academia': '/images/logos/my-hero-academia-logo.webp',
  'Naruto': '/images/logos/naruto-logo.webp',
  'One Piece': '/images/logos/one-piece-logo.webp',
  'Pokemon': '/images/logos/pokemon-logo.webp',
  'Pokémon': '/images/logos/pokemon-logo.webp', // Caso con accento
  'Tokyo Revengers': '/images/logos/tokyo-revengers-logo.webp'
};

// Funzione per decodificare le entità HTML lato server
function decodeHtmlEntitiesServer(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Funzione per ottenere il logo di una categoria se disponibile
function getCategoryLogo(categoryName: string): string | null {
  const decodedName = decodeHtmlEntitiesServer(categoryName);
  return CATEGORY_LOGOS[decodedName] || null;
}

export default function CategoriesPage() {
  const [megaMenuCategories, setMegaMenuCategories] = useState<ExtendedCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [availabilityOptions, setAvailabilityOptions] = useState<AttributeValue[]>([]);
  const [shippingTimeOptions, setShippingTimeOptions] = useState<AttributeValue[]>([]);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | undefined>(undefined);
  const [excludeSoldOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();

  // Handle filter application - redirect to products page with filters
  const handleApplyFilters = (filters: {
    brandSlugs: string[];
    availabilitySlugs: string[];
    shippingTimeSlugs: string[];
    priceRange: { min: number; max: number };
    excludeSoldOut: boolean;
  }) => {
    // Build search params for the products page
    const searchParams = new URLSearchParams();

    if (filters.brandSlugs.length > 0) {
      searchParams.set('brands', filters.brandSlugs.join(','));
    }

    if (filters.availabilitySlugs.length > 0) {
      searchParams.set('availability', filters.availabilitySlugs.join(','));
    }

    if (filters.shippingTimeSlugs.length > 0) {
      searchParams.set('shipping', filters.shippingTimeSlugs.join(','));
    }

    if (priceRange && (filters.priceRange.min > priceRange.min || filters.priceRange.max < priceRange.max)) {
      searchParams.set('minPrice', filters.priceRange.min.toString());
      searchParams.set('maxPrice', filters.priceRange.max.toString());
    }

    if (filters.excludeSoldOut) {
      searchParams.set('excludeSoldOut', 'true');
    }

    // Navigate to products page with filters
    const url = `/products${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    router.push(url);
  };


  useEffect(() => {
    async function fetchData() {
      try {
        // Carica categorie e filtri dal plugin ottimizzato
        const [categoriesData, filterOptions] = await Promise.all([
          getMegaMenuCategories(),
          getFilterOptionsPlugin()
        ]);

        setMegaMenuCategories(categoriesData);
        setBrands(filterOptions.brands);
        setAvailabilityOptions(filterOptions.availability);
        setShippingTimeOptions(filterOptions.shipping_times);
        setPriceRange(filterOptions.price_range);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Caricamento...</div>;
  }
  
  // Solo le categorie principali per la griglia (non le sottocategorie)
  const categories = megaMenuCategories;
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
      
      <main className="flex-grow py-8 md:py-16">
        <div className="container mx-auto px-4 md:px-6">
          {/* Enhanced Page Header */}
          <div className="relative mb-16 text-center">
            {/* Background decorative elements */}
            <div className="absolute -top-8 -left-8 w-16 h-16 bg-bred-500/10 rounded-full hidden lg:block animate-pulse"></div>
            <div className="absolute -top-4 -right-12 w-24 h-24 bg-orange-500/10 rounded-full hidden lg:block animate-pulse delay-300"></div>
            
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 bg-bred-500/10 text-bred-600 px-4 py-2 rounded-full text-sm font-medium mb-4">
                <FaTags className="animate-spin-slow" /> ESPLORA
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bangers text-gray-900 mb-6 leading-tight">
                Tutte le <span className="text-bred-500">Categorie</span>
              </h1>
              <p className="text-gray-600 text-lg max-w-3xl mx-auto mb-8 leading-relaxed">
                Scopri il nostro universo di prodotti organizzati per categoria. 
                Dalle statue più dettagliate alle carte collezionabili più rare.
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
                categories={megaMenuCategories}
                availabilityOptions={availabilityOptions}
                shippingTimeOptions={shippingTimeOptions}
                brands={brands}
                selectedBrandSlugs={[]}
                selectedAvailabilitySlugs={[]}
                selectedShippingTimeSlugs={[]}
                priceRange={priceRange}
                selectedPriceRange={priceRange}
                excludeSoldOut={excludeSoldOut}
                onApplyFilters={handleApplyFilters}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                showAllCategoriesActive={true}
              />
            </div>
            
            {/* Categories Grid */}
            <div className="flex-1">
              {categories.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                  {categories.map((category, index: number) => (
                    <Link 
                      key={category.id} 
                      href={`/category/${category.slug}`}
                      className="group relative h-80 bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-gray-100"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Category Image */}
                      <div className="relative h-48 overflow-hidden">
                        {category.image ? (
                          <Image
                            src={category.image.src}
                            alt={decodeHtmlEntitiesServer(category.name)}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            style={{ objectFit: 'cover' }}
                            className="group-hover:scale-110 transition-transform duration-700"
                            loading="lazy"
                            placeholder="blur"
                            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-bred-500 via-orange-500 to-red-500"></div>
                        )}
                        
                        {/* Overlay gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        
                        {/* Hover icon */}
                        <div className="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                          <FaEye className="text-white" />
                        </div>
                      </div>
                      
                      {/* Category Info */}
                      <div className="p-6 flex flex-col justify-between h-32">
                        <div>
                          {(() => {
                            const categoryLogo = getCategoryLogo(category.name);
                            return categoryLogo ? (
                              <div className="flex items-center justify-center h-12 mb-2">
                                <Image
                                  src={categoryLogo}
                                  alt={decodeHtmlEntitiesServer(category.name)}
                                  width={120}
                                  height={40}
                                  style={{ objectFit: 'contain', maxHeight: '40px' }}
                                  className="group-hover:brightness-75 transition-all duration-300"
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <h2 className="text-l font-bold text-gray-900 mb-2 group-hover:text-bred-600 transition-colors duration-300">
                                {decodeHtmlEntitiesServer(category.name)}
                              </h2>
                            );
                          })()}
                        </div>
                        
                        {/* Action Button */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-bred-600 group-hover:text-bred-700 transition-colors">
                            Esplora Categoria
                          </span>
                          <div className="w-8 h-8 bg-bred-500 rounded-full flex items-center justify-center group-hover:bg-bred-600 transition-all duration-300 transform group-hover:scale-110">
                            <FaArrowRight className="text-white text-sm group-hover:translate-x-0.5 transition-transform duration-300" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Decorative elements */}
                      <div className="absolute -bottom-2 -right-2 w-20 h-20 bg-bred-500/5 rounded-full blur-xl group-hover:bg-bred-500/10 transition-colors duration-500"></div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="max-w-md mx-auto">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <FaTags className="text-gray-400 text-3xl" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessuna Categoria Trovata</h3>
                    <p className="text-gray-500 mb-6">Al momento non ci sono categorie disponibili.</p>
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
          {categories.length > 0 && (
            <div className="mt-20 bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="group">
                  <div className="w-16 h-16 bg-bred-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-bred-500/20 transition-colors">
                    <FaTags className="text-bred-500 text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{categories.length}</h3>
                  <p className="text-gray-600">Categorie Disponibili</p>
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
