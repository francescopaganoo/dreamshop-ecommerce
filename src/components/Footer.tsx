"use client";

import Link from 'next/link';
import Image from 'next/image';
import { FaEnvelope, FaMapMarkerAlt, FaFacebook, FaInstagram, FaTelegram, FaWhatsapp, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { FaTiktok } from 'react-icons/fa6';
import { useState, useEffect } from 'react';
import { getMegaMenuCategories, ExtendedCategory } from '../lib/api';

export default function Footer() {
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const [openDropdowns, setOpenDropdowns] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetchCategories() {
      try {
        const categoriesData = await getMegaMenuCategories();
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error fetching categories for footer:', error);
      }
    }
    
    fetchCategories();
  }, []);

  const toggleDropdown = (categoryId: number) => {
    setOpenDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

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
      .replace(/&#8221;/g, '"')
      .replace(/&hellip;/g, '...');
  };
  return (
    <footer className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden">
      {/* Background decorativo */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-32 h-32 bg-bred-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-blue-500 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-purple-500 rounded-full blur-2xl"></div>
      </div>

      <div className="relative container mx-auto px-6 py-16">
        {/* Sezione principale */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Logo e brand - colonna sinistra */}
          <div className="lg:col-span-4">
            <div className="mb-6">
            <Link href="/" className="text-2xl font-bold text-gray-800">
              <Image src="/images/logo.webp" alt="WooStore Logo" width={200} height={50} style={{ width: 'auto', height: 'auto' }} priority />
            </Link>
            </div>
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              Il tuo negozio di riferimento per figure, statue e trading card di anime e manga. 
              Qualità premium, passione autentica.
            </p>
            
            {/* Social media icons */}
            <div className="flex space-x-4">
              <a 
                href="https://www.facebook.com/dreamshopfigure" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-12 h-12 bg-gray-700 hover:bg-blue-600 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer group"
              >
                <FaFacebook className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </a>
              <a 
                href="https://www.instagram.com/dreamshop_figure/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-12 h-12 bg-gray-700 hover:bg-gradient-to-br hover:from-purple-600 hover:via-pink-600 hover:to-orange-400 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer group"
              >
                <FaInstagram className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </a>
              <a 
                href="https://www.tiktok.com/@dreamshop_figure" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-12 h-12 bg-gray-700 hover:bg-black rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer group"
              >
                <FaTiktok className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </a>
              <a 
                href="https://t.me/dreamshop2018" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-12 h-12 bg-gray-700 hover:bg-blue-500 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer group"
              >
                <FaTelegram className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </a>
            </div>
          </div>

          {/* Collegamenti rapidi */}
          <div className="lg:col-span-3">
            <h3 className="text-xl font-bold mb-6 text-white">Naviga</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-gray-300 hover:text-bred-400 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-bred-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Home
                </Link>
              </li>
              <li>
                <Link href="/categories" className="text-gray-300 hover:text-bred-400 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-bred-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Categorie
                </Link>
              </li>
              <li>
                <Link href="/cart" className="text-gray-300 hover:text-bred-400 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-bred-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Carrello
                </Link>
              </li>
              <li>
                <Link href="/wishlist" className="text-gray-300 hover:text-bred-400 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-bred-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Wishlist
                </Link>
              </li>
              <li>
                <Link href="/termini-vendita" className="text-gray-300 hover:text-bred-400 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-bred-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Termini di vendita
                </Link>
              </li>
              <li>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('openCookieSettings'))}
                  className="text-gray-300 hover:text-bred-400 transition-colors duration-300 flex items-center group"
                >
                  <span className="w-2 h-2 bg-bred-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Gestisci consensi
                </button>
              </li>
              <li>
                <Link href="/prodotto/gift-card" className="text-bred-300 hover:text-bred-100 transition-colors duration-300 flex items-center group font-semibold text-lg">
                  <span className="w-3 h-3 bg-yellow-400 rounded-full mr-3 group-hover:scale-125 transition-all duration-300"></span>
                  🎁 Gift Card
                </Link>
              </li>
              <li>
                <a href="https://dreamshop18distribuzione.com/" target="_blank" rel="noopener noreferrer" className="text-bred-300 hover:text-bred-100 transition-colors duration-300 flex items-center group font-semibold text-lg">
                  <span className="w-3 h-3 bg-green-400 rounded-full mr-3 group-hover:scale-125 transition-all duration-300"></span>
                  💼 Sei un rivenditore?
                </a>
              </li>
            </ul>
          </div>

          {/* Categorie */}
          <div className="lg:col-span-3">
            <h3 className="text-xl font-bold mb-6 text-white">Categorie</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {categories.map((category) => (
                <div key={category.id}>
                  <div className="flex items-center justify-between">
                    <Link 
                      href={`/category/${category.slug}`} 
                      className="text-gray-300 hover:text-bred-400 transition-colors duration-300 flex items-center group font-medium flex-1"
                    >
                      <span className="w-2 h-2 bg-purple-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                      {decodeHtmlEntities(category.name)}
                    </Link>
                    {category.subcategories && category.subcategories.length > 0 && (
                      <button
                        onClick={() => toggleDropdown(category.id)}
                        className="ml-2 p-1 text-gray-400 hover:text-bred-400 transition-colors duration-300"
                        aria-label={`Toggle ${category.name} subcategories`}
                      >
                        {openDropdowns.has(category.id) ? 
                          <FaChevronUp className="w-3 h-3" /> : 
                          <FaChevronDown className="w-3 h-3" />
                        }
                      </button>
                    )}
                  </div>
                  {category.subcategories && category.subcategories.length > 0 && openDropdowns.has(category.id) && (
                    <ul className="ml-6 mt-2 space-y-1 overflow-hidden transition-all duration-300">
                      {category.subcategories.map((subcat) => (
                        <li key={subcat.id}>
                          <Link 
                            href={`/category/${subcat.slug}`} 
                            className="text-gray-400 hover:text-bred-300 transition-colors duration-300 flex items-center group text-sm"
                          >
                            <span className="w-1 h-1 bg-bred-500 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            {decodeHtmlEntities(subcat.name)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Contatti */}
          <div className="lg:col-span-2">
            <h3 className="text-xl font-bold mb-6 text-white">Contatti</h3>
            <ul className="space-y-4 text-gray-300">
              <li className="flex items-center">
                <div className="flex items-center justify-center mr-3">
                  <FaEnvelope className="w-4 h-4 text-bred-400" />
                </div>
                <span className="text-sm">dreamshopfigure@gmail.com</span>
              </li>
              <li className="flex items-center">
                <div className="flex items-center justify-center mr-3">
                  <FaWhatsapp className="w-4 h-4 text-green-400" />
                </div>
                <a 
                  href="https://wa.me/393515029645" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-gray-300 hover:text-green-400 transition-colors duration-300"
                >
                  Contattaci su WhatsApp
                </a>
              </li>
              <li className="flex items-start">
                <div className="flex items-center justify-center mr-3 mt-1">
                  <FaMapMarkerAlt className="w-4 h-4 text-bred-400" />
                </div>
                <span className="text-sm">Via Vincenzo Florio 13/L Misterbianco 95045 CT, Italia</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter 
        <div className="mt-16 p-8 bg-gradient-to-r from-bred-500/10 to-purple-500/10 rounded-2xl border border-gray-700/50">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold mb-2">Resta Sempre Aggiornato!</h3>
            <p className="text-gray-300">Ricevi in anteprima le ultime novità e offerte esclusive</p>
          </div>
          <div className="max-w-md mx-auto flex gap-2">
            <input 
              type="email" 
              placeholder="La tua email..." 
              className="flex-grow px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-bred-500 focus:border-transparent transition-all"
            />
            <button 
              className="bg-gradient-to-r from-bred-500 to-bred-500 hover:from-bred-600 hover:to-bred-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-bred-500/25"
            >
              Iscriviti
            </button>
          </div>
        </div>
*/}
        {/* Copyright */}
        <div className="border-t border-gray-700/50 mt-12 pt-8 text-center">
          <p className="text-gray-400">
            &copy; {new Date().getFullYear()} <span className="text-bred-400 font-semibold">DREAM SHOP S.R.L. | P.IVA 05812850872</span>. 
            Tutti i diritti riservati. Fatto con ❤️ per gli appassionati di anime. <br></br><Link
            href="https://planstudios.it/" target="blank"
            className=""
          >
            Coded by Plan Studios
          </Link>
          </p>
          <div className="mt-4 flex justify-center">
            <Image
              src="/images/payment-icon.webp"
              alt="Payment Methods"
              width={450}
              height={50}
              style={{ width: 'auto', height: 'auto' }}
              className="opacity-70 hover:opacity-100 transition-opacity"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}