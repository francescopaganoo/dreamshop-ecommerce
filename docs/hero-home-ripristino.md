# Hero Home — modifica temporanea e ripristino

Data modifica: 21 luglio 2026

## Cosa è stato fatto

Nella hero della home (`src/app/page.tsx`, sezione `{/* Testi sovrapposti */}`) sono stati
**commentati** (non eliminati):

- il titolo `Benvenuti su DreamShop`
- il sottotitolo `Scopri la nostra collezione esclusiva di statue, figure e trading card di anime e manga`
- i due pulsanti `Scopri il Catalogo` (`/products`) e `Offerte Speciali` (`/offerte`)

Al loro posto è stato inserito un unico pulsante temporaneo:

```tsx
<Link href="/category/dream-hot-deals" ...>Dream Hot Deals</Link>
```

che punta a https://dreamshop18.com/category/dream-hot-deals

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
