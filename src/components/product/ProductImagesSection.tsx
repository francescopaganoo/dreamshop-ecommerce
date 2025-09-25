'use client';

import { useState, useEffect } from 'react';
import ProductImageGallery from './ProductImageGallery';

interface ProductImage {
  id: number;
  src: string;
  alt: string;
}

interface ProductImagesSectionProps {
  images: ProductImage[];
  productName: string;
  isOnSale: boolean;
}

// Crea un event emitter semplice per la comunicazione tra componenti
const variationImageEvents = {
  listeners: [] as ((imageUrl: string) => void)[],

  subscribe: (callback: (imageUrl: string) => void) => {
    variationImageEvents.listeners.push(callback);
    return () => {
      const index = variationImageEvents.listeners.indexOf(callback);
      if (index > -1) {
        variationImageEvents.listeners.splice(index, 1);
      }
    };
  },

  emit: (imageUrl: string) => {
    variationImageEvents.listeners.forEach(callback => callback(imageUrl));
  }
};

export default function ProductImagesSection({
  images,
  productName,
  isOnSale
}: ProductImagesSectionProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    const unsubscribe = variationImageEvents.subscribe((variationImageUrl: string) => {
      const imageIndex = images.findIndex(img => img.src === variationImageUrl);
      if (imageIndex !== -1) {
        setSelectedImageIndex(imageIndex);
      }
    });

    return unsubscribe;
  }, [images]);

  return (
    <ProductImageGallery
      images={images}
      productName={productName}
      isOnSale={isOnSale}
      selectedImageIndex={selectedImageIndex}
      onImageSelect={setSelectedImageIndex}
    />
  );
}

// Export dell'event emitter per uso in ProductVariations
export { variationImageEvents };