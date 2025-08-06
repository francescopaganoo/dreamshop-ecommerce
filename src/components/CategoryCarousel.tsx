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

interface CategoryCarouselProps {
  categories: Category[];
}

const CategoryCarousel: React.FC<CategoryCarouselProps> = ({ categories }) => {
  return (
    <div className="w-full">
      <Swiper
        modules={[Navigation]}
        spaceBetween={20}
        slidesPerView={2}
        navigation={{
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev',
        }}
        breakpoints={{
          // when window width is >= 640px (sm)
          640: {
            slidesPerView: 3,
            spaceBetween: 20,
          },
          // when window width is >= 768px (md)
          768: {
            slidesPerView: 4,
            spaceBetween: 30,
          },
          // when window width is >= 1024px (lg)
          1024: {
            slidesPerView: 6,
            spaceBetween: 30,
          },
        }}
        className="py-8 relative"
      >
        <div className="swiper-button-next !text-bred-700 !bg-white/70 !w-10 !h-10 !rounded-full flex items-center justify-center hover:!bg-white hover:!shadow-md after:!text-xl"></div>
        <div className="swiper-button-prev !text-bred-700 !bg-white/70 !w-10 !h-10 !rounded-full flex items-center justify-center hover:!bg-white hover:!shadow-md after:!text-xl"></div>
        {categories.map((category) => (
          <SwiperSlide key={category.id}>
            <Link href={`/category/${category.slug}`} className="block h-full">
              <div className="h-full flex flex-col bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg">
                <div className="relative h-48 w-full">
                  {category.image ? (
                    <Image
                      src={category.image.src}
                      alt={category.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400">No image</span>
                    </div>
                  )}
                </div>
                <div className="p-4 text-center flex-grow">
                  <h3 className="font-medium text-gray-900 truncate">{category.name}</h3>
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
