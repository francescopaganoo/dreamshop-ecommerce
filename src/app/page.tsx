import { getProducts, getCategories, Product, Category } from "../lib/api";
import ProductList from "../components/ProductList";
import CategoryList from "../components/CategoryList";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Link from "next/link";

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
      <Header />
      
      {/* Hero Section */}
      <section className="relative h-96 bg-gray-900 text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-purple-900 opacity-80"></div>
        <div className="relative container mx-auto px-4 h-full flex flex-col justify-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Welcome to WooStore</h1>
          <p className="text-xl md:text-2xl mb-8 max-w-2xl">Discover amazing products at unbeatable prices</p>
          <Link 
            href="/categories" 
            className="bg-white text-blue-900 hover:bg-gray-100 px-6 py-3 rounded-md font-medium inline-block w-max"
          >
            Shop Now
          </Link>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center text-gray-900">Featured Products</h2>
          
          <ProductList products={products} />
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center text-gray-900">Shop by Category</h2>
          
          <CategoryList categories={featuredCategories} />
          
          <div className="text-center mt-8">
            <Link 
              href="/categories" 
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
            >
              View All Categories
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-12 bg-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4 text-gray-900">Stay Updated</h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">Subscribe to our newsletter to receive updates on new products, special offers, and more.</p>
          
          <form className="max-w-md mx-auto flex">
            <input 
              type="email" 
              placeholder="Your email address" 
              className="flex-grow px-4 py-3 rounded-l-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button 
              type="submit" 
              className="bg-blue-600 text-white px-6 py-3 rounded-r-md font-medium hover:bg-blue-700 transition-colors"
            >
              Subscribe
            </button>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
}
