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
    });
})(jQuery);
