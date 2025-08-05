# DreamShop Deferred Shipping Plugin

Plugin WordPress per gestire la spedizione posticipata per prodotti con costi di spedizione variabili.

## Funzionalità

### Admin
- **Gestione Prodotti**: Aggiungi/rimuovi prodotti dalla lista spedizione posticipata
- **Calcolo Spedizione**: Inserisci importi di spedizione quando disponibili
- **Creazione Ordini**: Genera automaticamente ordini di spedizione per i clienti
- **Invio Email**: Notifica automatica ai clienti quando la spedizione è pronta

### Cliente
- **Ordini Separati**: Ordine principale + ordine spedizione separato
- **Email Notifiche**: Ricevi email quando la spedizione è pronta da pagare
- **Pagamento Flessibile**: Paga la spedizione quando conveniente

## Workflow

1. **Setup**: Admin aggiunge prodotti alla lista spedizione posticipata
2. **Ordine**: Cliente ordina prodotto (spedizione €0 o simbolica)
3. **Calcolo**: Admin inserisce costo spedizione reale quando disponibile
4. **Notifica**: Sistema crea ordini spedizione e invia email ai clienti
5. **Pagamento**: Cliente paga spedizione tramite link nell'email
6. **Completamento**: Spedizione marcata come pagata, pronto per spedire

## Struttura Database

### wp_deferred_shipping_products
```sql
- id (int, auto_increment)
- product_id (int, unique)
- shipping_amount (decimal)
- status (enum: 'pending', 'calculated')
- created_at (datetime)
- updated_at (datetime)
```

### wp_deferred_shipping_orders
```sql
- id (int, auto_increment)
- original_order_id (int)
- shipping_order_id (int)
- product_id (int)
- customer_id (int)
- shipping_amount (decimal)
- status (enum: 'pending', 'paid', 'cancelled')
- created_at (datetime)
- updated_at (datetime)
```

## Installazione

1. Copia la cartella del plugin in `wp-content/plugins/`
2. Attiva il plugin dal pannello WordPress
3. Vai su "Spedizione Posticipata" nel menu admin

## Utilizzo

### Aggiungere un Prodotto
1. Vai su "Spedizione Posticipata" nell'admin
2. Cerca e seleziona il prodotto
3. Clicca "Aggiungi Prodotto"

### Calcolare la Spedizione
1. Quando la merce arriva, inserisci l'importo di spedizione
2. Clicca "Salva" per aggiornare lo stato
3. Clicca "Crea Ordini Spedizione" per processare tutti gli ordini

### Gestire i Pagamenti
- Gli ordini di spedizione seguono il normale workflow WooCommerce
- Quando pagati, lo stato viene aggiornato automaticamente
- Gli ordini originali ricevono note di aggiornamento

## Personalizzazioni

### Template Email
Il template email può essere personalizzato modificando il metodo `get_email_template()` nella classe `DreamShop_Deferred_Shipping_Emails`.

### URL Pagamento
Di default usa il sistema di pagamento WooCommerce, ma può essere personalizzato per puntare al frontend custom.

## API Endpoints (Futuri)
- `GET /wp-json/deferred-shipping/v1/orders/{user_id}` - Ordini spedizione utente
- `GET /wp-json/deferred-shipping/v1/order/{order_id}` - Dettagli ordine specifico
- `POST /wp-json/deferred-shipping/v1/pay/{order_id}` - Processa pagamento

## Requisiti
- WordPress 5.0+
- WooCommerce 5.0+
- PHP 7.4+

## Supporto
Per supporto e personalizzazioni, contatta il team DreamShop.