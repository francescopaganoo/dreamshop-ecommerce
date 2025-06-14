import { getCategories, Category } from '../../lib/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import Image from 'next/image';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'All Categories - WooStore',
  description: 'Browse all product categories in our store',
};

export default async function CategoriesPage() {
  const categories: Category[] = await getCategories();
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow py-8 bg-white">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold mb-4 text-gray-700">Shop by Category</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Browse our wide selection of products by category to find exactly what you&apos;re looking for.
            </p>
          </div>
          
          {/* Categories Grid */}
          {categories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {categories.map((category: Category) => (
                <Link 
                  key={category.id} 
                  href={`/category/${category.id}`}
                  className="group relative h-64 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center hover:bg-gray-100 transition-colors duration-300"
                >
                  {category.image ? (
                    <Image
                      src={category.image.src}
                      alt={category.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      style={{ objectFit: 'cover' }}
                      className="group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600"></div>
                  )}
                  
                  <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-30 transition-all duration-300 flex flex-col items-center justify-center p-6">
                    <h2 className="text-white text-2xl font-bold mb-2 text-center">{category.name}</h2>
                    <span className="text-white text-sm bg-black bg-opacity-30 px-3 py-1 rounded-full">
                      {category.count} {category.count === 1 ? 'product' : 'products'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No categories found.</p>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
