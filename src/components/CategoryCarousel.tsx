"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import { Category } from '../lib/api';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';

// Function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

interface CategoryCarouselProps {
  categories: Category[];
}

const CategoryCarousel: React.FC<CategoryCarouselProps> = ({ categories }) => {
  return (
    <div className="w-full">
      <Swiper
        modules={[Navigation]}
        spaceBetween={20}
        slidesPerView={1}
        navigation={{
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev',
        }}
        breakpoints={{
          // when window width is >= 640px (sm)
          640: {
            slidesPerView: 2,
            spaceBetween: 20,
          },
          // when window width is >= 768px (md)
          768: {
            slidesPerView: 2,
            spaceBetween: 24,
          },
          // when window width is >= 1024px (lg)
          1024: {
            slidesPerView: 3,
            spaceBetween: 28,
          },
          // when window width is >= 1280px (xl)
          1280: {
            slidesPerView: 4,
            spaceBetween: 32,
          },
        }}
        className="py-8 relative"
      >
        <div className="swiper-button-next !text-white !bg-bred-500 !w-12 !h-12 !rounded-full !shadow-lg hover:!bg-bred-600 hover:!shadow-xl hover:!scale-110 !transition-all !duration-300 after:!text-lg after:!font-bold !z-10"></div>
        <div className="swiper-button-prev !text-white !bg-bred-500 !w-12 !h-12 !rounded-full !shadow-lg hover:!bg-bred-600 hover:!shadow-xl hover:!scale-110 !transition-all !duration-300 after:!text-lg after:!font-bold !z-10"></div>
        {categories.map((category, index) => (
          <SwiperSlide key={category.id}>
            <Link href={`/category/${category.slug}`} className="block h-full group">
              <div className="relative h-40 bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl border border-gray-200/50">
                {/* Background Image */}
                <div className="absolute inset-0">
                  {category.image ? (
                    <Image
                      src={category.image.src}
                      alt={category.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-bred-400 via-bred-500 to-bred-600"></div>
                  )}
                </div>
                
                {/* Simple overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-transparent"></div>
                
                {/* Category Title - Positioned in left area */}
                <div className="absolute inset-y-28 left-3 right-1/3 flex flex-col justify-center">
                  <div className="bg-white/20 backdrop-blur-md rounded-xl px-4 py-3 group-hover:bg-white/30 transition-all duration-200 border border-white/20">
                    <h3 className="font-bold text-white text-l leading-tight drop-shadow-lg group-hover:text-white/90 transition-colors duration-200">
                      {decodeHtmlEntities(category.name)}
                    </h3>
                    
                    {/* Simple underline */}
                    <div className="w-0 h-0.5 bg-white/80 rounded-full mt-2 group-hover:w-8 transition-all duration-300"></div>
                  </div>
                </div>
                
                {/* Simple action indicator */}
                <div className="absolute bottom-20 left-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span className="text-white/90 text-sm font-medium bg-black/20 px-3 py-1 rounded-full">
                    Esplora →
                  </span>
                </div>
              </div>
            </Link>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default CategoryCarousel;
