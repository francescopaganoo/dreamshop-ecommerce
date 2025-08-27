"use client";

import Link from 'next/link';
import Image from 'next/image';
import { FaEnvelope, FaPhone, FaMapMarkerAlt, FaFacebook, FaInstagram, FaTelegram } from 'react-icons/fa';
import { FaTiktok } from 'react-icons/fa6';
export default function Footer() {
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
              <Image src="/images/logo.webp" alt="WooStore Logo" width={200} height={50} priority />
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
            </ul>
          </div>

          {/* Categorie popolari */}
          <div className="lg:col-span-3">
            <h3 className="text-xl font-bold mb-6 text-white">Categorie</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/categories/figure" className="text-gray-300 hover:text-bred-400 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Figure
                </Link>
              </li>
              <li>
                <Link href="/categories/statue" className="text-gray-300 hover:text-bred-400 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Statue
                </Link>
              </li>
              <li>
                <Link href="/categories/trading-cards" className="text-gray-300 hover:text-bred-400 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Trading Cards
                </Link>
              </li>
              <li>
                <Link href="/categories/manga" className="text-gray-300 hover:text-bred-400 transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Manga
                </Link>
              </li>
            </ul>
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
                <div className=" flex items-center justify-center mr-3">
                  <FaPhone className="w-4 h-4 text-bred-400" />
                </div>
                <span className="text-sm">+39 351 5029645</span>
              </li>
              <li className="flex items-start">
                <div className=" flex items-center justify-center mr-3 mt-1">
                  <FaMapMarkerAlt className="w-4 h-4 text-bred-400" />
                </div>
                <span className="text-sm">Via Vincenzo Florio 13/L Misterbianco 95045 CT, Italia</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div className="mt-16 p-8 bg-gradient-to-r from-bred-500/10 to-purple-500/10 rounded-2xl border border-gray-700/50">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold mb-2">Resta Sempre Aggiornato! 🚀</h3>
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
        </div>
      </div>
    </footer>
  );
}