import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offerte e Promozioni | DreamShop - Sconti su Action Figure e Anime',
  description: 'Scopri tutte le offerte e promozioni DreamShop: sconti su action figure, statue, trading card e merchandising anime. Approfitta dei prezzi ribassati!',
  openGraph: {
    title: 'Offerte e Promozioni | DreamShop',
    description: 'Scopri tutte le offerte e promozioni DreamShop: sconti su action figure, statue, trading card e merchandising anime.',
    url: 'https://dreamshop18.com/offerte',
    type: 'website',
    locale: 'it_IT',
    siteName: 'DreamShop',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Offerte e Promozioni | DreamShop',
    description: 'Scopri tutte le offerte e promozioni DreamShop: sconti su action figure, statue, trading card e merchandising anime.',
  },
  alternates: {
    canonical: 'https://dreamshop18.com/offerte',
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

export default function OfferteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
