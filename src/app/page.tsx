import { getFilteredProductsPlugin, getCategories, getProductsByBrandSlug, getBestSellingProducts, Product, Category } from "@/lib/api";
import LazyProductSection from "@/components/LazyProductSection";
import CategoryCarousel from "@/components/CategoryCarousel";
import Link from "next/link";
import Image from "next/image";
import {FaArrowRight } from "react-icons/fa";
//import { FaSearch, FaShoppingCart, FaArrowRight, FaEnvelope, FaRegClock } from "react-icons/fa";

// Configurazione per il rendering dinamico della pagina
//export const dynamic = 'force-dynamic';
export const revalidate = 300;


async function getProductCategories(): Promise<Category[]> {
  const allCategories = await getCategories();
  
  // Slug delle categorie da escludere dal carosello
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
  return allCategories.filter(category => !excludedSlugs.includes(category.slug));
}


async function getCardGameProducts(): Promise<Product[]> {
  // Ottieni i prodotti della categoria Card Game usando il plugin
  // Richiediamo più prodotti per avere maggiore disponibilità di prodotti in stock
  const response = await getFilteredProductsPlugin({
    category: 'card-game',
    page: 1,
    per_page: 20,
    orderby: 'date',
    order: 'desc',
    exclude_sold_out: true
  });
  return response.products.slice(0, 5);
}

async function getTsumeProducts(): Promise<Product[]> {
  // Ottieni i prodotti della categoria Tsume usando il plugin
  // Richiediamo più prodotti per avere maggiore disponibilità di prodotti in stock
  const response = await getFilteredProductsPlugin({
    category: 'tsume',
    page: 1,
    per_page: 20,
    orderby: 'date',
    order: 'desc',
    exclude_sold_out: true
  });
  return response.products.slice(0, 5);
}

async function getBanprestoProducts(): Promise<Product[]> {
  // Ottieni i prodotti del brand Banpresto
  // Richiediamo più prodotti per avere maggiore disponibilità di prodotti in stock
  const { products } = await getProductsByBrandSlug('banpresto', 1, 20);
  return products.filter(product => product.stock_status === 'instock').slice(0, 5);
}

async function getBestSellingProductsHome(): Promise<Product[]> {
  // Ottieni i 5 prodotti più venduti del mese usando il nuovo endpoint
  return await getBestSellingProducts(5);
}




export default async function Home() {
  // Carichiamo solo i dati essenziali per il rendering iniziale
  const [
    categories,
    cardGameProducts,
    tsumeProducts,
    banprestoProducts,
    popularProducts
  ] = await Promise.all([
    getProductCategories(),
    getCardGameProducts(),
    getTsumeProducts(),
    getBanprestoProducts(),
    getBestSellingProductsHome()
  ]);
  
  // Structured Data per Organization
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "DreamShop",
    "url": "https://dreamshop18.com",
    "logo": "https://dreamshop18.com/logo.png",
    "description": "Negozio online di action figure, statue, trading card e merchandising anime/manga. Prodotti ufficiali da Giappone e Italia.",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "IT"
    },
    "sameAs": [
      "https://www.facebook.com/dreamshopfigure",
      "https://www.instagram.com/dreamshop_figure/"
    ]
  };

  // Structured Data per WebSite (abilita search box Google)
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "DreamShop",
    "url": "https://dreamshop18.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://dreamshop18.com/products?search={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Structured Data JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />

      {/* Hero Section - Design Moderno */}
      <section className="relative text-white overflow-hidden -mt-px">
        <div className="relative w-full">
          {/* Desktop Hero Image */}
          <Image
            src="/images/hero.webp"
            alt="DreamShop Hero"
            width={1920}
            height={800}
            priority
            className="w-full h-auto object-contain hidden xl:block"
          />
          {/* Mobile/Tablet Hero Image */}
          <Image
            src="/images/hero-mobile-.webp"
            alt="DreamShop Hero Mobile/Tablet"
            width={768}
            height={1024}
            priority
            className="w-full h-auto md:max-h-[600px] md:object-cover object-contain object-center xl:hidden"
          />

          {/* Overlay gradient per desktop - sinistra → destra */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/10 to-transparent hidden md:block"></div>

          {/* Overlay gradient per mobile - più accentuato e esteso verso destra */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 via-black/10 to-transparent md:hidden"></div>

          {/* Testi sovrapposti */}
          <div className="absolute inset-0">
            <div className="container mx-auto px-6 h-full flex flex-col justify-end pb-16 md:justify-center md:pb-0 z-10">
              <div className="max-w-2xl transform transition-all duration-700 translate-y-0 hover:translate-y-[-10px]">
                {/*<span className="bg-bred-600 text-white px-4 py-1 rounded-full text-sm font-medium inline-block mb-6 animate-pulse">Collezione 2025</span>*/}
                <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">Benvenuti su <span className="text-bred-500">DreamShop</span></h1>
                <p className="text-xl md:text-2xl mb-8 max-w-xl md:max-w-xl text-gray-200 leading-tight md:leading-relaxed pr-14 md:pr-0">Scopri la nostra collezione esclusiva di statue, figure e trading card di anime e manga</p>
                <div className="flex flex-wrap gap-4">
                  <Link 
                    href="/category/black-week" 
                    className="group bg-bred-500 text-white hover:bg-bred-600 px-8 py-4 rounded-md font-medium inline-flex items-center transition-all duration-300 hover:shadow-lg hover:translate-y-[-2px]"
                  >
                    Black Week
                    <FaArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                 {/* <Link 
                    href="/offerte" 
                    className="group bg-transparent border-2 border-white text-white hover:bg-white/10 px-8 py-4 rounded-md font-medium inline-flex items-center transition-all duration-300"
                  >
                    Offerte Speciali
                  </Link>*/}
                </div>
              </div>
            </div>
          </div>

          {/* Sfumatura in basso, aderente al bordo dell'immagine */}
          <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent"></div>
        </div>
      </section>

      {/* Features Section */}
     {/* <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-12 h-12 bg-bred-500/10 rounded-full flex items-center justify-center mb-4">
                <FaShoppingCart className="text-bred-500 text-xl" />
              </div>
              <h3 className="font-bold text-xl mb-3">Pagamento Rateale</h3>
              <p className="text-gray-600">Possibilità di acquistare con acconto del 40% e rate mensili</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-12 h-12 bg-bred-500/10 rounded-full flex items-center justify-center mb-4">
                <FaRegClock className="text-bred-500 text-xl" />
              </div>
              <h3 className="font-bold text-xl mb-3">Consegna Rapida</h3>
              <p className="text-gray-600">Spedizione veloce e tracciabile su tutti i prodotti</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-12 h-12 bg-bred-500/10 rounded-full flex items-center justify-center mb-4">
                <FaSearch className="text-bred-500 text-xl" />
              </div>
              <h3 className="font-bold text-xl mb-3">Prodotti Esclusivi</h3>
              <p className="text-gray-600">Articoli selezionati e importati direttamente dal Giappone</p>
            </div>
          </div>
        </div>
      </section>*/}
      
      {/* Categories Carousel - Design Moderno */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-center mb-10">
            <div>
              <span className="text-bred-500 font-medium">ESPLORA</span>
              <h2 className="text-3xl md:text-4xl font-bangers text-gray-900">Le Nostre Categorie</h2>
            </div>
            <Link 
              href="/categories" 
              className="hidden md:flex items-center text-bred-500 hover:text-bred-700 font-medium transition-colors"
            >
              Vedi tutte <FaArrowRight className="ml-2" />
            </Link>
          </div>
          <div className="-mx-4 overflow-hidden">
            <div className="px-4">
              <CategoryCarousel categories={categories} />
            </div>
          </div>
          <div className="mt-8 text-center md:hidden">
            <Link 
              href="/categories" 
              className="inline-flex items-center text-bred-500 hover:text-bred-700 font-medium transition-colors"
            >
              Vedi tutte le categorie <FaArrowRight className="ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* New Arrivals Banner */}
      <section className="py-8 md:py-16 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="relative overflow-hidden rounded-2xl bg-gray-900 min-h-[200px] md:min-h-[250px]">
            <div className="absolute inset-0 bg-cover bg-right opacity-80" style={{ backgroundImage: "url('/images/nuovi-arrivi.webp')" }}></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/10 to-transparent"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-6 md:p-16 h-full">
              <div className="text-center md:text-left w-full md:w-auto mb-6 md:mb-0">
                <span className="bg-white/20 text-white px-4 py-1 rounded-full text-sm font-medium inline-block mb-4">APPENA ARRIVATI</span>
                <h2 className="text-2xl md:text-3xl lg:text-5xl font-bold text-white mb-4 leading-tight">Nuovi Arrivi</h2>
                <p className="text-white/80 max-w-md mx-auto md:mx-0 text-sm md:text-base">Scopri le ultime novità aggiunte al nostro catalogo, direttamente dal Giappone</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nuovi Arrivi Products Section - Lazy Loading */}
      <LazyProductSection
        isLatestProducts={true}
        categoryLink="/products?orderby=date&order=desc"
        buttonText="Visualizza Altri Nuovi Arrivi"
        bgGradient="bg-gray-50"
        decorativeColors={{
          primary: "bg-bred-500/5",
          secondary: "bg-bred-500/5"
        }}
      />

      {/* Ichiban Kuji Banner */}
      <section className="py-8 md:py-16 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="relative overflow-hidden rounded-2xl bg-gray-900 min-h-[200px] md:min-h-[250px]">
            <div className="absolute inset-0 bg-cover bg-right opacity-80" style={{ backgroundImage: "url('/images/ichiban-kuji.webp')" }}></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/10 to-transparent"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-6 md:p-16 h-full">
              <div className="text-center md:text-left w-full md:w-auto mb-6 md:mb-0">
                <span className="bg-white/20 text-white px-4 py-1 rounded-full text-sm font-medium inline-block mb-4">APPENA ARRIVATI</span>
                <h2 className="text-2xl md:text-3xl lg:text-5xl font-bold text-white mb-4 leading-tight">Ichiban Kuji</h2>
                <p className="text-white/80 max-w-md mx-auto md:mx-0 text-sm md:text-base">Scopri i premi più ambiti delle lotterie Ichiban Kuji</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ichiban Kuji Products Section - Lazy Loading */}
      <LazyProductSection
        categorySlug="ichiban-kuji"
        categoryLink="/category/ichiban-kuji"
        buttonText="Visualizza altre Ichiban Kuji"
        bgGradient="bg-gray-50"
        decorativeColors={{
          primary: "bg-purple-500/5",
          secondary: "bg-pink-500/5"
        }}
      />

      {/* Resine Banner */}
      <section className="py-8 md:py-16 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="relative overflow-hidden rounded-2xl bg-gray-900 min-h-[200px] md:min-h-[250px]">
            <div className="absolute inset-0 bg-cover bg-right opacity-80" style={{ backgroundImage: "url('/images/resine.webp')" }}></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/10 to-transparent"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-6 md:p-16 h-full">
              <div className="text-center md:text-left w-full md:w-auto mb-6 md:mb-0">
                <span className="bg-white/20 text-white px-4 py-1 rounded-full text-sm font-medium inline-block mb-4">STATUE PREMIUM</span>
                <h2 className="text-2xl md:text-3xl lg:text-5xl font-bold text-white mb-4 leading-tight">Resine</h2>
                <p className="text-white/80 max-w-md mx-auto md:mx-0 text-sm md:text-base">Le statue in resina più dettagliate e raffinate del mercato</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resine Products Section - Lazy Loading */}
      <LazyProductSection
        categorySlug="resine"
        categoryLink="/category/resine"
        buttonText="Vedi Tutte le Statue in Resina"
        bgGradient="bg-gray-50"
        decorativeColors={{
          primary: "bg-green-500/5",
          secondary: "bg-emerald-500/5"
        }}
      />



      {/* Pokemon Banner */}
      <section className="py-8 md:py-16 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="relative overflow-hidden rounded-2xl bg-gray-900 min-h-[200px] md:min-h-[250px]">
            <div className="absolute inset-0 bg-cover bg-right opacity-80" style={{ backgroundImage: "url('/images/pokemon.webp')" }}></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/10 to-transparent"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-6 md:p-16 h-full">
              <div className="text-center md:text-left w-full md:w-auto mb-6 md:mb-0">
                <span className="bg-white/20 text-white px-4 py-1 rounded-full text-sm font-medium inline-block mb-4">APPENA ARRIVATI</span>
                <h2 className="text-2xl md:text-3xl lg:text-5xl font-bold text-white mb-4 leading-tight">Pokemon</h2>
                <p className="text-white/80 max-w-md mx-auto md:mx-0 text-sm md:text-base">Tutto per i veri allenatori di Pokémon</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pokemon Products Section - Lazy Loading */}
      <LazyProductSection
        categorySlug="pokemon"
        categoryLink="/category/pokemon"
        buttonText="Vedi Tutti i Prodotti Pokémon"
        bgGradient="bg-gray-50"
        decorativeColors={{
          primary: "bg-yellow-500/5",
          secondary: "bg-red-500/5"
        }}
      />

      {/* Riviste Banner */}
      <section className="py-8 md:py-16 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="relative overflow-hidden rounded-2xl bg-gray-900 min-h-[200px] md:min-h-[250px]">
            <div className="absolute inset-0 bg-cover bg-right opacity-80" style={{ backgroundImage: "url('/images/riviste.webp')" }}></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/10 to-transparent"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-6 md:p-16 h-full">
              <div className="text-center md:text-left w-full md:w-auto mb-6 md:mb-0">
                <span className="bg-white/20 text-white px-4 py-1 rounded-full text-sm font-medium inline-block mb-4">RIVISTE & GADGET</span>
                <h2 className="text-2xl md:text-3xl lg:text-5xl font-bold text-white mb-4 leading-tight">Shōnen Jump</h2>
                <p className="text-white/80 max-w-md mx-auto md:mx-0 text-sm md:text-base">Il meglio dell&apos;editoria giapponese e gadget esclusivi</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Riviste Products Section - Lazy Loading */}
      <LazyProductSection
        categorySlug="editoria"
        categoryLink="/category/editoria"
        buttonText="Vedi Tutte le Riviste & Gadget"
        bgGradient="bg-gray-50"
        decorativeColors={{
          primary: "bg-blue-500/5",
          secondary: "bg-indigo-500/5"
        }}
      />

      {/* S.H.Figuarts Banner */}
      <section className="py-8 md:py-16 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="relative overflow-hidden rounded-2xl bg-gray-900 min-h-[200px] md:min-h-[250px]">
            <div className="absolute inset-0 bg-cover bg-right opacity-80" style={{ backgroundImage: "url('/images/sh-figuarts.webp')" }}></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/10 to-transparent"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-6 md:p-16 h-full">
              <div className="text-center md:text-left w-full md:w-auto mb-6 md:mb-0">
                <span className="bg-white/20 text-white px-4 py-1 rounded-full text-sm font-medium inline-block mb-4">ACTION FIGURES PREMIUM</span>
                <h2 className="text-2xl md:text-3xl lg:text-5xl font-bold text-white mb-4 leading-tight">S.H. Figuarts</h2>
                <p className="text-white/80 max-w-md mx-auto md:mx-0 text-sm md:text-base">La massima espressione dell&apos;articolazione e del dettaglio</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* S.H.Figuarts Products Section - Lazy Loading */}
      <LazyProductSection
        categorySlug="s-h-figuarts"
        categoryLink="/category/s-h-figuarts"
        buttonText="Vedi Tutte le S.H.Figuarts"
        bgGradient="bg-gray-50"
        decorativeColors={{
          primary: "bg-red-500/5",
          secondary: "bg-orange-500/5"
        }}
      />

      {/* Sale Banner */}
      <section className="py-8 md:py-16 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="relative overflow-hidden rounded-2xl bg-gray-900 min-h-[200px] md:min-h-[250px]">
            <div className="absolute inset-0 bg-cover bg-right opacity-80" style={{ backgroundImage: "url('/images/offerte.webp')" }}></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/10 to-transparent"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-6 md:p-16 h-full">
              <div className="text-center md:text-left w-full md:w-auto mb-6 md:mb-0">
                <span className="bg-white/20 text-white px-4 py-1 rounded-full text-sm font-medium inline-block mb-4">SUPER SCONTI</span>
                <h2 className="text-2xl md:text-3xl lg:text-5xl font-bold text-white mb-4 leading-tight">Offerte</h2>
                <p className="text-white/80 max-w-md mx-auto md:mx-0 text-sm md:text-base">Approfitta delle nostre offerte speciali prima che scadano!</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sale Products Section - Lazy Loading */}
      <LazyProductSection
        isSaleProducts={true}
        categoryLink="/offerte"
        buttonText="Vedi Tutte le Offerte"
        bgGradient="bg-gray-50"
        decorativeColors={{
          primary: "bg-red-500/5",
          secondary: "bg-orange-500/5"
        }}
      />

      {/* 4 Columns Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Esplora per Categoria</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Scopri i nostri prodotti organizzati per categoria e brand</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Card Game Column */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-sm">CG</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">Card Game</h3>
                  <p className="text-gray-600 text-sm">Trading cards e giochi</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {cardGameProducts.slice(0, 5).map((product) => (
                  <Link
                    key={product.id}
                    href={`/prodotto/${product.slug}`}
                    className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-all duration-300 group"
                  >
                    <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                      {product.images && product.images.length > 0 && product.images[0].src && typeof product.images[0].src === 'string' ? (
                        <Image
                          src={product.images[0].src.replace(/-\d+x\d+/, '')}
                          alt={product.images[0].alt || product.name}
                          width={48}
                          height={48}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-300"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-800 truncate group-hover:text-bred-600 transition-colors">
                        {product.name}
                      </h4>
                      <p className="text-xs text-gray-600">€{product.price}</p>
                    </div>
                  </Link>
                ))}
              </div>

              <Link
                href="/category/card-game"
                className="block w-full text-center bg-bred-500 text-white py-2 rounded-lg font-medium hover:bg-bred-600 transition-colors"
              >
                Vedi Tutto
              </Link>
            </div>

            {/* Tsume Column */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-sm">TS</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">Tsume</h3>
                  <p className="text-gray-600 text-sm">Statue premium</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {tsumeProducts.slice(0, 5).map((product) => (
                  <Link
                    key={product.id}
                    href={`/prodotto/${product.slug}`}
                    className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-all duration-300 group"
                  >
                    <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                      {product.images && product.images.length > 0 && product.images[0].src && typeof product.images[0].src === 'string' ? (
                        <Image
                          src={product.images[0].src.replace(/-\d+x\d+/, '')}
                          alt={product.images[0].alt || product.name}
                          width={48}
                          height={48}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-300"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-800 truncate group-hover:text-bred-600 transition-colors">
                        {product.name}
                      </h4>
                      <p className="text-xs text-gray-600">€{product.price}</p>
                    </div>
                  </Link>
                ))}
              </div>

              <Link
                href="/category/tsume"
                className="block w-full text-center bg-bred-500 text-white py-2 rounded-lg font-medium hover:bg-bred-600 transition-colors"
              >
                Vedi Tutto
              </Link>
            </div>

            {/* Banpresto Column */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-sm">BP</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">Banpresto</h3>
                  <p className="text-gray-600 text-sm">Figure di qualità</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {banprestoProducts.slice(0, 5).map((product) => (
                  <Link
                    key={product.id}
                    href={`/prodotto/${product.slug}`}
                    className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-all duration-300 group"
                  >
                    <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                      {product.images && product.images.length > 0 && product.images[0].src && typeof product.images[0].src === 'string' ? (
                        <Image
                          src={product.images[0].src.replace(/-\d+x\d+/, '')}
                          alt={product.images[0].alt || product.name}
                          width={48}
                          height={48}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-300"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-800 truncate group-hover:text-bred-600 transition-colors">
                        {product.name}
                      </h4>
                      <p className="text-xs text-gray-600">€{product.price}</p>
                    </div>
                  </Link>
                ))}
              </div>

              <Link
                href="/products?brand=banpresto"
                className="block w-full text-center bg-bred-500 text-white py-2 rounded-lg font-medium hover:bg-bred-600 transition-colors"
              >
                Vedi Tutto
              </Link>
            </div>

            {/* Most Popular Products Column */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-sm">★</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">Più Venduti</h3>
                  <p className="text-gray-600 text-sm">I prodotti più popolari</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {popularProducts.slice(0, 5).map((product) => (
                  <Link
                    key={product.id}
                    href={`/prodotto/${product.slug}`}
                    className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-all duration-300 group"
                  >
                    <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                      {product.images && product.images.length > 0 && product.images[0].src && typeof product.images[0].src === 'string' ? (
                        <Image
                          src={product.images[0].src.replace(/-\d+x\d+/, '')}
                          alt={product.images[0].alt || product.name}
                          width={48}
                          height={48}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-300"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-800 truncate group-hover:text-bred-600 transition-colors">
                        {product.name}
                      </h4>
                      <p className="text-xs text-gray-600">€{product.price}</p>
                    </div>
                  </Link>
                ))}
              </div>

              <Link
                href="/products?orderby=popularity"
                className="block w-full text-center bg-bred-500 text-white py-2 rounded-lg font-medium hover:bg-bred-600 transition-colors"
              >
                Vedi Tutto
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Section - Design Moderno */}
     {/* <section className="py-20 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="mb-8 md:mb-0 md:max-w-md text-center md:text-left">
                <span className="text-bred-500 font-medium">NEWSLETTER</span>
                <h2 className="text-3xl font-bold mb-4 text-gray-900">Resta Aggiornato</h2>
                <p className="text-gray-600">Iscriviti per ricevere aggiornamenti su nuovi prodotti, offerte speciali e contenuti esclusivi</p>
              </div>
              
              <form className="flex flex-col sm:flex-row w-full md:w-auto gap-3 max-w-md">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaEnvelope className="text-gray-400" />
                  </div>
                  <input 
                    type="email" 
                    placeholder="Il tuo indirizzo email" 
                    className="w-full pl-10 pr-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-bred-500 focus:border-bred-500"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  className="bg-bred-500 text-white hover:bg-bred-600 px-6 py-3 rounded-md font-medium transition-colors shadow-sm hover:shadow-md"
                >
                  Iscriviti
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>*/}
      
      {/* Instagram-style Gallery 
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900">#DreamShopCommunity</h2>
            <p className="text-gray-600 mt-3">Condividi le tue foto con l'hashtag #DreamShopCommunity</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="relative aspect-square overflow-hidden rounded-lg group">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" 
                  style={{ backgroundImage: `url('/images/gallery-${num}.jpg')` }}>
                </div>
                <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-white font-medium">@user{num}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>*/}

    </div>
  );
}