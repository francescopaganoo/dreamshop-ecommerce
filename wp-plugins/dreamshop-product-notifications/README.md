# DreamShop Product Notifications

Plugin WordPress per gestire le notifiche di disponibilità prodotti.

## Funzionalità

- ✅ **Iscrizioni**: Gli utenti possono iscriversi per ricevere notifiche quando un prodotto torna disponibile
- ✅ **Monitoraggio automatico**: Controlla automaticamente quando i prodotti tornano in stock
- ✅ **Email automatiche**: Invia email personalizzate agli utenti iscritti
- ✅ **Pannello admin**: Gestisci tutte le iscrizioni dal pannello WordPress
- ✅ **API REST**: Endpoint per l'integrazione con il frontend Next.js
- ✅ **Disiscrizione**: Link sicuri per la disiscrizione dalle notifiche

## Installazione

1. Carica la cartella del plugin in `/wp-content/plugins/`
2. Attiva il plugin dal pannello WordPress
3. Configura le impostazioni in "Notifiche Prodotti" > "Impostazioni"

## API Endpoints

### POST /wp-json/dspn/v1/subscribe
Iscrive un utente alle notifiche per un prodotto.

**Parametri:**
- `email` (string, richiesto): Email dell'utente
- `product_id` (int, richiesto): ID del prodotto WooCommerce  
- `customer_name` (string, opzionale): Nome del cliente

### POST /wp-json/dspn/v1/unsubscribe  
Disiscrive un utente dalle notifiche per un prodotto.

**Parametri:**
- `email` (string, richiesto): Email dell'utente
- `product_id` (int, richiesto): ID del prodotto WooCommerce

### GET /wp-json/dspn/v1/check-subscription
Controlla lo stato dell'iscrizione.

**Parametri:**
- `email` (string, richiesto): Email dell'utente  
- `product_id` (int, richiesto): ID del prodotto WooCommerce

## Integrazione Frontend

Per integrare con il frontend Next.js, utilizzare gli endpoint API sopra descritti. Esempio:

```javascript
// Iscrizione
const response = await fetch('/wp-json/dspn/v1/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    product_id: 123,
    customer_name: 'Mario Rossi'
  })
});

const result = await response.json();
```

## Database

Il plugin crea la tabella `wp_dspn_notifications` con i seguenti campi:

- `id`: ID univoco della notifica
- `email`: Email dell'utente
- `product_id`: ID del prodotto WooCommerce
- `customer_name`: Nome del cliente (opzionale)
- `created_at`: Data di creazione dell'iscrizione
- `notified_at`: Data di invio della notifica
- `status`: Stato (pending, notified, cancelled)

## Personalizzazione Email

Il template email supporta i seguenti placeholder:

- `{customer_name}`: Nome del cliente
- `{product_name}`: Nome del prodotto
- `{product_url}`: URL del prodotto
- `{product_price}`: Prezzo del prodotto
- `{shop_name}`: Nome del negozio
- `{shop_url}`: URL del sito
- `{unsubscribe_url}`: Link per la disiscrizione

## Sicurezza

- Tutti gli input sono sanitizzati
- Token sicuri per i link di disiscrizione
- Controlli di permessi per le azioni admin
- Prevenzione accesso diretto ai file PHP