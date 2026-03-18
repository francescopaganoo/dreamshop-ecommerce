import type { Metadata } from 'next';
import { cache } from 'react';
import { getCategoryBySlug } from '@/lib/api';

// De-duplicate getCategoryBySlug calls within the same request
// (generateMetadata + layout component both need the category)
const getCategoryCached = cache((slug: string) => getCategoryBySlug(slug));

// Decode HTML entities from WooCommerce (e.g. &amp; &#8217; &#039;)
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

interface CategoryLayoutProps {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: CategoryLayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryCached(slug);

  if (!category) {
    return {
      title: 'Categoria non trovata | DreamShop',
    };
  }

  const categoryName = decodeHtmlEntities(category.name);
  const title = `${categoryName} | DreamShop - Action Figure e Merchandising`;
  const description = `Scopri tutti i prodotti ${categoryName} su DreamShop: action figure, statue e merchandising. ${category.count} prodotti disponibili. Spedizione veloce in Italia.`;
  const url = `https://dreamshop18.com/category/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      locale: 'it_IT',
      siteName: 'DreamShop',
      ...(category.image?.src && {
        images: [
          {
            url: category.image.src,
            width: 800,
            height: 600,
            alt: category.image.alt || categoryName,
          },
        ],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(category.image?.src && {
        images: [category.image.src],
      }),
    },
    alternates: {
      canonical: url,
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
}

export default async function CategoryLayout({ params, children }: CategoryLayoutProps) {
  const { slug } = await params;
  const category = await getCategoryCached(slug);

  const categoryName = category?.name ? decodeHtmlEntities(category.name) : slug;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://dreamshop18.com" },
      { "@type": "ListItem", "position": 2, "name": "Categorie", "item": "https://dreamshop18.com/categories" },
      { "@type": "ListItem", "position": 3, "name": categoryName, "item": `https://dreamshop18.com/category/${slug}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}
