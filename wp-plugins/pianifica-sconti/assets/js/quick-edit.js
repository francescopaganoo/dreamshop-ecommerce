jQuery(document).ready(function($) {
    // Debug function
    function debugLog(message) {
        if (typeof console !== 'undefined' && console.log) {
            console.log('WC Schedule Sale Quick Edit: ' + message);
        }
    }
    
    // Intercetta il click sul pulsante "Modifica rapida"
    $('#the-list').on('click', '.editinline', function() {
        var $row = $(this).closest('tr');
        var post_id = $row.attr('id').replace('post-', '');
        
        debugLog('Modifica rapida per prodotto ID: ' + post_id);
        
        // Attende che la riga di modifica sia completamente caricata
        setTimeout(function() {
            var $edit_row = $('#edit-' + post_id);
            
            if ($edit_row.length === 0) {
                debugLog('Riga di modifica non trovata per ID: ' + post_id);
                return;
            }
            
            // Cerca i dati nascosti in modi diversi per maggiore compatibilità
            var $data = $('#wc_schedule_sale_data_' + post_id);
            
            // Se non trova con il primo metodo, prova nella riga originale
            if ($data.length === 0) {
                $data = $row.find('.wc-schedule-sale-data');
                debugLog('Tentativo alternativo di ricerca dati...');
            }
            
            // Se ancora non trova, cerca in tutta la pagina
            if ($data.length === 0) {
                $data = $('.wc-schedule-sale-data[id*="' + post_id + '"]');
                debugLog('Ricerca globale dei dati...');
            }
            
            if ($data.length > 0) {
                var sale_price = $data.find('.sale_price').text().trim();
                var sale_date_from = $data.find('.sale_date_from').text().trim();
                var sale_date_to = $data.find('.sale_date_to').text().trim();
                
                debugLog('Dati trovati nel DOM - Prezzo: "' + sale_price + '", Da: "' + sale_date_from + '", A: "' + sale_date_to + '"');
                
                populateFields($edit_row, sale_price, sale_date_from, sale_date_to);
                
            } else if (typeof window.wcScheduleSaleData !== 'undefined' && window.wcScheduleSaleData[post_id]) {
                // Usa i dati dal footer se disponibili
                var data = window.wcScheduleSaleData[post_id];
                debugLog('Dati trovati nel footer - Prezzo: "' + data.sale_price + '", Da: "' + data.sale_date_from + '", A: "' + data.sale_date_to + '"');
                
                populateFields($edit_row, data.sale_price, data.sale_date_from, data.sale_date_to);
                
            } else {
                debugLog('Nessun dato trovato, provo con AJAX per il prodotto ' + post_id);
                // Proviamo a cercare i dati direttamente dai meta del prodotto usando AJAX
                populateFieldsViaAjax(post_id, $edit_row);
            }
            
            // Gestisce la checkbox "Cancella pianificazione sconto"
            $edit_row.find('input[name="_clear_sale_schedule_quick"]').off('change.wc-schedule').on('change.wc-schedule', function() {
                if ($(this).is(':checked')) {
                    $edit_row.find('input[name="_sale_price_quick"]').val('').prop('disabled', true);
                    $edit_row.find('input[name="_sale_price_dates_from_quick"]').val('').prop('disabled', true);
                    $edit_row.find('input[name="_sale_price_dates_to_quick"]').val('').prop('disabled', true);
                    debugLog('Pianificazione sconto disabilitata');
                } else {
                    $edit_row.find('input[name="_sale_price_quick"]').prop('disabled', false);
                    $edit_row.find('input[name="_sale_price_dates_from_quick"]').prop('disabled', false);
                    $edit_row.find('input[name="_sale_price_dates_to_quick"]').prop('disabled', false);
                    debugLog('Pianificazione sconto riabilitata');
                }
            });
            
            // Validazione: controlla che la data di fine sia successiva a quella di inizio
            $edit_row.find('input[name="_sale_price_dates_from_quick"], input[name="_sale_price_dates_to_quick"]').off('change.wc-schedule').on('change.wc-schedule', function() {
                var date_from = $edit_row.find('input[name="_sale_price_dates_from_quick"]').val();
                var date_to = $edit_row.find('input[name="_sale_price_dates_to_quick"]').val();
                
                if (date_from && date_to && new Date(date_from) >= new Date(date_to)) {
                    alert('La data di fine sconto deve essere successiva alla data di inizio.');
                    $(this).focus();
                    return false;
                }
                
                debugLog('Validazione date OK - Da: ' + date_from + ', A: ' + date_to);
            });
            
            // Validazione: se c'è un prezzo scontato, deve essere inferiore al prezzo regolare
            $edit_row.find('input[name="_sale_price_quick"]').off('blur.wc-schedule').on('blur.wc-schedule', function() {
                var sale_price = parseFloat($(this).val());
                var regular_price = parseFloat($edit_row.find('input[name="_regular_price"]').val());
                
                if (sale_price && regular_price && sale_price >= regular_price) {
                    alert('Il prezzo scontato deve essere inferiore al prezzo regolare.');
                    $(this).focus();
                    return false;
                }
                
                if (sale_price && regular_price) {
                    debugLog('Validazione prezzo OK - Regolare: ' + regular_price + ', Scontato: ' + sale_price);
                }
            });
            
            // Gestione eventi per logging aggiuntivo
            $edit_row.find('input[name="_sale_price_quick"]').off('input.wc-schedule').on('input.wc-schedule', function() {
                debugLog('Prezzo scontato modificato: ' + $(this).val());
            });
            
            $edit_row.find('input[name="_sale_price_dates_from_quick"]').off('change.wc-schedule-date').on('change.wc-schedule-date', function() {
                debugLog('Data inizio modificata: ' + $(this).val());
            });
            
            $edit_row.find('input[name="_sale_price_dates_to_quick"]').off('change.wc-schedule-date').on('change.wc-schedule-date', function() {
                debugLog('Data fine modificata: ' + $(this).val());
            });
            
        }, 150); // Aumentato il timeout per dare più tempo al caricamento
    });
    
    // Funzione helper per popolare i campi
    function populateFields($edit_row, sale_price, sale_date_from, sale_date_to) {
        try {
            if (sale_price && sale_price.toString().trim() !== '') {
                $edit_row.find('input[name="_sale_price_quick"]').val(sale_price);
                debugLog('Prezzo scontato popolato: ' + sale_price);
            }
            
            if (sale_date_from && sale_date_from.toString().trim() !== '') {
                $edit_row.find('input[name="_sale_price_dates_from_quick"]').val(sale_date_from);
                debugLog('Data inizio popolata: ' + sale_date_from);
            }
            
            if (sale_date_to && sale_date_to.toString().trim() !== '') {
                $edit_row.find('input[name="_sale_price_dates_to_quick"]').val(sale_date_to);
                debugLog('Data fine popolata: ' + sale_date_to);
            }
            
            debugLog('Popolamento campi completato con successo');
        } catch (error) {
            debugLog('Errore nel popolamento campi: ' + error.message);
        }
    }
    
    // Funzione per recuperare i dati via AJAX se non trovati nel DOM
    function populateFieldsViaAjax(post_id, $edit_row) {
        // Verifica che ajaxurl sia disponibile
        if (typeof ajaxurl === 'undefined') {
            debugLog('AJAX URL non disponibile, impossibile recuperare i dati');
            return;
        }
        
        // Verifica che ci sia un nonce disponibile
        var nonce = '';
        if (typeof woocommerce_admin_meta_boxes !== 'undefined' && woocommerce_admin_meta_boxes.quick_edit_nonce) {
            nonce = woocommerce_admin_meta_boxes.quick_edit_nonce;
        } else {
            debugLog('Nonce non disponibile, impossibile fare richiesta AJAX sicura');
            return;
        }
        
        debugLog('Tentativo di recupero dati via AJAX per prodotto ' + post_id);
        
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'get_product_schedule_sale_data',
                product_id: post_id,
                nonce: nonce
            },
            timeout: 10000, // 10 secondi di timeout
            success: function(response) {
                debugLog('Risposta AJAX ricevuta: ' + JSON.stringify(response));
                
                if (response.success && response.data) {
                    debugLog('Dati ricevuti via AJAX - Prezzo: "' + response.data.sale_price + '", Da: "' + response.data.sale_date_from + '", A: "' + response.data.sale_date_to + '"');
                    populateFields($edit_row, response.data.sale_price, response.data.sale_date_from, response.data.sale_date_to);
                } else {
                    debugLog('Risposta AJAX non contiene dati validi');
                }
            },
            error: function(xhr, status, error) {
                debugLog('Errore AJAX: ' + status + ' - ' + error);
            }
        });
    }
    
    // Gestisce il salvataggio per includere i nostri campi personalizzati
    $(document).on('click', '.quick-edit-save .save', function() {
        var $edit_row = $(this).closest('tr');
        var $form = $edit_row.find('form');
        var post_id = $edit_row.attr('id').replace('edit-', '');
        
        debugLog('Salvataggio modifica rapida per prodotto: ' + post_id);
        
        // Log dei valori che stiamo per salvare
        var sale_price = $edit_row.find('input[name="_sale_price_quick"]').val();
        var date_from = $edit_row.find('input[name="_sale_price_dates_from_quick"]').val();
        var date_to = $edit_row.find('input[name="_sale_price_dates_to_quick"]').val();
        var clear_schedule = $edit_row.find('input[name="_clear_sale_schedule_quick"]').is(':checked');
        
        debugLog('Valori da salvare - Prezzo: "' + sale_price + '", Da: "' + date_from + '", A: "' + date_to + '", Cancella: ' + clear_schedule);
        
        // Assicurati che i nostri campi siano inclusi nel form
        var nonce_value = '';
        
        // Cerca il nonce esistente di WooCommerce
        var $existing_nonce = $form.find('input[name="woocommerce_quick_edit_nonce"]');
        if ($existing_nonce.length) {
            nonce_value = $existing_nonce.val();
            debugLog('Nonce trovato nel form: ' + nonce_value.substring(0, 10) + '...');
        } else {
            // Fallback - usa il nonce globale se disponibile
            if (typeof woocommerce_admin_meta_boxes !== 'undefined' && woocommerce_admin_meta_boxes.quick_edit_nonce) {
                nonce_value = woocommerce_admin_meta_boxes.quick_edit_nonce;
                $form.append('<input type="hidden" name="woocommerce_quick_edit_nonce" value="' + nonce_value + '" />');
                debugLog('Nonce aggiunto al form: ' + nonce_value.substring(0, 10) + '...');
            } else {
                debugLog('Attenzione: Nessun nonce disponibile');
            }
        }
        
        // Validazione finale prima del salvataggio
        if (date_from && date_to && new Date(date_from) >= new Date(date_to)) {
            alert('Errore: La data di fine sconto deve essere successiva alla data di inizio.');
            return false;
        }
        
        var sale_price_num = parseFloat(sale_price);
        var regular_price_num = parseFloat($edit_row.find('input[name="_regular_price"]').val());
        
        if (sale_price_num && regular_price_num && sale_price_num >= regular_price_num) {
            alert('Errore: Il prezzo scontato deve essere inferiore al prezzo regolare.');
            return false;
        }
        
        debugLog('Validazione finale OK, procedendo con il salvataggio...');
    });
    
    // Log quando la pagina è completamente caricata
    debugLog('Plugin JavaScript inizializzato correttamente');
    
    // Debug: mostra i dati disponibili nella finestra globale
    if (typeof window.wcScheduleSaleData !== 'undefined') {
        debugLog('Dati globali disponibili per ' + Object.keys(window.wcScheduleSaleData).length + ' prodotti');
    }
    
    // Debug: verifica se ajaxurl è disponibile
    if (typeof ajaxurl !== 'undefined') {
        debugLog('AJAX URL disponibile: ' + ajaxurl);
    } else {
        debugLog('Attenzione: AJAX URL non disponibile');
    }
    
    // Debug: verifica se i nonce sono disponibili
    if (typeof woocommerce_admin_meta_boxes !== 'undefined' && woocommerce_admin_meta_boxes.quick_edit_nonce) {
        debugLog('Nonce WooCommerce disponibile');
    } else {
        debugLog('Attenzione: Nonce WooCommerce non disponibile');
    }
});

// Parametri globali (non più necessari, usiamo i nonce esistenti di WooCommerce)