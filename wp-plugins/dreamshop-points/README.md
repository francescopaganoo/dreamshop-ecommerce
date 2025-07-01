# DreamShop Points

Plugin WordPress per la gestione dei punti fedeltà in WooCommerce per DreamShop.

## Funzionalità

- **Attribuzione automatica dei punti**: Gli utenti guadagnano punti quando completano un ordine (1 punto per ogni euro di default)
- **Riscatto punti**: Gli utenti possono utilizzare i loro punti per ottenere sconti sugli ordini
- **Cronologia punti**: Tracciamento di tutte le transazioni di punti (guadagnati e riscattati)
- **Gestione punti da backend**: Gli amministratori possono visualizzare, aggiungere o rimuovere punti manualmente
- **Impostazioni configurabili**: Rapporto di guadagno punti, valore di riscatto, punti minimi per il riscatto, ecc.
- **API REST**: Integrazione con il frontend tramite REST API

## Installazione

1. Carica la cartella `dreamshop-points` nella directory `/wp-content/plugins/` del tuo WordPress
2. Attiva il plugin attraverso il menu 'Plugin' in WordPress
3. Configura le impostazioni da "Punti Fedeltà > Impostazioni"

## API Endpoints

Il plugin espone i seguenti endpoint REST API:

- `GET /dreamshop/v1/points/user` - Ottiene i punti dell'utente corrente e la sua cronologia
- `POST /dreamshop/v1/points/add` - Aggiunge punti all'utente (richiede autenticazione)
- `POST /dreamshop/v1/points/redeem` - Riscatta punti dell'utente (richiede autenticazione)

## Integrazione con il frontend Next.js

Il plugin è stato progettato per funzionare con il frontend Next.js di DreamShop. 
Gli endpoint API forniscono tutte le funzionalità necessarie per:

1. Visualizzare il saldo punti nella pagina account
2. Visualizzare la cronologia dei punti
3. Guadagnare punti dopo il completamento di un ordine
4. Utilizzare i punti durante il checkout per ottenere sconti

## Requisiti

- WordPress 5.8+
- WooCommerce 5.0+
- PHP 7.4+
