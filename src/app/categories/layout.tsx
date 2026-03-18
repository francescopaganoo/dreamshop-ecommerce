import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Categorie | DreamShop - Esplora per Anime, Manga e Brand',
  description: 'Sfoglia tutte le categorie DreamShop: Dragon Ball, One Piece, Naruto, Pokemon, Demon Slayer e molto altro. Trova la tua serie preferita.',
  openGraph: {
    title: 'Categorie | DreamShop',
    description: 'Sfoglia tutte le categorie DreamShop: Dragon Ball, One Piece, Naruto, Pokemon, Demon Slayer e molto altro.',
    url: 'https://dreamshop18.com/categories',
    type: 'website',
    locale: 'it_IT',
    siteName: 'DreamShop',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Categorie | DreamShop',
    description: 'Sfoglia tutte le categorie DreamShop: Dragon Ball, One Piece, Naruto, Pokemon, Demon Slayer e molto altro.',
  },
  alternates: {
    canonical: 'https://dreamshop18.com/categories',
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

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
