import { getMegaMenuCategories, getFilterOptionsPlugin } from '@/lib/api';
import CategoriesClient from '@/components/CategoriesClient';
import { FaTags, FaStar, FaEye } from 'react-icons/fa';

const DEFAULT_FILTER_OPTIONS = {
  brands: [],
  availability: [],
  shipping_times: [],
  price_range: { min: 0, max: 10000 },
  categories: [],
};

export default async function CategoriesPage() {
  // Fetch lato server con fallback se un'API fallisce
  const [categoriesResult, filterResult] = await Promise.allSettled([
    getMegaMenuCategories(),
    getFilterOptionsPlugin()
  ]);

  const categoriesData = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
  const filterOptions = filterResult.status === 'fulfilled' ? filterResult.value : DEFAULT_FILTER_OPTIONS;

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
                <FaTags /> ESPLORA
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

          <CategoriesClient
            categories={categoriesData}
            brands={filterOptions.brands}
            availabilityOptions={filterOptions.availability}
            shippingTimeOptions={filterOptions.shipping_times}
            priceRange={filterOptions.price_range}
          />

          {/* Stats Section */}
          {categoriesData.length > 0 && (
            <div className="mt-20 bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="group">
                  <div className="w-16 h-16 bg-bred-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-bred-500/20 transition-colors">
                    <FaTags className="text-bred-500 text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{categoriesData.length}</h3>
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
