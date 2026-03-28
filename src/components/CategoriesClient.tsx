'use client';

import { ExtendedCategory, Brand, AttributeValue } from '@/lib/api';
import CategorySidebar from '@/components/CategorySidebar';
import MobileFilterButton from '@/components/MobileFilterButton';
import Image from 'next/image';
import Link from 'next/link';
import { FaArrowRight, FaTags, FaEye } from 'react-icons/fa';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { decodeHtmlEntities } from '@/lib/decodeHtmlEntities';

// Mapping dei loghi per le categorie specifiche
const CATEGORY_LOGOS: Record<string, string> = {
  'Bleach': '/images/logos/bleach-logo.webp',
  'Demon Slayer': '/images/logos/demon-slayer-logo.webp',
  'Dragon Ball': '/images/logos/dragon-ball-z-logo.webp',
  'Dragon Ball Z': '/images/logos/dragon-ball-z-logo.webp',
  'S.H. Figuarts': '/images/logos/figuarts-logo.webp',
  'Ichiban Kuji': '/images/logos/ichiban-kuji-logo.webp',
  'Jujutsu Kaisen': '/images/logos/jujutsu-kaisen-logo.webp',
  'My Hero Academia': '/images/logos/my-hero-academia-logo.webp',
  'Naruto': '/images/logos/naruto-logo.webp',
  'One Piece': '/images/logos/one-piece-logo.webp',
  'Pokemon': '/images/logos/pokemon-logo.webp',
  'Pokémon': '/images/logos/pokemon-logo.webp',
  'Tokyo Revengers': '/images/logos/tokyo-revengers-logo.webp'
};

function getCategoryLogo(categoryName: string): string | null {
  const decodedName = decodeHtmlEntities(categoryName);
  return CATEGORY_LOGOS[decodedName] || null;
}

interface CategoriesClientProps {
  categories: ExtendedCategory[];
  brands: Brand[];
  availabilityOptions: AttributeValue[];
  shippingTimeOptions: AttributeValue[];
  priceRange: { min: number; max: number } | undefined;
}

export default function CategoriesClient({
  categories,
  brands,
  availabilityOptions,
  shippingTimeOptions,
  priceRange,
}: CategoriesClientProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();

  const handleApplyFilters = (filters: {
    brandSlugs: string[];
    availabilitySlugs: string[];
    shippingTimeSlugs: string[];
    priceRange: { min: number; max: number };
    excludeSoldOut: boolean;
  }) => {
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

    const url = `/products${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    router.push(url);
  };

  return (
    <>
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
            selectedBrandSlugs={[]}
            selectedAvailabilitySlugs={[]}
            selectedShippingTimeSlugs={[]}
            priceRange={priceRange}
            selectedPriceRange={priceRange}
            excludeSoldOut={false}
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
                        alt={decodeHtmlEntities(category.name)}
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
                              alt={decodeHtmlEntities(category.name)}
                              width={120}
                              height={40}
                              style={{ objectFit: 'contain', maxHeight: '40px' }}
                              className="group-hover:brightness-75 transition-all duration-300"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <h2 className="text-l font-bold text-gray-900 mb-2 group-hover:text-bred-600 transition-colors duration-300">
                            {decodeHtmlEntities(category.name)}
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
    </>
  );
}
