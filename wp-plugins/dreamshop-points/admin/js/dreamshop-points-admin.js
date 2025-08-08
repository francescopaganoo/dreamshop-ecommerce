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
    });
})(jQuery);
