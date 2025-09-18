'use client';

import Link from 'next/link';
import { ExtendedCategory, AttributeValue, Brand } from '@/lib/api';
import { useState } from 'react';
import { FaChevronDown, FaChevronUp, FaTimes, FaHome } from 'react-icons/fa';

// Funzione per decodificare le entità HTML
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

interface CategorySidebarProps {
  categories: ExtendedCategory[];
  availabilityOptions?: AttributeValue[];
  shippingTimeOptions?: AttributeValue[];
  currentCategorySlug?: string;
  brands?: Brand[];
  currentBrandSlug?: string;
  selectedBrandSlugs?: string[];
  onBrandSelectionChange?: (selectedBrands: string[]) => void;
  priceRange?: { min: number; max: number };
  selectedPriceRange?: { min: number; max: number };
  onPriceRangeChange?: (range: { min: number; max: number }) => void;
  isOpen?: boolean;
  onClose?: () => void;
  showAllCategoriesActive?: boolean;
}

export default function CategorySidebar({
  categories,
  availabilityOptions = [],
  shippingTimeOptions = [],
  currentCategorySlug,
  brands = [],
  selectedBrandSlugs = [],
  onBrandSelectionChange,
  priceRange,
  selectedPriceRange,
  onPriceRangeChange,
  isOpen = false,
  onClose,
  showAllCategoriesActive = false
}: CategorySidebarProps) {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllAvailability, setShowAllAvailability] = useState(false);
  const [showAllShipping, setShowAllShipping] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);

  const displayedCategories = showAllCategories ? categories : categories.slice(0, 8);
  const displayedAvailability = showAllAvailability ? availabilityOptions : availabilityOptions.slice(0, 6);
  const displayedShipping = showAllShipping ? shippingTimeOptions : shippingTimeOptions.slice(0, 6);
  const displayedBrands = showAllBrands ? brands : brands.slice(0, 8);

  const handleBrandChange = (brandSlug: string, checked: boolean) => {
    if (!onBrandSelectionChange) return;

    let newSelectedBrands: string[];
    if (checked) {
      newSelectedBrands = [...selectedBrandSlugs, brandSlug];
    } else {
      newSelectedBrands = selectedBrandSlugs.filter(slug => slug !== brandSlug);
    }
    onBrandSelectionChange(newSelectedBrands);
  };

  return (
    <>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        w-full lg:w-64 bg-white rounded-lg shadow-sm border border-gray-200 p-6
        lg:relative lg:translate-x-0 lg:z-auto
        ${isOpen 
          ? 'fixed top-0 left-0 h-full z-50 translate-x-0 overflow-y-auto' 
          : 'hidden lg:block'
        }
      `}>
        {/* Mobile Close Button */}
        <div className="lg:hidden flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700"
            aria-label="Chiudi menu"
          >
            <FaTimes />
          </button>
        </div>

        {/* Categories Section */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">
            Categorie
          </h3>

          {/* Reset Filter - Tutte le categorie */}
          <div className="mb-4">
            <Link
              href="/categories"
              className={`flex items-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                showAllCategoriesActive || !currentCategorySlug
                  ? 'bg-bred-500 text-white' 
                  : 'text-gray-700 hover:bg-gray-100 hover:text-bred-600 border border-gray-200'
              }`}
            >
              <FaHome className="text-xs" />
              Tutte le categorie
            </Link>
          </div>

        <ul className="space-y-2">
          {displayedCategories.map((category) => (
            <li key={category.id}>
              {/* Categoria principale */}
              <Link
                href={`/category/${category.slug}`}
                className={`block py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  currentCategorySlug === category.slug
                    ? 'bg-bred-500 text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-bred-600'
                }`}
              >
                {decodeHtmlEntities(category.name)}
              </Link>
              
              {/* Sottocategorie */}
              {category.subcategories && category.subcategories.length > 0 && (
                <ul className="ml-4 mt-1 space-y-1">
                  {category.subcategories.map((subcategory) => (
                    <li key={subcategory.id}>
                      <Link
                        href={`/category/${subcategory.slug}`}
                        className={`block py-1 px-3 rounded-md text-xs transition-colors ${
                          currentCategorySlug === subcategory.slug
                            ? 'bg-bred-400 text-white'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-bred-500'
                        }`}
                      >
                        {decodeHtmlEntities(subcategory.name)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        
        {categories.length > 8 && (
          <button
            onClick={() => setShowAllCategories(!showAllCategories)}
            className="mt-3 text-sm text-bred-600 hover:text-bred-700 flex items-center gap-1"
          >
            {showAllCategories ? (
              <>
                Mostra meno <FaChevronUp className="text-xs" />
              </>
            ) : (
              <>
                Mostra tutte ({categories.length - 8} in più) <FaChevronDown className="text-xs" />
              </>
            )}
          </button>
        )}
      </div>


      {/* Availability Section */}
      {availabilityOptions.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">
            Disponibilità
          </h3>
          <ul className="space-y-2">
            {displayedAvailability.map((availability) => (
              <li key={availability.slug}>
                <Link
                  href={`/availability/${availability.slug}`}
                  className="block py-2 px-3 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-bred-600 transition-colors"
                >
                  {decodeHtmlEntities(availability.name)}
                </Link>
              </li>
            ))}
          </ul>
          
          {availabilityOptions.length > 6 && (
            <button
              onClick={() => setShowAllAvailability(!showAllAvailability)}
              className="mt-3 text-sm text-bred-600 hover:text-bred-700 flex items-center gap-1"
            >
              {showAllAvailability ? (
                <>
                  Mostra meno <FaChevronUp className="text-xs" />
                </>
              ) : (
                <>
                  Mostra tutte ({availabilityOptions.length - 6} in più) <FaChevronDown className="text-xs" />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Brands Section */}
      {brands.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">
            Marchi
          </h3>
          <div className="space-y-2">
            {displayedBrands.map((brand) => (
              <label
                key={brand.id}
                className="flex items-center py-2 px-3 rounded-md text-sm cursor-pointer transition-colors hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedBrandSlugs.includes(brand.slug)}
                  onChange={(e) => handleBrandChange(brand.slug, e.target.checked)}
                  className="mr-3 h-4 w-4 text-bred-500 border-gray-300 rounded focus:ring-bred-500 focus:ring-2"
                />
                <span className="text-gray-700 font-medium">
                  {decodeHtmlEntities(brand.name)}
                </span>
              </label>
            ))}
          </div>
          {brands.length > 8 && (
            <button
              onClick={() => setShowAllBrands(!showAllBrands)}
              className="mt-3 text-sm text-bred-600 hover:text-bred-700 flex items-center gap-1"
            >
              {showAllBrands ? (
                <>
                  Mostra meno <FaChevronUp className="text-xs" />
                </>
              ) : (
                <>
                  Mostra tutti ({brands.length - 8} in più) <FaChevronDown className="text-xs" />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Shipping Times Section */}
      {shippingTimeOptions.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">
            Tempistiche di Spedizione
          </h3>
          <ul className="space-y-2">
            {displayedShipping.map((shipping) => (
              <li key={shipping.slug}>
                <Link
                  href={`/shipping/${shipping.slug}`}
                  className="block py-2 px-3 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-bred-600 transition-colors"
                >
                  {decodeHtmlEntities(shipping.name)}
                </Link>
              </li>
            ))}
          </ul>
          
          {shippingTimeOptions.length > 6 && (
            <button
              onClick={() => setShowAllShipping(!showAllShipping)}
              className="mt-3 text-sm text-bred-600 hover:text-bred-700 flex items-center gap-1"
            >
              {showAllShipping ? (
                <>
                  Mostra meno <FaChevronUp className="text-xs" />
                </>
              ) : (
                <>
                  Mostra tutte ({shippingTimeOptions.length - 6} in più) <FaChevronDown className="text-xs" />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Price Range Section */}
      {priceRange && onPriceRangeChange && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">
            Prezzo
          </h3>
          <div className="px-3">
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>€{selectedPriceRange?.min || priceRange.min}</span>
                <span>€{selectedPriceRange?.max || priceRange.max}</span>
              </div>
              <div className="relative">
                <div className="slider-track"></div>
                <input
                  type="range"
                  min={priceRange.min}
                  max={priceRange.max}
                  value={selectedPriceRange?.min || priceRange.min}
                  onChange={(e) => {
                    const newMin = parseInt(e.target.value);
                    const currentMax = selectedPriceRange?.max || priceRange.max;
                    if (newMin <= currentMax) {
                      onPriceRangeChange({ min: newMin, max: currentMax });
                    }
                  }}
                  className="slider-thumb-bred slider-min"
                />
                <input
                  type="range"
                  min={priceRange.min}
                  max={priceRange.max}
                  value={selectedPriceRange?.max || priceRange.max}
                  onChange={(e) => {
                    const newMax = parseInt(e.target.value);
                    const currentMin = selectedPriceRange?.min || priceRange.min;
                    if (newMax >= currentMin) {
                      onPriceRangeChange({ min: currentMin, max: newMax });
                    }
                  }}
                  className="slider-thumb-bred slider-max"
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>€{priceRange.min}</span>
              <span>€{priceRange.max}</span>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
