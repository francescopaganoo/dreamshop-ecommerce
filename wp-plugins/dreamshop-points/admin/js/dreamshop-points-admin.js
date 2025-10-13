/**
 * Admin JavaScript for DreamShop Points Plugin
 */
(function($) {
    'use strict';

    $(document).ready(function() {
        // Gestione dell'aggiunta manuale dei punti nell'ordine
        $('#dreamshop-points-add-manually').on('click', function() {
            const button = $(this);
            const resultDiv = $('#dreamshop-points-add-result');
            const orderId = button.data('order-id');
            const userId = button.data('user-id');
            const points = button.data('points');

            button.prop('disabled', true).text('Elaborazione in corso...');

            // Invia la richiesta Ajax
            $.ajax({
                url: ajaxurl,
                type: 'POST',
                data: {
                    action: 'dreamshop_points_add_manually',
                    order_id: orderId,
                    user_id: userId,
                    points: points,
                    security: dreamshop_points_admin.nonce
                },
                success: function(response) {
                    if (response.success) {
                        resultDiv.removeClass('error').addClass('success').text(response.data.message).show();
                        // Aggiorna il pulsante
                        button.hide();
                    } else {
                        resultDiv.removeClass('success').addClass('error').text(response.data.message).show();
                        button.prop('disabled', false).text('Aggiungi punti manualmente');
                    }
                },
                error: function() {
                    resultDiv.removeClass('success').addClass('error').text('Si è verificato un errore durante la comunicazione con il server.').show();
                    button.prop('disabled', false).text('Aggiungi punti manualmente');
                }
            });
        });

        // Conferma operazioni di eliminazione
        $('.dreamshop-points-delete-confirm').on('click', function(e) {
            if (!confirm('Sei sicuro di voler eliminare questo record? Questa azione non può essere annullata.')) {
                e.preventDefault();
            }
        });

        // Gestione API Key
        $('input[name="api_key"]').on('select', function() {
            this.select();
        });

        // Copia API Key negli appunti
        $('<button type="button" class="button button-small" style="margin-left: 10px;">Copia</button>')
            .insertAfter('input[name="api_key"]')
            .on('click', function(e) {
                e.preventDefault();
                const apiKeyInput = $('input[name="api_key"]');
                apiKeyInput.select();
                document.execCommand('copy');
                
                const button = $(this);
                const originalText = button.text();
                button.text('Copiato!').addClass('button-primary');
                
                setTimeout(function() {
                    button.text(originalText).removeClass('button-primary');
                }, 2000);
            });

        // Evidenzia il campo API Key quando viene cliccato
        $('input[name="api_key"]').on('click', function() {
            $(this).select();
        });

        // Gestione ricerca utenti AJAX
        const searchInput = $('#dreamshop-points-search');
        const searchBtn = $('#dreamshop-points-search-btn');
        const resetBtn = $('#dreamshop-points-reset-btn');
        const searchSpinner = $('#dreamshop-points-search-spinner');
        const usersTable = $('#dreamshop-points-users-table');

        // Verifica se siamo nella pagina utenti
        if (searchInput.length === 0) {
            return;
        }

        let searchTimeout;

        // Funzione per eseguire la ricerca
        function performSearch(page) {
            const searchTerm = searchInput.val().trim();

            // Mostra lo spinner
            searchSpinner.addClass('is-active');
            searchBtn.prop('disabled', true);

            $.ajax({
                url: ajaxurl,
                type: 'POST',
                data: {
                    action: 'dreamshop_points_search_users',
                    search: searchTerm,
                    paged: page || 1,
                    nonce: dreamshop_points_admin.search_nonce
                },
                success: function(response) {
                    if (response.success) {
                        // Aggiorna la tabella
                        usersTable.html(response.data.table_html);

                        // Rimuovi la vecchia paginazione se esiste
                        $('.tablenav.bottom').remove();

                        // Aggiungi la nuova paginazione se presente
                        if (response.data.pagination_html) {
                            $(response.data.pagination_html).insertAfter(usersTable);

                            // Riattacca gli event handler ai link di paginazione
                            attachPaginationHandlers();
                        }

                        // Mostra/nascondi il pulsante reset
                        if (searchTerm) {
                            resetBtn.show();
                        } else {
                            resetBtn.hide();
                        }
                    } else {
                        alert('Errore durante la ricerca: ' + (response.data || 'Errore sconosciuto'));
                    }
                },
                error: function() {
                    alert('Errore durante la ricerca. Riprova.');
                },
                complete: function() {
                    searchSpinner.removeClass('is-active');
                    searchBtn.prop('disabled', false);
                }
            });
        }

        // Funzione per attaccare gli handler ai link di paginazione
        function attachPaginationHandlers() {
            $('.tablenav-pages a').on('click', function(e) {
                e.preventDefault();
                const url = $(this).attr('href');
                const page = new URLSearchParams(url.split('?')[1]).get('paged') || 1;
                performSearch(page);
            });
        }

        // Ricerca al click del pulsante
        searchBtn.on('click', function(e) {
            e.preventDefault();
            performSearch(1);
        });

        // Ricerca in tempo reale (con debounce)
        searchInput.on('keyup', function(e) {
            // Se viene premuto Enter, esegui subito la ricerca
            if (e.keyCode === 13) {
                clearTimeout(searchTimeout);
                performSearch(1);
                return;
            }

            // Altrimenti aspetta 500ms dopo l'ultimo carattere digitato
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() {
                performSearch(1);
            }, 500);
        });

        // Reset della ricerca
        resetBtn.on('click', function() {
            searchInput.val('');
            performSearch(1);
        });
    });
})(jQuery);
