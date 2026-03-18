import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chi Siamo | DreamShop - La Passione per Anime e Manga',
  description: 'Scopri la storia di DreamShop: il portale italiano dedicato a action figure, statue e merchandising anime e manga. La nostra missione e i nostri valori.',
  openGraph: {
    title: 'Chi Siamo | DreamShop',
    description: 'Scopri la storia di DreamShop: il portale italiano dedicato a action figure, statue e merchandising anime e manga.',
    url: 'https://dreamshop18.com/chi-siamo',
    type: 'website',
    locale: 'it_IT',
    siteName: 'DreamShop',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chi Siamo | DreamShop',
    description: 'Scopri la storia di DreamShop: il portale italiano dedicato a action figure, statue e merchandising anime e manga.',
  },
  alternates: {
    canonical: 'https://dreamshop18.com/chi-siamo',
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

export default function ChiSiamoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
