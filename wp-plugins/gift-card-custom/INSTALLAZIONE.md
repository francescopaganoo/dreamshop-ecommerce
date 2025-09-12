# Guida Installazione e Testing - Gift Card Plugin

## 🚨 **ERRORE RISOLTO** 
Ho corretto l'errore fatale che si verificava durante l'attivazione del plugin. Il problema era nel caricamento delle classi durante l'hook di attivazione.

## 📦 **Installazione Plugin WordPress**

### **Metodo 1: Upload Diretto**
1. Comprimi la cartella `gift-card-custom` in un file ZIP
2. Vai su **WordPress Admin → Plugin → Aggiungi nuovo → Carica Plugin**
3. Carica il file ZIP e attiva il plugin

### **Metodo 2: FTP/File Manager**
1. Copia la cartella `gift-card-custom` in `/wp-content/plugins/`
2. Vai su **WordPress Admin → Plugin** 
3. Attiva "Gift Card Custom"

### **Metodo 3: Versione Sicura (Consigliata)**
Se il plugin principale continua a dare problemi, usa il file `gift-card-custom-safe.php`:
1. Rinomina `gift-card-custom-safe.php` in `gift-card-custom.php`
2. Sostituisci il file principale
3. Attiva il plugin

## 🔧 **Configurazione Post-Installazione**

### **1. Verifica Installazione**
Dopo l'attivazione, controlla:
- **Plugin attivato** senza errori
- **Tabelle create** nel database:
  - `wp_gift_card_balances`
  - `wp_gift_card_transactions` 
  - `wp_gift_card_coupons`

### **2. Configura Prodotti Gift Card**
1. Vai su **Prodotti → Aggiungi nuovo**
2. Crea un prodotto (es. "Gift Card €50")
3. In **Dati prodotto**:
   - Spunta "**È una Gift Card**"
   - Configura il prezzo (€50.00)
   - Vai al tab "**Gift Card**":
     - Importo minimo: €10.00
     - Importo massimo: €500.00
     - Periodo validità: 1 Anno
4. **Pubblica** il prodotto

### **3. Test Debug (Opzionale)**
Esegui il file `debug.php` per verificare lo stato del plugin:
```php
// In un file temporaneo o via WP CLI
include_once 'wp-content/plugins/gift-card-custom/debug.php';
```

## 🧪 **Testing del Sistema**

### **Test 1: Acquisto Gift Card**
1. **Frontend**: Aggiungi gift card al carrello
2. **Checkout**: Completa l'acquisto come utente registrato
3. **Verifica**: L'ordine viene completato e il saldo accreditato

### **Test 2: Visualizzazione Saldo**
1. **Account Utente**: Vai su `/account?tab=gift-cards`
2. **Verifica**: Il saldo è visibile e aggiornato
3. **Test Refresh**: Il pulsante "Aggiorna" funziona

### **Test 3: Generazione Coupon**
1. **Da Account**: 
   - Inserisci importo → Genera Coupon
   - Copia il codice generato
2. **Da Carrello**: 
   - Widget gift card visibile se hai saldo
   - Genera coupon ottimale o personalizzato

### **Test 4: Utilizzo Coupon**
1. **Carrello**: Incolla il codice coupon
2. **Verifica**: Sconto applicato correttamente
3. **Checkout**: Completa l'ordine
4. **Verifica**: Coupon marcato come "utilizzato"

## 🔍 **Risoluzione Problemi**

### **Errore "Class not found"**
```bash
# Soluzione: Usa la versione sicura del plugin
# File: gift-card-custom-safe.php
```

### **Tabelle non create**
```sql
-- Verifica manualmente nel database
SHOW TABLES LIKE 'wp_gift_card_%';

-- Se mancanti, disattiva e riattiva il plugin
```

### **API non risponde**
```javascript
// Verifica URL in .env.local
NEXT_PUBLIC_WP_API_URL=https://be2.dreamshop18.com/wp-json

// Test endpoint
GET https://be2.dreamshop18.com/wp-json/gift-card/v1/balance/1
```

### **Frontend non mostra widget**
1. **Verifica autenticazione** utente
2. **Controlla console** browser per errori
3. **Verifica saldo** > 0 per mostrare widget carrello

## 📊 **Endpoint API Disponibili**

```bash
# Saldo utente
GET /wp-json/gift-card/v1/balance/{user_id}
Authorization: Bearer {token}

# Transazioni utente  
GET /wp-json/gift-card/v1/transactions/{user_id}
Authorization: Bearer {token}

# Genera coupon
POST /wp-json/gift-card/v1/generate-coupon
{
  "user_id": 123,
  "amount": 50.00
}

# Info coupon
GET /wp-json/gift-card/v1/coupon/{coupon_code}

# Valida coupon
POST /wp-json/gift-card/v1/validate-coupon
{
  "coupon_code": "GC123ABC", 
  "cart_total": 100.00
}
```

## ✅ **Checklist Testing Completo**

- [ ] Plugin installato e attivato
- [ ] Tabelle database create
- [ ] Prodotto gift card configurato
- [ ] Acquisto gift card completato
- [ ] Saldo accreditato correttamente
- [ ] Pagina account mostra sezione gift card
- [ ] Generazione coupon funziona
- [ ] Widget carrello mostra saldo
- [ ] Coupon applicato correttamente al checkout
- [ ] Sconto calcolato correttamente
- [ ] Ordine completato con coupon
- [ ] Storico transazioni aggiornato

## 📞 **Supporto**

Se riscontri problemi:
1. **Controlla log errori** WordPress
2. **Usa la versione sicura** del plugin  
3. **Verifica endpoint** API tramite browser
4. **Controlla permessi** file e cartelle

Il sistema è completo e pronto per l'uso! 🎉