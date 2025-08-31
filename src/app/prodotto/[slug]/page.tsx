import { getProductBySlug, getBestSellingProducts, getRelatedProducts, extractACFFields } from '@/lib/api';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ProductVariations from '@/components/product/ProductVariations';
import SimpleProductAddToCart from '@/components/product/SimpleProductAddToCart';
import ProductSkeleton from '@/components/product/ProductSkeleton';
import ProductActions from '@/components/product/ProductActions';
import BundleProducts from '@/components/product/BundleProducts';
import ProductImageGallery from '@/components/product/ProductImageGallery';
import SaleCountdown from '@/components/product/SaleCountdown';
import ProductCard from '@/components/ProductCard';
import { isBundle, BundleProduct } from '@/types/bundle';
import { Suspense } from 'react';

// Configurazione per il rendering dinamico della pagina
//export const dynamic = 'force-dynamic';
export const revalidate = 300;

// Generate metadata for the page
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateMetadata({ params }: any): Promise<Metadata> {
  // Attendi i params prima di utilizzarli
  const resolvedParams = await Promise.resolve(params);
  const product = await getProductBySlug(resolvedParams.slug);
  
  if (!product) {
    return {
      title: 'Product Not Found',
    };
  }
  
  return {
    title: product.name,
    description: product.short_description.replace(/<[^>]*>/g, ''),
  };
}

// Componente per caricare i dettagli del prodotto
async function ProductDetails({ slug }: { slug: string }) {
  const product = await getProductBySlug(slug);
  
  if (!product) {
    notFound();
  }
  
  
  // Format price with currency symbol
  const formatPrice = (price: string | null | undefined) => {
    if (!price) return null;
    const parsedPrice = parseFloat(price);
    return isNaN(parsedPrice) ? null : `€${parsedPrice.toFixed(2)}`;
  };
  
  // Check if product is on sale
  const isOnSale = product.sale_price && product.sale_price !== '';
  
  // Check if product has a valid price
  const hasValidPrice = product.price && parseFloat(product.price) > 0;
  
  return (
    <>
      {/* Breadcrumbs */}
      <nav className="mb-6 text-sm">
        <ol className="flex items-center space-x-2">
          <li>
            <Link href="/" className="text-gray-500 hover:text-bred-500">Home</Link>
          </li>
          <li className="text-gray-500">/</li>
          {product.categories && product.categories.length > 0 && (
            <>
              <li>
                <Link 
                  href={`/category/${product.categories[0].slug}`} 
                  className="text-gray-500 hover:text-bred-500"
                >
                  {product.categories[0].name}
                </Link>
              </li>
              <li className="text-gray-500">/</li>
            </>
          )}
          <li className="text-gray-900 font-medium truncate max-w-xs">{product.name}</li>
        </ol>
      </nav>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Product Images */}
        <ProductImageGallery 
          images={product.images || []}
          productName={product.name}
          isOnSale={!!isOnSale}
        />
        
        {/* Product Info */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>
          
          {/* Price - Solo per prodotti semplici */}
          {product.type !== 'variable' && (
            <div className="mb-6">
              {!hasValidPrice ? (
                <div className="text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Prezzo non disponibile</span>
                </div>
              ) : isOnSale ? (
                <div className="flex items-center space-x-3">
                  {formatPrice(product.sale_price) && (
                    <span className="text-2xl font-bold text-red-600">
                      {formatPrice(product.sale_price)}
                    </span>
                  )}
                  {formatPrice(product.regular_price) && (
                    <span className="text-lg text-gray-500 line-through">
                      {formatPrice(product.regular_price)}
                    </span>
                  )}
                </div>
              ) : (
                formatPrice(product.regular_price) && (
                  <span className="text-2xl font-bold text-gray-900">
                    {formatPrice(product.regular_price)}
                  </span>
                )
              )}
            </div>
          )}
          
          {/* Sale Countdown - Solo per prodotti in offerta con data di fine */}
          {isOnSale && product.date_on_sale_to && (
            <div className="mb-6">
              <SaleCountdown 
                saleEndDate={product.date_on_sale_to}
                saleStartDate={product.date_on_sale_from}
              />
            </div>
          )}
          
          {/* Stock Status */}
          <div className="mb-6">
            {product.stock_status === 'instock' && hasValidPrice ? (
              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  Disponibile
                </span>
                
                {/* Avviso speciale quando rimangono solo 2 pezzi */}
                {product.stock_quantity === 2 && (
                  <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-orange-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="text-sm font-medium text-orange-800">
                        ⚡ Ultimi 2 pezzi rimasti!
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                Non disponibile
              </span>
            )}
          </div>
          
          {/* Short Description */}
          <div className="mb-6 prose text-gray-600 prose-sm" dangerouslySetInnerHTML={{ __html: product.short_description }} />
          
          {/* Wishlist Button */}
          <ProductActions product={product} />
          
          {/* Add to Cart Section */}
          <div className="mb-8">
            {product.type === 'variable' && product.variations && product.variations.length > 0 ? (
              <Suspense fallback={<div className="h-40 bg-gray-100 animate-pulse rounded-lg"></div>}>
                <ProductVariationsLoader productId={product.id} attributes={product.attributes || []} productName={product.name} />
              </Suspense>
            ) : (
              <SimpleProductAddToCart product={product} />
            )}
          </div>
          
          {/* Additional Info */}
          <div className="border-t border-gray-200 pt-6">
            {/*<h3 className="text-lg font-medium text-gray-900 mb-4">Dettagli prodotto</h3>*/}
            
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: product.description }} />
          </div>
          
          {/* Product Specifications - ACF Fields */}
          {(() => {
            const acfFields = extractACFFields(product.meta_data);
            const hasACFFields = acfFields.brand || acfFields.tipologia || acfFields.anime || acfFields.codice_a_barre;
            
            return hasACFFields && (
              <div className="border-t border-gray-200 pt-6 mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Specifiche Prodotto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {acfFields.brand && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="font-medium text-gray-600">Brand:</span>
                      <span className="text-gray-900">{acfFields.brand}</span>
                    </div>
                  )}
                  {acfFields.tipologia && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="font-medium text-gray-600">Tipologia:</span>
                      <span className="text-gray-900">{acfFields.tipologia}</span>
                    </div>
                  )}
                  {acfFields.anime && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="font-medium text-gray-600">Anime:</span>
                      <span className="text-gray-900">{acfFields.anime}</span>
                    </div>
                  )}
                  {acfFields.codice_a_barre && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="font-medium text-gray-600">Codice a Barre:</span>
                      <span className="text-gray-900">{acfFields.codice_a_barre}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          
          {/* Bundle Products - Mostrato solo se il prodotto è un bundle */}
          {isBundle(product) && (
            <div className="border-t border-gray-200 pt-6 mt-6">
              <BundleProducts product={product as BundleProduct} />
            </div>
          )}
        </div>
      </div>
      
      {/* Related Products Section */}
      <div className="mt-16">
        <Suspense fallback={<div className="h-40 bg-gray-100 animate-pulse rounded-lg"></div>}>
          <RelatedProductsSection productId={product.id} categories={product.categories || []} />
        </Suspense>
      </div>
      
      {/* Best Selling Products Section */}
      <div className="mt-16">
        <Suspense fallback={<div className="h-40 bg-gray-100 animate-pulse rounded-lg"></div>}>
          <BestSellingProductsSection />
        </Suspense>
      </div>
    </>
  );
}

// Componente per i prodotti correlati
async function RelatedProductsSection({ productId, categories }: { productId: number, categories: Array<{id: number; name: string; slug: string}> }) {
  const categoryIds = categories.map(cat => cat.id);
  const relatedProducts = await getRelatedProducts(productId, categoryIds, 4);
  
  if (relatedProducts.length === 0) return null;
  
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-8">Prodotti Correlati</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {relatedProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

// Componente per i prodotti più venduti
async function BestSellingProductsSection() {
  const bestSellingProducts = await getBestSellingProducts(4);
  
  if (bestSellingProducts.length === 0) return null;
  
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-8">Prodotti Più Acquistati</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {bestSellingProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

// Componente per caricare le variazioni in modo asincrono
async function ProductVariationsLoader({ productId, attributes, productName }: { productId: number, attributes: Array<{id: number; name: string; position: number; visible: boolean; variation: boolean; options: string[]}>, productName: string }) {
  // Importiamo getProductVariations solo quando necessario
  const { getProductVariations } = await import('../../../lib/api');
  const variations = await getProductVariations(productId);
  
  return (
    <ProductVariations 
      productId={productId}
      attributes={attributes}
      variations={variations}
      productName={productName}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function ProductPage({ params }: any) {
  // Attendi i params prima di utilizzarli
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams.slug;
  

  
  return (
    <div className="min-h-screen flex flex-col bg-white">
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <Suspense fallback={<ProductSkeleton />}>
          <ProductDetails slug={slug} />
        </Suspense>
      </main>
      
    </div>
  );
}
