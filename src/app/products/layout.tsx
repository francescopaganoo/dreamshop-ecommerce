import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tutti i Prodotti | DreamShop - Action Figure, Statue e Trading Card',
  description: 'Esplora il catalogo completo DreamShop: action figure, statue, trading card e merchandising anime e manga. Ichiban Kuji, S.H. Figuarts, Banpresto e molto altro.',
  openGraph: {
    title: 'Tutti i Prodotti | DreamShop',
    description: 'Esplora il catalogo completo DreamShop: action figure, statue, trading card e merchandising anime e manga.',
    url: 'https://dreamshop18.com/products',
    type: 'website',
    locale: 'it_IT',
    siteName: 'DreamShop',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tutti i Prodotti | DreamShop',
    description: 'Esplora il catalogo completo DreamShop: action figure, statue, trading card e merchandising anime e manga.',
  },
  alternates: {
    canonical: 'https://dreamshop18.com/products',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
