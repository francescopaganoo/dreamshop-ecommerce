# DreamShop Advanced Filters

Plugin WordPress personalizzato per filtri avanzati di prodotti WooCommerce con performance ottimizzate.

## Caratteristiche

- **Filtri Combinati**: Categoria, Brand, Disponibilità, Tempistiche di spedizione, Prezzo
- **Performance Ottimizzate**: Query SQL dirette invece di API multiple
- **Caching Intelligente**: Cache multi-livello per prestazioni superiori
- **API REST Custom**: Endpoint unificato per tutti i filtri
- **Debug Tools**: Endpoint per analizzare la struttura dei prodotti

## Installazione

1. Copiare la cartella del plugin in `wp-content/plugins/`
2. Attivare il plugin dal pannello di amministrazione WordPress
3. Assicurarsi che WooCommerce sia attivo

## Endpoint API

### `/wp-json/dreamshop/v1/products/filter`

Endpoint principale per il filtering dei prodotti.

**Parametri:**
- `category` (string): Slug della categoria
- `brands` (string): Slug dei brand separati da virgola
- `availability` (string): Opzioni disponibilità separate da virgola
- `shipping` (string): Opzioni spedizione separate da virgola
- `min_price` (number): Prezzo minimo
- `max_price` (number): Prezzo massimo
- `page` (integer): Numero pagina (default: 1)
- `per_page` (integer): Prodotti per pagina (default: 12, max: 100)
- `orderby` (string): Campo ordinamento (date, title, price)
- `order` (string): Direzione ordinamento (ASC, DESC)

**Esempio:**
```
GET /wp-json/dreamshop/v1/products/filter?category=action-figures&brands=bandai,good-smile&min_price=10&max_price=100&page=1&per_page=12
```

### `/wp-json/dreamshop/v1/filter-options`

Ottiene tutte le opzioni disponibili per i filtri.

**Risposta:**
```json
{
  "success": true,
  "data": {
    "brands": [...],
    "categories": [...],
    "availability": [...],
    "shipping_times": [...],
    "price_range": {"min": 0, "max": 1000}
  }
}
```

### `/wp-json/dreamshop/v1/products/{id}`

Ottiene i dettagli completi di un prodotto.

### `/wp-json/dreamshop/v1/debug/product/{id}`

**Debug endpoint** - Mostra la struttura completa di un prodotto per capire come sono organizzati gli attributi.

## Utilizzo nel Frontend

Per utilizzare il plugin nel frontend Next.js, aggiornare le chiamate API da:

```javascript
// Vecchio
const response = await getProductsByBrandSlugsOptimized(brands, page, perPage);

// Nuovo
const response = await fetch('/wp-json/dreamshop/v1/products/filter?' + new URLSearchParams({
  brands: brands.join(','),
  page: page,
  per_page: perPage
}));
```

## Cache

Il plugin implementa un sistema di cache a due livelli:
1. **Object Cache** (Redis/Memcached se disponibili)
2. **Transient Cache** (fallback nel database)

I cache scadono automaticamente dopo 5-15 minuti a seconda del tipo di dato.

## Debug

Per analizzare la struttura di un prodotto specifico:

```
GET /wp-json/dreamshop/v1/debug/product/175890
```

Questo endpoint mostrerà:
- Tutti i meta fields del prodotto
- Tutte le tassonomie associate
- Struttura degli attributi WooCommerce
- Categorie e brand

## Performance

Il plugin sostituisce multiple chiamate API con una singola query SQL ottimizzata, riducendo drasticamente i tempi di caricamento per siti con molti prodotti.

## Supporto

Per problemi o domande, consultare i log di WordPress in `/wp-content/debug.log` (se WP_DEBUG è attivo).