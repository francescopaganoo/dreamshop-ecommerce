'use client';

import { Category } from '../lib/api';
import Image from 'next/image';
import Link from 'next/link';

interface CategoryListProps {
  categories: Category[];
}

export default function CategoryList({ categories }: CategoryListProps) {
  return (
    <>
      {categories.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {categories.map((category: Category) => (
            <Link 
              key={category.id} 
              href={`/category/${category.slug}`}
              className="group relative h-48 bg-gray-200 rounded-lg overflow-hidden"
            >
              {category.image ? (
                <Image
                  src={category.image.src}
                  alt={category.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                  style={{ objectFit: 'cover' }}
                  className="group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600"></div>
              )}
              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                <h3 className="text-white text-xl font-bold">{category.name}</h3>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">No categories found.</p>
        </div>
      )}
    </>
  );
}
