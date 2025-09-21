'use client';

import Link from 'next/link';
import { ExtendedCategory, AttributeValue, Brand } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { FaChevronDown, FaChevronUp, FaTimes, FaHome, FaSpinner } from 'react-icons/fa';

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
  selectedAvailabilitySlugs?: string[];
  selectedShippingTimeSlugs?: string[];
  priceRange?: { min: number; max: number };
  selectedPriceRange?: { min: number; max: number };
  onApplyFilters?: (filters: {
    brandSlugs: string[];
    availabilitySlugs: string[];
    shippingTimeSlugs: string[];
    priceRange: { min: number; max: number };
  }) => void;
  isApplyingFilters?: boolean;
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
  selectedAvailabilitySlugs = [],
  selectedShippingTimeSlugs = [],
  priceRange,
  selectedPriceRange,
  onApplyFilters,
  isApplyingFilters = false,
  isOpen = false,
  onClose,
  showAllCategoriesActive = false
}: CategorySidebarProps) {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllAvailability, setShowAllAvailability] = useState(false);
  const [showAllShipping, setShowAllShipping] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);

  // Local states for temporary filter values (until user clicks Apply)
  // Initialize with current selected values and update only when Apply is clicked
  const [localBrandSlugs, setLocalBrandSlugs] = useState(selectedBrandSlugs);
  const [localAvailabilitySlugs, setLocalAvailabilitySlugs] = useState(selectedAvailabilitySlugs);
  const [localShippingTimeSlugs, setLocalShippingTimeSlugs] = useState(selectedShippingTimeSlugs);
  const [localPriceRange, setLocalPriceRange] = useState(selectedPriceRange);

  // Reset local states when component mounts or when we need to sync
  const resetLocalStates = useCallback(() => {
    setLocalBrandSlugs(selectedBrandSlugs);
    setLocalAvailabilitySlugs(selectedAvailabilitySlugs);
    setLocalShippingTimeSlugs(selectedShippingTimeSlugs);
    setLocalPriceRange(selectedPriceRange);
  }, [selectedBrandSlugs, selectedAvailabilitySlugs, selectedShippingTimeSlugs, selectedPriceRange]);

  // Only sync on mount and when filters are actually applied (not on every prop change)
  useEffect(() => {
    resetLocalStates();
  }, [resetLocalStates]);

  const displayedCategories = showAllCategories ? categories : categories.slice(0, 8);
  const displayedAvailability = showAllAvailability ? availabilityOptions : availabilityOptions.slice(0, 6);
  const displayedShipping = showAllShipping ? shippingTimeOptions : shippingTimeOptions.slice(0, 6);
  const displayedBrands = showAllBrands ? brands : brands.slice(0, 8);

  const handleBrandChange = (brandSlug: string, checked: boolean) => {
    let newSelectedBrands: string[];
    if (checked) {
      newSelectedBrands = [...localBrandSlugs, brandSlug];
    } else {
      newSelectedBrands = localBrandSlugs.filter(slug => slug !== brandSlug);
    }
    setLocalBrandSlugs(newSelectedBrands);
  };

  const handleAvailabilityChange = (availabilitySlug: string, checked: boolean) => {
    let newSelectedAvailability: string[];
    if (checked) {
      newSelectedAvailability = [...localAvailabilitySlugs, availabilitySlug];
    } else {
      newSelectedAvailability = localAvailabilitySlugs.filter(slug => slug !== availabilitySlug);
    }
    setLocalAvailabilitySlugs(newSelectedAvailability);
  };

  const handleShippingTimeChange = (shippingSlug: string, checked: boolean) => {
    let newSelectedShipping: string[];
    if (checked) {
      newSelectedShipping = [...localShippingTimeSlugs, shippingSlug];
    } else {
      newSelectedShipping = localShippingTimeSlugs.filter(slug => slug !== shippingSlug);
    }
    setLocalShippingTimeSlugs(newSelectedShipping);
  };

  // Handle local price range change (immediate UI update only, no automatic API calls)
  const handleLocalPriceRangeChange = (range: { min: number; max: number }) => {
    setLocalPriceRange(range);
  };

  // Apply all filters at once
  const handleApplyFilters = () => {
    if (onApplyFilters && priceRange) {
      onApplyFilters({
        brandSlugs: localBrandSlugs,
        availabilitySlugs: localAvailabilitySlugs,
        shippingTimeSlugs: localShippingTimeSlugs,
        priceRange: localPriceRange || { min: priceRange.min, max: priceRange.max }
      });
    }
  };

  // Check if there are changes to show Apply button
  const hasChanges = () => {
    const brandsChanged = JSON.stringify(localBrandSlugs.sort()) !== JSON.stringify(selectedBrandSlugs.sort());
    const availabilityChanged = JSON.stringify(localAvailabilitySlugs.sort()) !== JSON.stringify(selectedAvailabilitySlugs.sort());
    const shippingChanged = JSON.stringify(localShippingTimeSlugs.sort()) !== JSON.stringify(selectedShippingTimeSlugs.sort());
    const priceChanged = JSON.stringify(localPriceRange) !== JSON.stringify(selectedPriceRange);
    return brandsChanged || availabilityChanged || shippingChanged || priceChanged;
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
          <div className="space-y-2">
            {displayedAvailability.map((availability) => (
              <label
                key={availability.slug}
                className="flex items-center py-2 px-3 rounded-md text-sm cursor-pointer transition-colors hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={localAvailabilitySlugs.includes(availability.slug)}
                  onChange={(e) => handleAvailabilityChange(availability.slug, e.target.checked)}
                  className="mr-3 h-4 w-4 text-bred-500 border-gray-300 rounded focus:ring-bred-500 focus:ring-2"
                />
                <span className="text-gray-700 font-medium">
                  {decodeHtmlEntities(availability.name)}
                </span>
              </label>
            ))}
          </div>
          
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

      {/* Shipping Time Section */}
      {shippingTimeOptions.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">
            Tempistiche di spedizione
          </h3>
          <div className="space-y-2">
            {displayedShipping.map((shipping) => (
              <label
                key={shipping.slug}
                className="flex items-center py-2 px-3 rounded-md text-sm cursor-pointer transition-colors hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={localShippingTimeSlugs.includes(shipping.slug)}
                  onChange={(e) => handleShippingTimeChange(shipping.slug, e.target.checked)}
                  className="mr-3 h-4 w-4 text-bred-500 border-gray-300 rounded focus:ring-bred-500 focus:ring-2"
                />
                <span className="text-gray-700 font-medium">
                  {decodeHtmlEntities(shipping.name)}
                </span>
              </label>
            ))}
          </div>

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
                  checked={localBrandSlugs.includes(brand.slug)}
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


      {/* Price Range Section */}
      {priceRange && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">
            Prezzo
          </h3>
          <div className="px-3">
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>€{localPriceRange?.min || priceRange.min}</span>
                <span>€{localPriceRange?.max || priceRange.max}</span>
              </div>
              <div className="relative">
                <div className="slider-track"></div>
                <input
                  type="range"
                  min={priceRange.min}
                  max={priceRange.max}
                  value={localPriceRange?.min || priceRange.min}
                  onChange={(e) => {
                    const newMin = parseInt(e.target.value);
                    const currentMax = localPriceRange?.max || priceRange.max;
                    if (newMin <= currentMax) {
                      handleLocalPriceRangeChange({ min: newMin, max: currentMax });
                    }
                  }}
                  className="slider-thumb-bred slider-min"
                />
                <input
                  type="range"
                  min={priceRange.min}
                  max={priceRange.max}
                  value={localPriceRange?.max || priceRange.max}
                  onChange={(e) => {
                    const newMax = parseInt(e.target.value);
                    const currentMin = localPriceRange?.min || priceRange.min;
                    if (newMax >= currentMin) {
                      handleLocalPriceRangeChange({ min: currentMin, max: newMax });
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

      {/* Apply Filters Button */}
      {hasChanges() && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={handleApplyFilters}
            disabled={isApplyingFilters}
            className="w-full bg-bred-500 text-white py-2 px-4 rounded-md font-medium hover:bg-bred-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isApplyingFilters && <FaSpinner className="animate-spin" />}
            {isApplyingFilters ? 'Applicando...' : 'Applica Filtri'}
          </button>
        </div>
      )}

      </div>
    </>
  );
}
