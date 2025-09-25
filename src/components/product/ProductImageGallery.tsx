'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProductImage {
  id: number;
  src: string;
  alt: string;
}

interface ProductImageGalleryProps {
  images: ProductImage[];
  productName: string;
  isOnSale?: boolean;
  selectedImageIndex?: number;
  onImageSelect?: (index: number) => void;
}

export default function ProductImageGallery({
  images,
  productName,
  isOnSale,
  selectedImageIndex: externalSelectedIndex,
  onImageSelect
}: ProductImageGalleryProps) {
  const [internalSelectedIndex, setInternalSelectedIndex] = useState(0);

  // Usa l'indice esterno se fornito, altrimenti usa quello interno
  const selectedImageIndex = externalSelectedIndex !== undefined ? externalSelectedIndex : internalSelectedIndex;
  
  // Se non ci sono immagini, usa un placeholder
  const displayImages = images.length > 0 
    ? images 
    : [{ id: 0, src: 'https://via.placeholder.com/600', alt: productName }];
  
  const selectedImage = displayImages[selectedImageIndex];

  return (
    <div className="space-y-4">
      {/* Immagine principale */}
      <div className="relative aspect-square bg-white rounded-xl overflow-hidden border border-gray-200">
        <Image
          src={selectedImage.src}
          alt={selectedImage.alt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          style={{ objectFit: 'contain' }}
          priority
          className="p-4"
        />
        
        {isOnSale && (
          <div className="absolute top-4 right-4 bg-green-500 text-white text-sm font-bold px-3 py-1 rounded-full">
            Offerta
          </div>
        )}
      </div>
      
      {/* Thumbnails - mostrati solo se ci sono più immagini */}
      {displayImages.length > 1 && (
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {displayImages.map((image, index) => (
            <button
              key={image.id}
              onClick={() => {
                if (onImageSelect) {
                  onImageSelect(index);
                } else {
                  setInternalSelectedIndex(index);
                }
              }}
              className={`relative flex-shrink-0 w-20 h-20 bg-white rounded-lg border-2 overflow-hidden transition-all duration-200 ${
                index === selectedImageIndex 
                  ? 'border-bred-500 ring-2 ring-bred-200' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="80px"
                style={{ objectFit: 'contain' }}
                className="p-1"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}