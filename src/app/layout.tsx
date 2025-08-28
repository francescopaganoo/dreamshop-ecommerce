import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Bangers } from 'next/font/google'

import "./globals.css";
import ClientProviders from "../components/ClientProviders";
import Header from "../components/Header";
import Footer from "../components/Footer";
import FloatingCartButton from "../components/FloatingCartButton";
import WhatsAppButton from "../components/WhatsAppButton";

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
  description: "Tutte le action figure in un unico portale",
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
        <ClientProviders>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
            <FloatingCartButton />
            <WhatsAppButton />
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
