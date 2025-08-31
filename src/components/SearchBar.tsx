"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { searchProducts, Product } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface SearchBarProps {
  isMobile?: boolean;
  onClose?: () => void;
}

export default function SearchBar({ isMobile = false, onClose }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchTerm.trim().length >= 2) {
        setIsLoading(true);
        try {
          const searchResults = await searchProducts(searchTerm, 1, 6);
          setResults(searchResults);
          setShowResults(true);
        } catch (error) {
          console.error('Search error:', error);
          setResults([]);
        }
        setIsLoading(false);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handle clicks outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchTerm)}`);
      setShowResults(false);
      if (onClose) onClose();
    }
  };

  const formatPrice = (price: string) => {
    const parsedPrice = parseFloat(price);
    return isNaN(parsedPrice) ? '' : `€${parsedPrice.toFixed(2)}`;
  };

  const handleResultClick = () => {
    setShowResults(false);
    if (onClose) onClose();
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Cerca prodotti..."
            className={`w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-bred-700 ${
              isMobile ? 'text-gray-900' : 'text-white placeholder-gray-300'
            }`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setShowResults(true);
            }}
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {/* Search Results Dropdown */}
      {showResults && searchTerm.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden">
          {results.length > 0 ? (
            <>
              <div className="max-h-80 overflow-y-auto">
                {results.map((product) => (
                  <Link
                    key={product.id}
                    href={`/prodotto/${product.slug}`}
                    className="flex items-center p-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    onClick={handleResultClick}
                  >
                    {product.images && product.images.length > 0 ? (
                      <Image
                        src={product.images[0].src}
                        alt={product.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 object-cover rounded-md mr-3 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded-md mr-3 flex-shrink-0"></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </h4>
                      <div className="flex items-center mt-1">
                        {product.sale_price && product.sale_price !== product.regular_price ? (
                          <>
                            <span className="text-sm font-semibold text-red-600">
                              {formatPrice(product.sale_price)}
                            </span>
                            <span className="text-xs text-gray-500 line-through ml-2">
                              {formatPrice(product.regular_price)}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">
                            {formatPrice(product.regular_price)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              
              {/* View All Results Link */}
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <Link
                  href={`/search?q=${encodeURIComponent(searchTerm)}`}
                  className="flex items-center justify-center w-full text-bred-600 hover:text-bred-700 font-medium text-sm"
                  onClick={handleResultClick}
                >
                  Vedi tutti i risultati per &quot;{searchTerm}&quot;
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </>
          ) : (
            <div className="p-4 text-center text-gray-500">
              Nessun prodotto trovato per &quot;{searchTerm}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}