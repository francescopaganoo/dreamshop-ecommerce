'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';

const FloatingCartButton: React.FC = () => {
  const { cart, getCartCount } = useCart();
  const pathname = usePathname();
  
  // Non mostrare il pulsante se il carrello è vuoto
  if (cart.length === 0) {
    return null;
  }

  // Non mostrare il pulsante nelle pagine del carrello e checkout per evitare ridondanza
  const hideOnPages = ['/cart', '/checkout'];
  if (hideOnPages.includes(pathname)) {
    return null;
  }

  const totalQuantity = getCartCount();

  return (
    <Link href="/cart">
      <div className="fixed bottom-24 right-4 sm:bottom-26 sm:right-6 z-50">
        <div className="relative">
          {/* Pulsante principale */}
          <button className="bg-bred-500 hover:bg-bred-600 text-white w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-bred-300">
            {/* Icona carrello - stessa dell'header */}
            <svg 
              className="w-5 h-5 sm:w-6 sm:h-6" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" 
              />
            </svg>
          </button>
          
          {/* Badge con numero di prodotti */}
          {totalQuantity > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center border-2 border-white shadow-md min-w-[20px] sm:min-w-[24px]">
              {totalQuantity > 99 ? '99+' : totalQuantity}
            </div>
          )}
          
          {/* Pulse animation sottile per attirare l'attenzione */}
          {totalQuantity > 0 && (
            <div className="absolute inset-0 rounded-full bg-bred-400 opacity-30 animate-pulse"></div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default FloatingCartButton;