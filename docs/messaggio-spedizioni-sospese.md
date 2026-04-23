# Messaggio "Spedizioni sospese" nel carrello

Guida per **attivare** o **disattivare** il messaggio che appare nel carrello per i prodotti delle categorie **ITALIA** ed **Editoria** (esclusi i Pre-Order):

> "Spedizioni per questo prodotto sospese fino al DD/MM per evento; previa disponibilità."

File interessato: `src/app/cart/page.tsx`

Ci sono **4 blocchi** da commentare/decommentare insieme.

---

## Come disattivare il messaggio

Ri-commentare tutti e 4 i blocchi elencati sotto. In VSCode: seleziona il blocco e premi `Cmd + /` (o `Cmd + Shift + /` per commento a blocco `/* */`).

### Blocco 1 — Funzione `getAttribute` (~righe 64-94)

Avvolgi l'intera funzione con `/* ... */`:

```ts
/* const getAttribute = (product: CartProduct, name: string): { name: string; slug: string } | undefined => {
  // ...contenuto funzione...
}; */
```

### Blocco 2 — Funzione `shouldShowShippingSuspendedMessage` (~righe 97-122)

Avvolgi l'intera funzione con `/* ... */`:

```ts
/* const shouldShowShippingSuspendedMessage = (product: CartProduct): boolean => {
  // ...contenuto funzione...
}; */
```

### Blocco 3 — Messaggio vista mobile (~righe 683-687)

Dentro `enrichedCart.map(...)` nella sezione `lg:hidden`, avvolgi il blocco JSX con `{/* ... */}`:

```tsx
{/* {shouldShowShippingSuspendedMessage(item.product) && (
  <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mb-2">
    Spedizioni per questo prodotto sospese fino al 11/04 per evento; previa disponibilità.
  </div>
)} */}
```

### Blocco 4 — Messaggio vista desktop (~righe 852-856)

Dentro la `<table>` nella sezione `hidden lg:block`, avvolgi il blocco JSX con `{/* ... */}`:

```tsx
{/* {shouldShowShippingSuspendedMessage(item.product) && (
  <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mt-2 inline-block">
    Spedizioni per questo prodotto sospese fino al 11/04 per evento; previa disponibilità.
  </div>
)} */}
```

> **Nota**: se commenti solo i blocchi JSX (3 e 4) senza commentare anche le funzioni (1 e 2), TypeScript darà un hint "dichiarata ma mai letta" (non bloccante). Per pulizia, commenta tutti e 4 i blocchi.

---

## Come riattivare il messaggio

Rimuovi i commenti dai 4 blocchi (togli `/* */` e `{/* */}`).

**Prima di riattivare, aggiorna la data** nei blocchi 3 e 4: cerca la stringa `fino al DD/MM` e sostituiscila con la data corretta (es. `11/04`). La data deve essere **identica in entrambi i blocchi**.

---

## Logica di filtro

Il messaggio viene mostrato solo quando **entrambe** queste condizioni sono vere:

1. Il prodotto appartiene alla categoria `italia` **o** `editoria` (match per `slug` o `name`).
2. Il prodotto **non** è in Pre-Order (attributo `pa_disponibilita` non contiene "pre-order" / "preorder").

Per cambiare categorie o regole, modifica la funzione `shouldShowShippingSuspendedMessage` in `src/app/cart/page.tsx`.
