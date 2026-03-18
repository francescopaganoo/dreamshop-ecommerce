import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cerca Prodotti | DreamShop - Trova Action Figure e Merchandising',
  description: 'Cerca tra migliaia di action figure, statue, trading card e merchandising anime e manga su DreamShop. Trova il prodotto che desideri.',
  openGraph: {
    title: 'Cerca Prodotti | DreamShop',
    description: 'Cerca tra migliaia di action figure, statue, trading card e merchandising anime e manga su DreamShop.',
    url: 'https://dreamshop18.com/search',
    type: 'website',
    locale: 'it_IT',
    siteName: 'DreamShop',
  },
  alternates: {
    canonical: 'https://dreamshop18.com/search',
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
