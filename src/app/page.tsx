import { getProducts, getCategories, Product, Category } from "../lib/api";
import ProductList from "../components/ProductList";
import CategoryList from "../components/CategoryList";
import CategoryCarousel from "../components/CategoryCarousel";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Link from "next/link";
import Image from 'next/image';

// Configurazione per il rendering dinamico della pagina
//export const dynamic = 'force-dynamic';
export const revalidate = 300;

async function getFeaturedProducts(): Promise<Product[]> {
  // In a real app, you might have a featured flag or category
  // For now, we'll just get the first 8 products
  return getProducts(1, 8);
}

async function getProductCategories(): Promise<Category[]> {
  return getCategories();
}

export default async function Home() {
  const products: Product[] = await getFeaturedProducts();
  const categories: Category[] = await getProductCategories();
  
  // Take only the first 6 categories for the homepage
  const featuredCategories: Category[] = categories.slice(0, 6);

  return (
    <div className="min-h-screen flex flex-col">
      
      
      {/* Hero Section */}
      <section className="relative h-[500px] text-white">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/images/hero-section.webp')" }}>
          <div className="absolute inset-0 bg-black opacity-40"></div>
        </div>
        <div className="relative container mx-auto px-4 h-full flex flex-col justify-center z-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Benvenuti su DreamShop</h1>
          <p className="text-xl md:text-2xl mb-8 max-w-2xl">Scopri la nostra collezione esclusiva di statue, figure e trading card di anime e manga</p>
          <Link 
            href="/categories" 
            className="bg-bred-500 text-white hover:bg-bred-700 px-6 py-3 rounded-md font-medium inline-block w-max transition-colors duration-300"
          >
            Scopri il Catalogo
          </Link>
        </div>
      </section>

            <section className="relative h-[400px] bg-gray-50 flex items-center justify-center p-4">
              <div className="w-full">
                <CategoryCarousel categories={categories} />
              </div>
            </section>

            {/* New Arrivals Divider */}
            <section className="relative h-[300px] bg-gray-50 inset-0 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/nuovi-arrivi.webp')" }}>
            </section>

      {/* Featured Products */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">          
          <ProductList products={products} />
        </div>
      </section>

      {/* New Arrivals Divider */}

        <section className="relative h-[300px] bg-gray-50 inset-0 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/nuovi-arrivi.webp')" }}>
        </section>

      {/* Categories Section */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center text-gray-900">Sfoglia per Categoria</h2>
          
          <CategoryCarousel categories={categories} />
          
          <div className="text-center mt-8">
            <Link 
              href="/categories" 
              className="inline-block bg-bred-500 text-white px-6 py-3 rounded-md font-medium hover:bg-bred-700 transition-colors"
            >
              Tutte le Categorie
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-12 bg-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4 text-gray-900">Resta Aggiornato</h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">Iscriviti alla nostra newsletter per ricevere aggiornamenti su nuovi prodotti, offerte speciali e molto altro.</p>
          
          <form className="max-w-md mx-auto flex">
            <input 
              type="email" 
              placeholder="Il tuo indirizzo email" 
              className="flex-grow px-4 py-3 rounded-l-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-bred-500"
              required
            />
            <button 
              type="submit" 
              className="bg-bred-500 text-white px-6 py-3 rounded-r-md font-medium hover:bg-bred-700 transition-colors"
            >
              Iscriviti
            </button>
          </form>
        </div>
      </section>

    </div>
  );
}
