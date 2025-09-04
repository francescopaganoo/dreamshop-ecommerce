"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import LanguageSelector from './LanguageSelector';
import SearchBar from './SearchBar';
import { getCategories, Category } from '@/lib/api';
import { setReturnUrl } from '@/lib/auth';

// Tipo esteso per le categorie con sottocategorie
interface ExtendedCategory extends Category {
  subcategories?: Category[];
}

export default function Header() {
  const { getCartCount } = useCart();
  const { isAuthenticated, user, logout } = useAuth();
  const { wishlistItems } = useWishlist();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const megaMenuTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Riferimenti per gestire i click esterni
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const megaMenuRef = useRef<HTMLDivElement>(null);
  
  // Salva l'URL corrente per il redirect post-login
  useEffect(() => {
    if (pathname && pathname !== '/login' && pathname !== '/register') {
      const currentUrl = pathname + window.location.search;
      setReturnUrl(currentUrl);
    }
  }, [pathname]);
  
  // Gestisce i click esterni per chiudere i menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Chiude il menu a tendina dell'account
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      
      // Chiude il mega menu quando si clicca fuori
      if (megaMenuRef.current && !megaMenuRef.current.contains(event.target as Node)) {
        setIsMegaMenuOpen(false);
      }
      
      // Chiude il menu mobile quando si clicca fuori
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        // Non chiudiamo il menu se si clicca sul pulsante hamburger (quello gestirà il toggle)
        const hamburgerButton = document.getElementById('mobile-menu-button');
        if (hamburgerButton && !hamburgerButton.contains(event.target as Node)) {
          setIsMobileMenuOpen(false);
        }
      }
    }
    
    // Aggiungi l'event listener quando i menu sono aperti
    if (isMenuOpen || isMobileMenuOpen || isMegaMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    // Cleanup dell'event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen, isMobileMenuOpen, isMegaMenuOpen]);
  
  // Blocca lo scroll quando il menu mobile è aperto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Carica le categorie all'avvio
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const allCategories = await getCategories();
        // Filtra le categorie per il mega menu - escludi quelle non necessarie E le sottocategorie che saranno mostrate come sottocategorie
        const excludedSlugs = [
          'attack-on-titan',
          'black-week',
          'cina',
          'cina-rs', 
          'crazy-month',
          'editoria',
          'gift-card',
          'italia',
          'no-categoria',
          'nuovi-arrivi',
          'senza-categoria',
          // Sottocategorie da escludere come categorie principali
          'dragon-ball-cg',
          'one-piece-cg',
          'yu-gi-oh',
          'jimei-palace',
          'tsume'
        ];
        
        // Crea un array per organizzare le categorie con le loro sottocategorie
        const organizedCategories = [];
        const mainCategories = allCategories.filter(category => !excludedSlugs.includes(category.slug));
        
        // Trova le sottocategorie specifiche
        const cardGameSubcats = allCategories.filter(cat => 
          ['dragon-ball-cg', 'one-piece-cg', 'yu-gi-oh'].includes(cat.slug)
        );
        const resineSubcats = allCategories.filter(cat => 
          ['jimei-palace', 'tsume'].includes(cat.slug)
        );
        
        // Aggiungi tutte le categorie principali
        for (const category of mainCategories) {
          if (category.slug === 'card-game' || category.slug === 'cards' || category.name.toLowerCase().includes('card')) {
            // Aggiungi categoria Card Game
            organizedCategories.push({
              ...category,
              subcategories: cardGameSubcats
            });
          } else if (category.slug === 'resine' || category.name.toLowerCase().includes('resin')) {
            // Aggiungi categoria Resine
            organizedCategories.push({
              ...category,
              subcategories: resineSubcats
            });
          } else {
            organizedCategories.push({
              ...category,
              subcategories: []
            });
          }
        }
        
        setCategories(organizedCategories);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };

    loadCategories();
  }, []);

  // Funzioni per gestire l'hover del mega menu
  const handleMegaMenuEnter = () => {
    if (megaMenuTimer.current) {
      clearTimeout(megaMenuTimer.current);
    }
    setIsMegaMenuOpen(true);
  };

  const handleMegaMenuLeave = () => {
    megaMenuTimer.current = setTimeout(() => {
      setIsMegaMenuOpen(false);
    }, 150); // Delay di 150ms per permettere di passare al mega menu
  };

  // Funzione per decodificare le entità HTML
  const decodeHtmlEntities = (text: string): string => {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#8217;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"');
  };


  return (
    <header className="bg-bred-500 shadow-md relative z-30">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo - sempre visibile sia mobile che desktop */}
          <Link href="/" className="text-2xl font-bold text-gray-800 relative">
            <Image src="/images/logo.webp" alt="Logo DreamShop" width={160} height={40} priority className="w-auto h-auto" />
          </Link>

          {/* Icone sempre visibili su mobile (carrello e wishlist) */}
          <div className="flex items-center space-x-3 md:hidden relative">
            <Link href="/wishlist" className="relative text-white hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {wishlistItems.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-bred-500 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {wishlistItems.length}
                </span>
              )}
            </Link>
            <Link href="/cart" className="relative text-white hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {getCartCount() > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-bred-500 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {getCartCount()}
                </span>
              )}
            </Link>
            
            {/* Hamburger menu button */}
            <button 
              id="mobile-menu-button"
              className="text-white p-1 focus:outline-none relative"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Menu principale"
            >
              {isMobileMenuOpen ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Search Bar - visibile solo da tablet in su */}
          <div className="hidden md:flex flex-1 mx-10">
            <div className="w-full max-w-xl">
              <SearchBar />
            </div>
          </div>

          {/* Navigation Desktop - visibile solo da tablet in su */}
          <nav className="hidden md:flex items-center space-x-6">
            <div 
              className="relative"
              ref={megaMenuRef}
              onMouseEnter={handleMegaMenuEnter}
              onMouseLeave={handleMegaMenuLeave}
            >
              <Link href="/categories" className="text-white hover:text-white flex items-center">
                Categorie
                <svg 
                  className={`w-4 h-4 ml-1 transition-transform ${isMegaMenuOpen ? 'transform rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Link>
              
              {/* Mega Menu */}
              {isMegaMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-[800px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                  <div className="p-6">
                    <div className="grid grid-cols-3 gap-4">
                      {categories.map((category) => (
                        <div key={category.id} className="space-y-2">
                          {/* Categoria principale */}
                          <Link
                            href={`/category/${category.slug}`}
                            className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                            onClick={() => setIsMegaMenuOpen(false)}
                          >
                            {category.image ? (
                              <div className="w-16 h-12 rounded-lg overflow-hidden mr-3 flex-shrink-0">
                                <Image
                                  src={category.image.src}
                                  alt={category.name}
                                  width={48}
                                  height={48}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                />
                              </div>
                            ) : (
                              <div className="w-12 h-12 bg-gradient-to-br from-bred-500 to-orange-500 rounded-lg mr-3 flex-shrink-0"></div>
                            )}
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900 group-hover:text-bred-600 transition-colors">
                                {decodeHtmlEntities(category.name).length > 18 ? `${decodeHtmlEntities(category.name).substring(0, 18)}...` : decodeHtmlEntities(category.name)}
                              </h3>
                              
                            </div>
                          </Link>
                          
                          {/* Sottocategorie */}
                          {category.subcategories && category.subcategories.length > 0 && (
                            <div className="ml-4 space-y-1">
                              {category.subcategories.map((subcat) => (
                                <Link
                                  key={subcat.id}
                                  href={`/category/${subcat.slug}`}
                                  className="block px-3 py-2 text-xs text-gray-600 hover:text-bred-600 hover:bg-bred-50 rounded transition-colors"
                                  onClick={() => setIsMegaMenuOpen(false)}
                                >
                                  • {decodeHtmlEntities(subcat.name)}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* Link per vedere tutte le categorie */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <Link
                        href="/categories"
                        className="flex items-center justify-center w-full p-2 text-bred-600 hover:text-bred-700 hover:bg-bred-50 rounded-lg transition-colors text-sm font-medium"
                        onClick={() => setIsMegaMenuOpen(false)}
                      >
                        Vedi tutte le categorie
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Link href="/offerte" className="text-white hover:text-white">
              Offerte
            </Link>
            <Link href="/chi-siamo" className="text-white hover:text-white">
              Chi Siamo
            </Link>
            {isAuthenticated ? (
              <div className="relative" ref={dropdownRef}>
                <button 
                  className="text-white hover:text-white flex items-center"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  {user?.firstName || user?.username || 'Account'}
                  <svg 
                    className={`w-4 h-4 ml-1 transition-transform ${isMenuOpen ? 'transform rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-40">
                    <Link 
                      href="/account" 
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Il mio account
                    </Link>
                    <Link 
                      href="/account?tab=orders" 
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      I miei ordini
                    </Link>
                    <button 
                      onClick={() => {
                        logout();
                        setIsMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="text-white hover:text-white">
                Accedi
              </Link>
            )}
            <div className="text-white">
              <LanguageSelector />
            </div>
            <Link href="/wishlist" className="relative text-white hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {wishlistItems.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-bred-500 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {wishlistItems.length}
                </span>
              )}
            </Link>
            <Link href="/cart" className="relative text-white hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {getCartCount() > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-bred-500 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {getCartCount()}
                </span>
              )}
            </Link>
          </nav>
          
          {/* Mobile Menu Overlay - visibile solo quando attivo */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40"></div>
          )}
          
          {/* Mobile Menu Panel */}
          <div 
            ref={mobileMenuRef}
            className={`fixed top-0 right-0 h-full w-4/5 max-w-sm bg-white transform transition-transform duration-300 ease-in-out z-50 shadow-xl overflow-y-auto ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-semibold text-gray-800">Menu</h2>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="Chiudi menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Mobile Search Bar */}
              <div className="mb-6">
                <SearchBar isMobile={true} onClose={() => setIsMobileMenuOpen(false)} />
              </div>
              
              {/* Mobile Navigation Links */}
              <nav className="space-y-6">
                <div>
                  <Link 
                    href="/categories" 
                    className="block text-gray-800 hover:text-bred-500 text-lg mb-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Categorie
                  </Link>
                  
                  {/* Mobile Categories List */}
                  {categories.length > 0 && (
                    <div className="space-y-2 mt-2 ml-2 max-h-80 overflow-y-auto">
                      {categories.map((category) => (
                        <div key={category.id} className="space-y-1">
                          {/* Categoria principale mobile */}
                          <Link
                            href={`/category/${category.slug}`}
                            className="flex items-center p-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            {category.image ? (
                              <div className="w-8 h-8 rounded overflow-hidden mr-2 flex-shrink-0">
                                <Image
                                  src={category.image.src}
                                  alt={category.name}
                                  width={32}
                                  height={32}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-8 h-8 bg-gradient-to-br from-bred-500 to-orange-500 rounded mr-2 flex-shrink-0"></div>
                            )}
                            <span className="text-gray-700 text-sm font-medium">
                              {decodeHtmlEntities(category.name).length > 15 ? `${decodeHtmlEntities(category.name).substring(0, 15)}...` : decodeHtmlEntities(category.name)}
                            </span>
                          </Link>
                          
                          {/* Sottocategorie mobile */}
                          {category.subcategories && category.subcategories.length > 0 && (
                            <div className="ml-6 space-y-1">
                              {category.subcategories.map((subcat) => (
                                <Link
                                  key={subcat.id}
                                  href={`/category/${subcat.slug}`}
                                  className="block px-2 py-1 text-xs text-gray-600 hover:text-bred-600 rounded"
                                  onClick={() => setIsMobileMenuOpen(false)}
                                >
                                  • {decodeHtmlEntities(subcat.name)}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Link 
                  href="/offerte" 
                  className="block text-gray-800 hover:text-bred-500 text-lg"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Offerte
                </Link>
                <Link 
                  href="/chi-siamo" 
                  className="block text-gray-800 hover:text-bred-500 text-lg"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Chi Siamo
                </Link>
                
                {/* Account links for mobile */}
                {isAuthenticated ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-800">{user?.firstName || user?.username || 'Account'}</h3>
                    <Link 
                      href="/account" 
                      className="block pl-2 text-gray-600 hover:text-bred-500"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Il mio account
                    </Link>
                    <Link 
                      href="/account?tab=orders" 
                      className="block pl-2 text-gray-600 hover:text-bred-500"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      I miei ordini
                    </Link>
                    <button 
                      onClick={() => {
                        logout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="block w-full text-left pl-2 text-gray-600 hover:text-bred-500"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <Link 
                    href="/login" 
                    className="block text-gray-800 hover:text-bred-500 text-lg"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Accedi
                  </Link>
                )}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
