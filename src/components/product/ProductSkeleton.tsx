"use client";

export default function ProductSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Breadcrumbs Skeleton */}
      <div className="mb-6 flex items-center space-x-2">
        <div className="h-4 w-10 bg-gray-200 rounded"></div>
        <div className="h-4 w-2 bg-gray-200 rounded"></div>
        <div className="h-4 w-20 bg-gray-200 rounded"></div>
        <div className="h-4 w-2 bg-gray-200 rounded"></div>
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Product Image Skeleton */}
        <div className="aspect-square bg-gray-200 rounded-xl"></div>
        
        {/* Product Info Skeleton */}
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          
          <div className="h-5 bg-gray-200 rounded w-1/3"></div>
          
          <div className="h-24 bg-gray-200 rounded"></div>
          
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          </div>
          
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
      
      {/* Additional Info Skeleton */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    </div>
  );
}
