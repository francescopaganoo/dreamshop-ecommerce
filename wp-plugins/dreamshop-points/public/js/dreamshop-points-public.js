/**
 * Public JavaScript for DreamShop Points Plugin
 */
(function($) {
    'use strict';

    $(document).ready(function() {
        // AJAX per riscattare punti
        $(document).on('click', '#dreamshop-apply-points', function() {
            var points = $('#dreamshop-points-to-redeem').val();
            var minPoints = parseInt($('#dreamshop-points-to-redeem').attr('min'), 10);
            
            if (!points || points < minPoints) {
                alert('È necessario inserire almeno ' + minPoints + ' punti.');
                return;
            }
            
            $.ajax({
                url: dreamshop_points.ajax_url,
                type: 'POST',
                data: {
                    action: 'dreamshop_redeem_points',
                    points: points,
                    security: dreamshop_points.nonce
                },
                success: function(response) {
                    if (response.success) {
                        // Aggiorna il carrello/checkout
                        if (typeof wc_checkout_params !== 'undefined') {
                            $('body').trigger('update_checkout');
                        } else {
                            $('body').trigger('wc_update_cart');
                        }
                    } else {
                        alert(response.data.message || 'Si è verificato un errore durante il riscatto dei punti.');
                    }
                },
                error: function() {
                    alert('Si è verificato un errore di comunicazione con il server.');
                }
            });
        });
        
        // AJAX per rimuovere punti riscattati
        $(document).on('click', '#dreamshop-remove-points', function(e) {
            e.preventDefault();
            
            $.ajax({
                url: dreamshop_points.ajax_url,
                type: 'POST',
                data: {
                    action: 'dreamshop_remove_points',
                    security: dreamshop_points.nonce
                },
                success: function(response) {
                    if (response.success) {
                        // Aggiorna il carrello/checkout
                        if (typeof wc_checkout_params !== 'undefined') {
                            $('body').trigger('update_checkout');
                        } else {
                            $('body').trigger('wc_update_cart');
                        }
                    } else {
                        alert(response.data.message || 'Si è verificato un errore durante la rimozione dei punti.');
                    }
                },
                error: function() {
                    alert('Si è verificato un errore di comunicazione con il server.');
                }
            });
        });
    });
})(jQuery);
