'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface ProductImage {
  id: number;
  src: string;
  alt: string;
}

interface ProductImageModalProps {
  images: ProductImage[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductImageModal({
  images,
  initialIndex,
  isOpen,
  onClose
}: ProductImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Aggiorna l'indice corrente quando cambia initialIndex
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, isOpen]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Gestisci la navigazione con la tastiera
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToNext, goToPrevious, onClose]);

  // Blocca lo scroll del body quando la modale è aperta
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentImage = images[currentIndex];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
          onClick={onClose}
        >
          {/* Pulsante chiudi */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-[10000] p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            aria-label="Chiudi"
          >
            <FaTimes size={24} />
          </button>

          {/* Contenuto modale */}
          <div
            className="relative w-full h-full max-w-7xl max-h-screen p-4 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Immagine principale */}
            <div className="relative w-full h-[80vh] flex items-center justify-center">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative w-full h-full"
              >
                <Image
                  src={currentImage.src}
                  alt={currentImage.alt}
                  fill
                  sizes="100vw"
                  style={{ objectFit: 'contain' }}
                  priority
                  className="select-none"
                />
              </motion.div>

              {/* Pulsanti navigazione - mostrati solo se ci sono più immagini */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      goToPrevious();
                    }}
                    className="absolute left-0 md:left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                    aria-label="Immagine precedente"
                  >
                    <FaChevronLeft size={24} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      goToNext();
                    }}
                    className="absolute right-0 md:right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                    aria-label="Immagine successiva"
                  >
                    <FaChevronRight size={24} />
                  </button>
                </>
              )}
            </div>

            {/* Indicatore immagine corrente */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
                {currentIndex + 1} / {images.length}
              </div>
            )}

            {/* Thumbnails in basso */}
            {images.length > 1 && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 max-w-full overflow-x-auto">
                <div className="flex space-x-2 px-4">
                  {images.map((image, index) => (
                    <button
                      key={image.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex(index);
                      }}
                      className={`relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20 bg-white/10 rounded-lg border-2 overflow-hidden transition-all duration-200 ${
                        index === currentIndex
                          ? 'border-white ring-2 ring-white/50'
                          : 'border-white/30 hover:border-white/50'
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
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
