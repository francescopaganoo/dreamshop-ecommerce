"use client";

import Link from 'next/link';
import Image from 'next/image';
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
              <div className="w-12 h-12 bg-gray-700 hover:bg-bred-500 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer group">
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                </svg>
              </div>
              <div className="w-12 h-12 bg-gray-700 hover:bg-bred-500 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer group">
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/>
                </svg>
              </div>
              <div className="w-12 h-12 bg-gray-700 hover:bg-bred-500 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer group">
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.346-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001.012.001z"/>
                </svg>
              </div>
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
                <div className="w-8 h-8 bg-bred-500/20 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-bred-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-sm">info@dreamshop.com</span>
              </li>
              <li className="flex items-center">
                <div className="w-8 h-8 bg-bred-500/20 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-bred-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <span className="text-sm">+39 123 456 7890</span>
              </li>
              <li className="flex items-start">
                <div className="w-8 h-8 bg-bred-500/20 rounded-full flex items-center justify-center mr-3 mt-1">
                  <svg className="w-4 h-4 text-bred-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-sm">Via Anime 123<br />Milano, Italia</span>
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
            &copy; {new Date().getFullYear()} <span className="text-bred-400 font-semibold">DreamShop</span>. 
            Tutti i diritti riservati. Fatto con ❤️ per gli appassionati di anime. <br></br>Coded by Plan Studios 
          </p>
        </div>
      </div>
    </footer>
  );
}