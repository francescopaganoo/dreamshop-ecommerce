'use client';

import { useState, useEffect, useRef } from 'react';
import { Product } from '@/lib/api';
import ProductList from './ProductList';
import Link from 'next/link';
import { FaArrowRight } from 'react-icons/fa';

interface LazyProductSectionProps {
  title: string;
  badge: string;
  description: string;
  categorySlug?: string;
  isSaleProducts?: boolean;
  categoryLink: string;
  buttonText: string;
  bgGradient: string;
  decorativeColors: {
    primary: string;
    secondary: string;
  };
}

interface ProductSectionSkeletonProps {
  title: string;
  badge: string;
  description: string;
}

function ProductSectionSkeleton({ title, badge, description }: ProductSectionSkeletonProps) {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <span className="bg-gray-200 text-gray-400 px-4 py-1 rounded-full text-sm font-medium inline-block mb-3 animate-pulse">
            {badge}
          </span>
          <h2 className="text-3xl md:text-4xl font-bangers text-gray-900">{title}</h2>
          <p className="text-gray-600 mt-3 max-w-2xl mx-auto">{description}</p>
        </div>
        
        <div className="relative">
          {/* Skeleton for products */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-lg mb-4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LazyProductSection({
  title,
  badge,
  description,
  categorySlug,
  isSaleProducts = false,
  categoryLink,
  buttonText,
  bgGradient,
  decorativeColors
}: LazyProductSectionProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      {
        rootMargin: '100px', // Start loading 100px before the section comes into view
        threshold: 0.1
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (isVisible && isLoading) {
      const fetchProducts = async () => {
        try {
          let response;
          if (isSaleProducts) {
            response = await fetch('/api/products/sale?limit=8');
          } else if (categorySlug) {
            response = await fetch(`/api/products/category/${categorySlug}?limit=8`);
          } else {
            throw new Error('Either categorySlug or isSaleProducts must be provided');
          }
          
          if (!response.ok) throw new Error('Failed to fetch products');
          const data = await response.json();
          setProducts(data);
          setIsLoading(false);
        } catch (error) {
          console.error('Error loading products:', error);
          setIsLoading(false);
        }
      };

      fetchProducts();
    }
  }, [isVisible, isLoading, categorySlug, isSaleProducts]);

  if (!isVisible || isLoading) {
    return (
      <section ref={sectionRef}>
        <ProductSectionSkeleton title={title} badge={badge} description={description} />
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section ref={sectionRef} className={`py-16 ${bgGradient}`}>
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <span className="bg-gray-500/10 text-gray-600 px-4 py-1 rounded-full text-sm font-medium inline-block mb-3">
            {badge}
          </span>
          <h2 className="text-3xl md:text-4xl font-bangers text-gray-900">{title}</h2>
          <p className="text-gray-600 mt-3 max-w-2xl mx-auto">{description}</p>
        </div>
        
        <div className="relative">
          {/* Decorative elements */}
          <div className={`absolute -top-6 -left-6 w-12 h-12 ${decorativeColors.primary} rounded-full hidden md:block animate-pulse`}></div>
          <div className={`absolute -bottom-6 -right-6 w-20 h-20 ${decorativeColors.secondary} rounded-full hidden md:block animate-pulse delay-300`}></div>
          
          <ProductList products={products} />
        </div>
        
        <div className="text-center mt-12">
          <Link 
            href={categoryLink}
            className="inline-flex items-center bg-bred-500 text-white hover:bg-bred-600 px-8 py-3 rounded-md font-medium transition-colors shadow-md hover:shadow-lg"
          >
            {buttonText} <FaArrowRight className="ml-2" />
          </Link>
        </div>
      </div>
    </section>
  );
}