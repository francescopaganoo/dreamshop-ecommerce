=== WooCommerce Brand Attribute Migrator ===
Contributors: codex-cli
Tags: woocommerce, brands, migration
Requires at least: 6.0
Tested up to: 6.6
Stable tag: 1.0.0
License: GPLv2 or later

Migra l'attributo prodotto "brand" (tipicamente `pa_brand`) verso la taxonomy Marchi (default `product_brand`).

== Descrizione ==

Questo plugin copia tutti i termini dell'attributo "brand" in Marchi e assegna i prodotti ai relativi marchi corrispondenti. Utile per passare da un attributo personalizzato ai Marchi del tuo plugin di brands.

Per impostazione predefinita, la taxonomy target è `product_brand` (usata da WooCommerce Brands ufficiale). Se usi un altro plugin, imposta lo slug corretto (es. Perfect WooCommerce Brands usa `pwb-brand`).

== Requisiti ==

- WooCommerce attivo
- La taxonomy target dei Marchi deve essere registrata (dal tuo plugin Brands)

== Utilizzo ==

1. Copia la cartella `wc-attribute-brands-migrator` in `wp-content/plugins/`
2. Attiva il plugin da Plugin > Plugin installati
3. Vai in Strumenti > Migra Brand → Marchi
4. Facoltativo: imposta un limite di prodotti da migrare (es. 1 per test)
5. Verifica sorgente e target e clicca "Esegui migrazione"

== Personalizzazione ==

Puoi filtrare gli slug delle taxonomy:

```
add_filter( 'wcabm_source_taxonomy', function( $slug ) {
    return 'pa_brand'; // o un altro attributo
});

add_filter( 'wcabm_target_taxonomy', function( $slug ) {
    return 'product_brand'; // es. 'pwb-brand' per Perfect WooCommerce Brands
});
```

== Note ==

- La migrazione è idempotente: può essere eseguita più volte senza duplicare termini.
- Non rimuove/azzera i marchi esistenti sui prodotti: aggiunge in append.
- Copia la descrizione del termine e, se presente, `thumbnail_id`.
