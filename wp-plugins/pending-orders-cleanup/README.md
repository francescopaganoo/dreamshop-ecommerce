# DreamShop Pending Orders Cleanup

Plugin WordPress per cancellare automaticamente gli ordini WooCommerce in attesa di pagamento dopo un timeout configurabile.

## Funzionalità

### ✅ Pulizia Automatica
- Cancellazione automatica ordini in attesa dopo timeout configurabile (default: 3 ore)
- Supporto per stati: `pending`, `on-hold`, `failed`
- Cron job WordPress che si esegue ogni ora

### ✅ Pannello Admin
- Configurazione timeout cancellazione (1-168 ore)
- Selezione stati ordini da monitorare
- Abilitazione/disabilitazione logging
- Esecuzione manuale pulizia

### ✅ Sistema di Logging
- Log dettagliato di ogni ordine cancellato
- Tracciamento informazioni cliente (ID, email, nome, tipo)
- Statistiche di utilizzo e performance

### ✅ Analisi Clienti
- Distinzione tra clienti registrati e ospiti
- Identificazione utenti con abbandoni frequenti (≥3 ordini)
- Percentuali e statistiche per ottimizzazione

## Installazione

1. Copia la cartella del plugin in `wp-content/plugins/`
2. Attiva il plugin dalla dashboard WordPress
3. Vai in **Impostazioni > Pulizia Ordini** per configurare

## Configurazione

### Impostazioni Base
- **Timeout**: Numero di ore dopo cui cancellare ordini (default: 3)
- **Stati**: Seleziona quali stati monitorare
- **Logging**: Abilita/disabilita il sistema di log

### Statistiche e Monitoraggio
- Visualizza ordini cancellati per data
- Analizza pattern di abbandono clienti
- Identifica utenti problematici

## Sicurezza

- ✅ Verifica permessi admin per tutte le operazioni
- ✅ Nonce WordPress per protezione CSRF
- ✅ Sanitizzazione input utente
- ✅ Controlli validazione dati

## Compatibilità

- **WordPress**: 5.6+
- **PHP**: 7.4+
- **WooCommerce**: 5.0+

## Logs

I log del plugin sono visibili in:
- WordPress error log (per debug tecnico)
- Pannello admin plugin (per analisi business)

## Supporto

Per supporto contattare il team DreamShop.

---

**Versione**: 1.0.0  
**Autore**: DreamShop  
**Licenza**: GPL v2 or later