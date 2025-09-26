'use client';

import { useState, useEffect, useRef } from 'react';
import { Product, getFilteredProductsPlugin } from '@/lib/api';
import ProductList from './ProductList';
import Link from 'next/link';
import { FaArrowRight } from 'react-icons/fa';

interface LazyProductSectionProps {
  title?: string;
  badge?: string;
  description?: string;
  categorySlug?: string;
  isSaleProducts?: boolean;
  isLatestProducts?: boolean;
  categoryLink: string;
  buttonText: string;
  bgGradient: string;
  decorativeColors: {
    primary: string;
    secondary: string;
  };
}

interface ProductSectionSkeletonProps {
  title?: string;
  badge?: string;
  description?: string;
}

function ProductSectionSkeleton({ title, badge, description }: ProductSectionSkeletonProps) {
  const hasHeader = title || badge || description;

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-6">
        {hasHeader && (
          <div className="text-center mb-12">
            {badge && (
              <span className="bg-gray-200 text-gray-400 px-4 py-1 rounded-full text-sm font-medium inline-block mb-3 animate-pulse">
                {badge}
              </span>
            )}
            {title && <h2 className="text-3xl md:text-4xl font-bangers text-gray-900">{title}</h2>}
            {description && <p className="text-gray-600 mt-3 max-w-2xl mx-auto">{description}</p>}
          </div>
        )}

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
  isLatestProducts = false,
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
        rootMargin: '500px', // Start loading 500px before the section comes into view
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
      const abortController = new AbortController();
      
      // Aggiungiamo un piccolo ritardo casuale per evitare richieste simultanee
      const randomDelay = Math.random() * 500; // 0-500ms di ritardo casuale
      
      const fetchProducts = async () => {
        // Aspetta il ritardo casuale per distribuire le richieste
        await new Promise(resolve => setTimeout(resolve, randomDelay));
        try {
          let data: Product[] = [];

          if (isSaleProducts) {
            // Usa il plugin per ottenere prodotti in offerta
            const response = await getFilteredProductsPlugin({
              on_sale: true,
              page: 1,
              per_page: 8,
              orderby: 'date',
              order: 'desc'
            });
            data = response.products;
          } else {
            // Usa fetch per le altre sezioni
            const abortController = new AbortController();
            let response;
            const fetchOptions = {
              signal: abortController.signal,
              headers: {
                'Cache-Control': 'no-cache'
              }
            };

            // Aggiungiamo un timeout di 10 secondi
            const timeoutId = setTimeout(() => {
              abortController.abort();
            }, 10000);

            if (isLatestProducts) {
              response = await fetch('/api/products/latest?limit=8', fetchOptions);
            } else if (categorySlug) {
              response = await fetch(`/api/products/category/${categorySlug}?limit=8`, fetchOptions);
            } else {
              throw new Error('Either categorySlug, isSaleProducts, or isLatestProducts must be provided');
            }

            clearTimeout(timeoutId);

            if (!response.ok) {
              throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
            }

            data = await response.json();
          }

          setProducts(data);
          setIsLoading(false);
        } catch (error) {
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              console.warn('Product fetch was aborted (timeout or component unmounted):', categorySlug || isSaleProducts ? 'sale' : 'latest');
            } else {
              console.error('Error loading products:', error.message);
            }
          } else {
            console.error('Unknown error loading products:', error);
          }
          setIsLoading(false);
        }
      };

      fetchProducts();

      // Cleanup function per cancellare la richiesta se il componente viene smontato
      return () => {
        abortController.abort();
      };
    }
  }, [isVisible, isLoading, categorySlug, isSaleProducts, isLatestProducts]);

  if (!isVisible) {
    return <section ref={sectionRef}></section>;
  }

  if (isLoading) {
    return (
      <section ref={sectionRef}>
        <ProductSectionSkeleton title={title} badge={badge} description={description} />
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  const hasHeader = title || badge || description;

  return (
    <section ref={sectionRef} className={`py-16 ${bgGradient}`}>
      <div className="container mx-auto px-6">
        {hasHeader && (
          <div className="text-center mb-12">
            {badge && (
              <span className="bg-gray-500/10 text-gray-600 px-4 py-1 rounded-full text-sm font-medium inline-block mb-3">
                {badge}
              </span>
            )}
            {title && <h2 className="text-3xl md:text-4xl font-bangers text-gray-900">{title}</h2>}
            {description && <p className="text-gray-600 mt-3 max-w-2xl mx-auto">{description}</p>}
          </div>
        )}

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