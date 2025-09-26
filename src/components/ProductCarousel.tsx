'use client';

import { useState, useRef, useEffect } from 'react';
import ProductCard from './ProductCard';
import { Product } from '@/lib/api';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface ProductCarouselProps {
  products: Product[];
  title: string;
}

export default function ProductCarousel({ products, title }: ProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Controlla se possiamo scorrere a sinistra/destra
  const checkScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', checkScrollButtons);
      return () => scrollElement.removeEventListener('scroll', checkScrollButtons);
    }
  }, [products]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const cardWidth = 256; // w-64 = 16rem = 256px
      const gap = 24; // gap-6 = 1.5rem = 24px
      const scrollAmount = cardWidth + gap;

      const newScrollLeft = direction === 'left'
        ? scrollRef.current.scrollLeft - scrollAmount
        : scrollRef.current.scrollLeft + scrollAmount;

      scrollRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  if (products.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex items-center mb-8">
        <svg className="w-6 h-6 mr-3 text-bred-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      </div>

      <div className="relative group">
        {/* Freccia sinistra */}
        <button
          onClick={() => scroll('left')}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center transition-all duration-200 ${
            canScrollLeft
              ? 'opacity-100 hover:bg-gray-50 hover:shadow-xl'
              : 'opacity-0 pointer-events-none'
          }`}
          aria-label="Scorri a sinistra"
        >
          <FaChevronLeft className="w-4 h-4 text-gray-600" />
        </button>

        {/* Freccia destra */}
        <button
          onClick={() => scroll('right')}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center transition-all duration-200 ${
            canScrollRight
              ? 'opacity-100 hover:bg-gray-50 hover:shadow-xl'
              : 'opacity-0 pointer-events-none'
          }`}
          aria-label="Scorri a destra"
        >
          <FaChevronRight className="w-4 h-4 text-gray-600" />
        </button>

        {/* Carosello */}
        <div
          ref={scrollRef}
          className="overflow-x-auto scrollbar-hide scroll-smooth"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="flex gap-4 md:gap-6 pb-4 px-1" style={{ width: 'max-content' }}>
            {products.map((product) => (
              <div key={product.id} className="flex-none w-48 md:w-64">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}