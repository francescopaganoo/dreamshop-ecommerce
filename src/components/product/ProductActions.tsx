'use client';

import { useState } from 'react';
import WishlistButton from '../WishlistButton';
import { Product } from '../../lib/api';

interface ProductActionsProps {
  product: Product;
}

export default function ProductActions({ product }: ProductActionsProps) {
  return (
    <div className="flex items-center space-x-4 mb-6">
      <WishlistButton productId={product.id} className="p-2 hover:bg-gray-100 rounded-full" />
      <span className="text-sm text-gray-500">Aggiungi ai preferiti</span>
    </div>
  );
}
