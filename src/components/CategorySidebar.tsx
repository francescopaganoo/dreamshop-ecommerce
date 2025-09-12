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
  currentBrandSlug,
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
          <ul className="space-y-2">
            {displayedBrands.map((brand) => (
              <li key={brand.id}>
                <Link
                  href={`/products?brand=${encodeURIComponent(brand.slug)}`}
                  className={`block py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    currentBrandSlug === brand.slug
                      ? 'bg-bred-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-bred-600'
                  }`}
                >
                  {decodeHtmlEntities(brand.name)}{typeof brand.count === 'number' ? ` (${brand.count})` : ''}
                </Link>
              </li>
            ))}
          </ul>
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
      </div>
    </>
  );
}
