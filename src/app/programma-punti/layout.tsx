import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Programma Punti | DreamShop - Accumula e Risparmia',
  description: 'Scopri il programma punti DreamShop: accumula punti con ogni acquisto e ottieni sconti esclusivi su action figure, statue e merchandising anime.',
  openGraph: {
    title: 'Programma Punti | DreamShop',
    description: 'Scopri il programma punti DreamShop: accumula punti con ogni acquisto e ottieni sconti esclusivi.',
    url: 'https://dreamshop18.com/programma-punti',
    type: 'website',
    locale: 'it_IT',
    siteName: 'DreamShop',
  },
  alternates: {
    canonical: 'https://dreamshop18.com/programma-punti',
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

export default function ProgrammaPuntiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
