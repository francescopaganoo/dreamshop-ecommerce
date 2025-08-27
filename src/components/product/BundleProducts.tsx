'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getProduct } from '@/lib/api';
import { BundleProduct, BundleItems, getBundleItems } from '@/types/bundle';
import { Product } from '@/lib/api';

interface BundleProductsProps {
  product: BundleProduct;
}

export default function BundleProducts({ product }: BundleProductsProps) {
  const [bundleItems, setBundleItems] = useState<BundleItems | null>(null);
  const [bundledProducts, setBundledProducts] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBundleData = async () => {
      try {
        // Estrai gli elementi del bundle dal prodotto
        const items = getBundleItems(product);
        if (!items) {
          setError('Questo prodotto non contiene elementi bundle validi');
          setLoading(false);
          return;
        }

        setBundleItems(items);

        // Recupera i dettagli di ogni prodotto nel bundle
        const productPromises = Object.values(items).map(item => 
          getProduct(parseInt(item.id, 10))
            .then(productData => [item.id, productData])
            .catch(err => {
              console.error(`Errore nel recupero del prodotto ${item.id}:`, err);
              return [item.id, null];
            })
        );

        const productsData = await Promise.all(productPromises);
        const productsMap = new Map<string, Product>();
        
        productsData.forEach(([id, productData]) => {
          if (productData) {
            productsMap.set(id as string, productData as Product);
          }
        });

        setBundledProducts(productsMap);
      } catch (err) {
        setError(`Errore nel recupero dei dati del bundle: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchBundleData();
  }, [product]);

  if (loading) {
    return (
      <div className="py-4">
        <p className="text-center">Caricamento dei prodotti del bundle...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  if (!bundleItems || Object.keys(bundleItems).length === 0) {
    return (
      <div className="py-4">
        <p>Questo prodotto non contiene elementi bundle.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold mb-4 text-gray-600">Prodotti inclusi nel bundle</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.values(bundleItems).map((item) => {
          const bundledProduct = bundledProducts.get(item.id);
          
          if (!bundledProduct) {
            return (
              <div key={item.id} className="border p-4 rounded-md bg-gray-50">
                <p >Prodotto ID: {item.id}</p>
                <p>Quantità: {item.qty}</p>
                <p className="text-red-500">Dettagli prodotto non disponibili</p>
              </div>
            );
          }

          return (
            <div key={item.id} className="border p-4 rounded-md shadow-sm hover:shadow-md transition-shadow">
              <div className="relative h-40 w-full mb-3">
                {bundledProduct.images && bundledProduct.images[0] ? (
                  <Image
                    src={bundledProduct.images[0].src}
                    alt={bundledProduct.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    style={{ objectFit: 'contain' }}
                  />
                ) : (
                  <div className="h-full w-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500">Immagine non disponibile</span>
                  </div>
                )}
              </div>
              
              <Link href={`/prodotto/${bundledProduct.slug}`} className="block">
                <h4 className="font-medium text-lg text-gray-600 hover:text-gray-700 transition-colors">
                  {bundledProduct.name}
                </h4>
              </Link>
              
              <div className="mt-2 flex justify-between items-center">
                <p className="text-gray-700">
                  Quantità: <span className="font-semibold">{item.qty}</span>
                </p>
                
                {bundledProduct.price && (
                  <p className="text-gray-800 font-semibold">
                    €{parseFloat(bundledProduct.price).toFixed(2)}
                  </p>
                )}
              </div>
              
              {bundledProduct.short_description && (
                <div 
                  className="mt-2 text-sm text-gray-600 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: bundledProduct.short_description }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
