'use client';

import React, { useEffect } from 'react';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
// Define formatPrice function locally to avoid import issues
const formatPrice = (price: string | number): string => {
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numericPrice);
};

// Funzione per estrarre lo slug del prodotto dall'URL completo
const extractSlug = (permalink: string): string => {
  // Se il permalink è vuoto, restituisci una stringa vuota
  if (!permalink) return '';
  
  // Estrai solo l'ultima parte dell'URL (lo slug del prodotto)
  const urlParts = permalink.split('/');
  
  // Rimuovi eventuali parametri di query o frammenti
  const lastPart = urlParts[urlParts.length - 1].split('?')[0].split('#')[0];
  
  // Se l'ultima parte è vuota (URL termina con /), prendi la penultima
  return lastPart || urlParts[urlParts.length - 2] || '';
};

export default function WishlistPage() {
  const { wishlistItems, isLoading, removeItem } = useWishlist();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  // Reindirizza alla pagina di login se l'utente non è autenticato
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/login?redirect=/wishlist');
    }
  }, [isAuthenticated, isAuthLoading, router]);

  // Non facciamo nessuna chiamata aggiuntiva qui, dato che il WishlistContext
  // si occupa già di caricare la wishlist quando l'utente è autenticato // Manteniamo refreshWishlist nelle dipendenze poiché è un useCallback

  // Gestisce la rimozione di un prodotto dalla wishlist
  const handleRemove = async (productId: number) => {
    await removeItem(productId);
  };

  // Se l'autenticazione è in corso, mostra un loader
  if (isAuthLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bred-500"></div>
        </div>
      </div>
    );
  }

  // Se l'utente non è autenticato, non mostrare nulla (verrà reindirizzato)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">La mia Wishlist</h1>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bred-500"></div>
        </div>
      ) : wishlistItems.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600 mb-4">La tua wishlist è vuota.</p>
          <Link href="/products" className="inline-block bg-bred-500 text-white px-4 py-2 rounded hover:bg-bred-600">
            Sfoglia i prodotti
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prodotto
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prezzo
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data aggiunta
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {wishlistItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 ">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-16 w-16 relative">
                        {item.image && Array.isArray(item.image) && item.image.length > 0 ? (
                          <Image
                            src={item.image[0]}
                            alt={item.name}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : item.image && typeof item.image === 'object' && 'src' in item.image ? (
                          <Image
                            src={item.image.src}
                            alt={item.name}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-16 w-16 bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-500 text-xs">No image</span>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <Link href={`/product/${extractSlug(item.permalink)}`} className="text-sm font-medium text-gray-900 hover:text-bred-500">
                          {item.name}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 ">
                    <div className="text-sm text-gray-900">
                      {item.sale_price ? (
                        <>
                          <span className="text-bred-500">{formatPrice(item.sale_price)}</span>
                          <span className="ml-2 line-through text-gray-500 text-xs">{formatPrice(item.regular_price)}</span>
                        </>
                      ) : (
                        <span>{formatPrice(item.regular_price)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 ">
                    <div className="text-sm text-gray-900">
                      {new Date(item.date_added).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Link
                        href={`/product/${extractSlug(item.permalink)}`}
                        className="text-bred-500 hover:text-bred-700"
                      >
                        Visualizza
                      </Link>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Rimuovi
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
