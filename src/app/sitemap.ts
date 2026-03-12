import { MetadataRoute } from 'next';
import { getFilteredProductsPlugin, getCategories, Product, Category } from '@/lib/api';

// Rigenera il sitemap ogni 24 ore (86400 secondi)
// Questo significa che i nuovi prodotti saranno inclusi automaticamente nel sitemap
// senza dover rifare la build del sito
export const revalidate = 86400; // 24 ore in secondi

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://dreamshop18.com';

  // Pagine statiche
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/offerte`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/chi-siamo`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contatti`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/termini-vendita`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/cookie-policy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  try {
    // Ottieni tutti i prodotti con paginazione sicura (100 per pagina è il massimo WooCommerce)
    let allProducts: Product[] = [];
    const perPage = 100;

    console.log('🗺️ Starting sitemap generation...');

    // Prima chiamata per sapere quante pagine ci sono in totale
    const { products: firstPage, total_pages } = await getFilteredProductsPlugin({
      page: 1,
      per_page: perPage,
      orderby: 'date',
      order: 'desc',
    });

    allProducts = [...firstPage];
    console.log(`✅ Total pages: ${total_pages}`);

    if (total_pages > 1) {
      // Fetch tutte le pagine rimanenti in parallelo a blocchi di 5
      const remainingPages = Array.from({ length: total_pages - 1 }, (_, i) => i + 2);
      const chunkSize = 5;

      for (let i = 0; i < remainingPages.length; i += chunkSize) {
        const chunk = remainingPages.slice(i, i + chunkSize);
        const results = await Promise.allSettled(
          chunk.map(p => getFilteredProductsPlugin({ page: p, per_page: perPage, orderby: 'date', order: 'desc' }))
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            allProducts = [...allProducts, ...result.value.products];
          }
        }

        console.log(`✅ Fetched pages ${chunk[0]}-${chunk[chunk.length - 1]} of ${total_pages}`);
      }
    }

    const productPages: MetadataRoute.Sitemap = allProducts.map((product) => ({
      url: `${baseUrl}/prodotto/${product.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    // Ottieni tutte le categorie
    let categories: Category[] = [];
    try {
      console.log('🔍 Fetching categories...');
      categories = await getCategories();
      console.log(`✅ Received ${categories.length} categories`);
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
    }

    const categoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
      url: `${baseUrl}/category/${category.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    console.log(`✅ Sitemap generated: ${allProducts.length} products, ${categories.length} categories, ${staticPages.length} static pages = TOTAL: ${allProducts.length + categories.length + staticPages.length} URLs`);

    // Combina tutte le pagine
    return [...staticPages, ...productPages, ...categoryPages];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    // Se c'è un errore, restituisci almeno le pagine statiche
    return staticPages;
  }
}
