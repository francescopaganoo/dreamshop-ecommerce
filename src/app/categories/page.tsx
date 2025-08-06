import { getCategories, Category } from '../../lib/api';
import Image from 'next/image';
import Link from 'next/link';
import { Metadata } from 'next';
import { FaArrowRight, FaTags, FaEye, FaStar } from 'react-icons/fa';

export const metadata: Metadata = {
  title: 'Tutte le Categorie - DreamShop',
  description: 'Esplora tutte le categorie di prodotti nel nostro negozio di anime e manga',
};

// Funzione per decodificare le entità HTML lato server
function decodeHtmlEntitiesServer(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export default async function CategoriesPage() {
  const allCategories: Category[] = await getCategories();
  
  // Slug delle categorie da escludere
  const excludedSlugs = [
    'attack-on-titan',
    'black-week', 
    'dragon-ball-cg',
    'one-piece-cg',
    'yu-gi-oh',
    'cina',
    'cina-rs',
    'crazy-month',
    'editoria',
    'gift-card',
    'italia',
    'no-categoria',
    'nuovi-arrivi',
    'jimei-palace',
    'tsume',
    'senza-categoria'
  ];
  
  // Filtra le categorie escludendo quelle con slug nella lista
  const categories = allCategories.filter(category => !excludedSlugs.includes(category.slug));
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
      
      <main className="flex-grow py-8 md:py-16">
        <div className="container mx-auto px-4 md:px-6">
          {/* Enhanced Page Header */}
          <div className="relative mb-16 text-center">
            {/* Background decorative elements */}
            <div className="absolute -top-8 -left-8 w-16 h-16 bg-bred-500/10 rounded-full hidden lg:block animate-pulse"></div>
            <div className="absolute -top-4 -right-12 w-24 h-24 bg-orange-500/10 rounded-full hidden lg:block animate-pulse delay-300"></div>
            
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 bg-bred-500/10 text-bred-600 px-4 py-2 rounded-full text-sm font-medium mb-4">
                <FaTags className="animate-spin-slow" /> ESPLORA
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bangers text-gray-900 mb-6 leading-tight">
                Tutte le <span className="text-bred-500">Categorie</span>
              </h1>
              <p className="text-gray-600 text-lg max-w-3xl mx-auto mb-8 leading-relaxed">
                Scopri il nostro universo di prodotti organizzati per categoria. 
                Dalle statue più dettagliate alle carte collezionabili più rare.
              </p>
              
            </div>
          </div>
          
          {/* Enhanced Categories Grid */}
          {categories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
              {categories.map((category: Category, index: number) => (
                <Link 
                  key={category.id} 
                  href={`/category/${category.slug}`}
                  className="group relative h-80 bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-gray-100"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Category Image */}
                  <div className="relative h-48 overflow-hidden">
                    {category.image ? (
                      <Image
                        src={category.image.src}
                        alt={decodeHtmlEntitiesServer(category.name)}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        style={{ objectFit: 'cover' }}
                        className="group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-bred-500 via-orange-500 to-red-500"></div>
                    )}
                    
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    {/* Hover icon */}
                    <div className="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                      <FaEye className="text-white" />
                    </div>
                  </div>
                  
                  {/* Category Info */}
                  <div className="p-6 flex flex-col justify-between h-32">
                    <div>
                      <h2 className="text-l font-bold text-gray-900 mb-2 group-hover:text-bred-600 transition-colors duration-300">
                        {decodeHtmlEntitiesServer(category.name)}
                      </h2>
                    </div>
                    
                    {/* Action Button */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-bred-600 group-hover:text-bred-700 transition-colors">
                        Esplora Categoria
                      </span>
                      <div className="w-8 h-8 bg-bred-500 rounded-full flex items-center justify-center group-hover:bg-bred-600 transition-all duration-300 transform group-hover:scale-110">
                        <FaArrowRight className="text-white text-sm group-hover:translate-x-0.5 transition-transform duration-300" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Decorative elements */}
                  <div className="absolute -bottom-2 -right-2 w-20 h-20 bg-bred-500/5 rounded-full blur-xl group-hover:bg-bred-500/10 transition-colors duration-500"></div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="max-w-md mx-auto">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FaTags className="text-gray-400 text-3xl" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessuna Categoria Trovata</h3>
                <p className="text-gray-500 mb-6">Al momento non ci sono categorie disponibili.</p>
                <Link 
                  href="/"
                  className="inline-flex items-center gap-2 bg-bred-500 text-white hover:bg-bred-600 px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  <FaArrowRight className="rotate-180" /> Torna alla Home
                </Link>
              </div>
            </div>
          )}
          
          {/* Stats Section */}
          {categories.length > 0 && (
            <div className="mt-20 bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="group">
                  <div className="w-16 h-16 bg-bred-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-bred-500/20 transition-colors">
                    <FaTags className="text-bred-500 text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{categories.length}</h3>
                  <p className="text-gray-600">Categorie Disponibili</p>
                </div>
                
                <div className="group">
                  <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-orange-500/20 transition-colors">
                    <FaStar className="text-orange-500 text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Premium</h3>
                  <p className="text-gray-600">Qualità Prodotti</p>
                </div>
                
                <div className="group">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-500/20 transition-colors">
                    <FaEye className="text-green-500 text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">100%</h3>
                  <p className="text-gray-600">Qualità Garantita</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      
    </div>
  );
}
