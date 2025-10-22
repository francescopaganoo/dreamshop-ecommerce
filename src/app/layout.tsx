import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { Bangers } from 'next/font/google'

import "./globals.css";
import "../styles/cursor.css";
import ClientProviders from "../components/ClientProviders";
import Header from "../components/Header";
import Footer from "../components/Footer";
import FloatingCartButton from "../components/FloatingCartButton";
import WhatsAppButton from "../components/WhatsAppButton";
import CookieConsent from "../components/CookieConsent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bangers = Bangers({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bangers',
})

export const metadata: Metadata = {
  title: "DreamShop | Tutte le action figure in un unico portale",
  description: "Acquista action figure, statue, trading card e merchandising anime/manga. Ichiban Kuji, S.H. Figuarts, Pokemon, One Piece e molto altro. Spedizione veloce in Italia.",

  // Meta keywords (anche se meno rilevante oggi, non fa male)
  keywords: [
    'action figure',
    'statue anime',
    'trading card',
    'merchandising anime',
    'Ichiban Kuji',
    'S.H. Figuarts',
    'Pokemon',
    'One Piece',
    'Dragon Ball',
    'Banpresto',
    'figure giapponesi',
    'resine anime',
    'negozio anime online'
  ],

  // Open Graph meta tags
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    url: 'https://dreamshop18.com',
    siteName: 'DreamShop',
    title: 'DreamShop | Tutte le action figure in un unico portale',
    description: 'Acquista action figure, statue, trading card e merchandising anime/manga. Ichiban Kuji, S.H. Figuarts, Pokemon, One Piece e molto altro. Spedizione veloce in Italia.',
    images: [
      {
        url: 'https://dreamshop18.com/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'DreamShop - Action Figure e Merchandising Anime',
      }
    ],
  },

  // Twitter Card meta tags
  twitter: {
    card: 'summary_large_image',
    title: 'DreamShop | Tutte le action figure in un unico portale',
    description: 'Acquista action figure, statue, trading card e merchandising anime/manga. Ichiban Kuji, S.H. Figuarts, Pokemon e molto altro.',
    images: ['https://dreamshop18.com/images/og-image.jpg'],
  },

  // Meta robots
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

  // Verifica sito (se necessario)
  verification: {
    // google: 'codice-verifica-google-search-console',
    // bing: 'codice-verifica-bing',
  },

  // Canonical e alternates
  alternates: {
    canonical: 'https://dreamshop18.com',
  },

  // Altre info
  category: 'ecommerce',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bangers.variable} antialiased`}
      >
        {/* Google Tag Manager */}
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-PXPKPJDR');
            `,
          }}
        />
        {/* End Google Tag Manager */}

        {/* Hotjar Tracking Code */}
        <Script
          id="hotjar-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(h,o,t,j,a,r){
                h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                h._hjSettings={hjid:6545540,hjsv:6};
                a=o.getElementsByTagName('head')[0];
                r=o.createElement('script');r.async=1;
                r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                a.appendChild(r);
              })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
            `,
          }}
        />
        {/* End Hotjar Tracking Code */}

        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PXPKPJDR"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}

        {/* Google Analytics */}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
            />
            <Script
              id="ga-script"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
                `,
              }}
            />
          </>
        )}

        <Script
          id="paypal-error-handler"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              // Gestore di errori globale per PayPal
              window.addEventListener('error', function(e) {
                if (e.error && e.error.toString && e.error.toString().includes('paypal')) {
                  console.warn('PayPal error intercepted:', e.error);
                  e.preventDefault();
                  return false;
                }
              });

              window.addEventListener('unhandledrejection', function(e) {
                if (e.reason && e.reason.toString && e.reason.toString().includes('paypal')) {
                  console.warn('PayPal unhandled promise rejection intercepted:', e.reason);
                  e.preventDefault();
                  return false;
                }
              });
            `,
          }}
        />

        <ClientProviders>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
            <FloatingCartButton />
            <WhatsAppButton />
            <CookieConsent />
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
