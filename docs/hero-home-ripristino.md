# Hero Home — modifica temporanea e ripristino

Data modifica: 21 luglio 2026

## Cosa è stato fatto

Nella hero della home (`src/app/page.tsx`, sezione `{/* Testi sovrapposti */}`) sono stati
**commentati** (non eliminati):

- il titolo `Benvenuti su DreamShop`
- il sottotitolo `Scopri la nostra collezione esclusiva di statue, figure e trading card di anime e manga`
- i due pulsanti `Scopri il Catalogo` (`/products`) e `Offerte Speciali` (`/offerte`)

Al loro posto è stato inserito un unico pulsante temporaneo **"Dream Hot Deals"** che punta a
`/category/dream-hot-deals` (https://dreamshop18.com/category/dream-hot-deals).

## Il pulsante "che brucia"

Lo stile fuoco vive in `src/app/globals.css`, blocco `Pulsante "che brucia" — CTA hero Dream Hot Deals`
(classi `.btn-fire`, `.btn-fire__flames`, `.btn-fire__label` + keyframes `fire-*`).

Composizione dell'effetto:
- gradiente arancio/rosso che scorre in orizzontale (`fire-sweep`)
- `box-shadow` incandescente che pulsa (`fire-pulse`) e alone sfocato dietro (`fire-glow`)
- braci calde sulla superficie (`fire-embers`)
- 5 lingue di fuoco sfocate che salgono dal bordo, con durate e ritardi diversi così non vanno mai a
  tempo tra loro (`fire-lick`)
- con `prefers-reduced-motion: reduce` le animazioni si spengono e resta il solo gradiente statico

Per riusarlo altrove serve il markup completo (contenitore fiamme + label), vedi il commento in cima
al blocco CSS. Se il pulsante fuoco non serve più, si può cancellare l'intero blocco CSS.

## Come ripristinare

### Opzione A — ripristino completo dal backup (più veloce)

È stata salvata una copia integrale della home precedente:

```
src/app/page.backup-hero-originale.tsx.bak
```

Per ripristinare:

```bash
cd dreamshop-ecommerce
cp src/app/page.backup-hero-originale.tsx.bak src/app/page.tsx
```

> Nota: il file ha estensione `.bak` proprio per non essere compilato da Next.js come route.

### Opzione B — ripristino manuale

In `src/app/page.tsx` cerca il blocco:

```
HERO TESTUALE ORIGINALE - TEMPORANEAMENTE DISATTIVATO
```

1. Rimuovi i delimitatori del commento JSX (`{/* ... */}` con le righe di `====`) attorno al blocco originale.
2. Elimina il blocco successivo marcato `{/* CTA temporanea: Dream Hot Deals */}`.

## Se invece si vuole rendere definitiva la modifica

Eliminare il blocco commentato, il file `page.backup-hero-originale.tsx.bak` e questo documento.
