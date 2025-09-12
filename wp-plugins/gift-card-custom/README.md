# Gift Card Custom - Plugin WordPress

Plugin personalizzato per gestire gift card in WooCommerce con sistema di saldo utente e generazione coupon on-demand.

## Funzionalità Principali

### 🎁 Sistema Gift Card
- Prodotti variabili per diversi tagli di gift card
- Accredito automatico del saldo al completamento dell'ordine
- Sistema di saldo centralizzato per utente

### 💳 Gestione Coupon
- Generazione coupon on-demand dal saldo disponibile
- Validazione automatica dei coupon nel checkout
- Sistema di scadenza personalizzabile

### 📊 API REST
- Endpoint completi per integrazione con frontend NextJS
- Sicurezza e autenticazione utente
- Gestione errori e validazioni

### 📱 Frontend Integration
- Shortcode per visualizzazione saldo
- Widget per generazione coupon
- Storico transazioni utente

## Struttura del Plugin

```
gift-card-custom/
├── gift-card-custom.php          # File principale del plugin
├── includes/
│   ├── class-database.php        # Gestione database e transazioni
│   ├── class-api.php             # Endpoint API REST
│   ├── class-woocommerce-integration.php  # Integrazione WooCommerce
│   └── class-gift-card-manager.php        # Manager gift card e UI
├── assets/
│   ├── js/frontend.js            # JavaScript frontend
│   └── css/frontend.css          # Stili CSS
└── README.md
```

## Installazione

1. Copia la cartella `gift-card-custom` in `wp-content/plugins/`
2. Attiva il plugin dal pannello di amministrazione WordPress
3. Il plugin creerà automaticamente le tabelle necessarie

## Configurazione Prodotto Gift Card

1. Crea un nuovo prodotto in WooCommerce
2. Nella sezione "Dati prodotto", seleziona "È una Gift Card"
3. Configura importi minimi/massimi e periodo di validità
4. Pubblica il prodotto

## API Endpoints

### Saldo Utente
```
GET /wp-json/gift-card/v1/balance/{user_id}
```

### Transazioni Utente
```
GET /wp-json/gift-card/v1/transactions/{user_id}?limit=50&offset=0
```

### Genera Coupon
```
POST /wp-json/gift-card/v1/generate-coupon
{
  "user_id": 123,
  "amount": 50.00
}
```

### Info Coupon
```
GET /wp-json/gift-card/v1/coupon/{coupon_code}
```

### Valida Coupon
```
POST /wp-json/gift-card/v1/validate-coupon
{
  "coupon_code": "GC123ABC",
  "cart_total": 100.00
}
```

## Shortcodes

### Saldo Gift Card
```
[gift_card_balance]
```
Mostra il saldo corrente e il form per generare coupon.

### Storico Transazioni
```
[gift_card_history limit="10"]
```
Mostra le ultime transazioni gift card dell'utente.

## Database Schema

### gift_card_balances
- `id` - ID univoco
- `user_id` - ID utente WordPress
- `balance` - Saldo attuale
- `created_at`, `updated_at` - Timestamp

### gift_card_transactions
- `id` - ID univoco
- `user_id` - ID utente
- `amount` - Importo transazione
- `type` - 'credit' o 'debit'
- `description` - Descrizione
- `order_id` - ID ordine WooCommerce
- `coupon_code` - Codice coupon generato
- `created_at` - Timestamp

### gift_card_coupons
- `id` - ID univoco
- `user_id` - ID utente
- `coupon_code` - Codice coupon univoco
- `amount` - Valore coupon
- `status` - 'active', 'used', 'expired'
- `expires_at` - Data scadenza
- `created_at`, `used_at` - Timestamp

## Integrazione Frontend NextJS

### Esempio chiamata API saldo
```javascript
const fetchBalance = async (userId) => {
  const response = await fetch(`/wp-json/gift-card/v1/balance/${userId}`, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });
  return response.json();
};
```

### Esempio generazione coupon
```javascript
const generateCoupon = async (userId, amount) => {
  const response = await fetch('/wp-json/gift-card/v1/generate-coupon', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ user_id: userId, amount: amount })
  });
  return response.json();
};
```

## Sicurezza

- Autenticazione utente obbligatoria per operazioni sensibili
- Validazione importi e permessi
- Sanitizzazione input
- Nonce per protezione CSRF
- Transazioni atomiche per consistenza dati

## Hook WordPress Utilizzati

- `woocommerce_order_status_completed` - Accredito saldo post-acquisto
- `woocommerce_coupon_loaded` - Caricamento coupon personalizzati
- `rest_api_init` - Registrazione endpoint API
- `wp_enqueue_scripts` - Caricamento assets frontend

## Requisiti

- WordPress 5.0+
- WooCommerce 3.0+
- PHP 7.4+
- MySQL 5.6+

## Supporto

Per problemi o domande, consulta la documentazione o contatta lo sviluppatore.