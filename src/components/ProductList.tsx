'use client';

import { Product } from '../lib/api';
import ProductCard from './ProductCard';

interface ProductListProps {
  products: Product[];
}

export default function ProductList({ products }: ProductListProps) {
  // Deduplica i prodotti basandosi sull'ID per evitare chiavi duplicate
  const uniqueProducts = products.filter((product, index, array) =>
    array.findIndex(p => p.id === product.id) === index
  );

  return (
    <>
      {uniqueProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {uniqueProducts.map((product: Product, index: number) => (
            <ProductCard
              key={product.id}
              product={product}
              priority={index < 6} // Priorità per i primi 6 prodotti (above the fold)
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">No products found. Check back soon!</p>
        </div>
      )}
    </>
  );
}
