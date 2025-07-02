(function($) {
    'use strict';

    // Funzione per caricare le rate
    function loadScheduledOrders() {
        const $container = $('.dreamshop-rate-payments-content');
        
        // Mostra il loading
        $container.html('<div class="loading">' + dreamshop_deposits_endpoints.i18n.loading + '</div>');
        
        // Effettua la chiamata API
        $.ajax({
            url: dreamshop_deposits_endpoints.rest_url + 'scheduled-orders',
            method: 'GET',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-WP-Nonce', dreamshop_deposits_endpoints.nonce);
            },
            success: function(response) {
                if (response.success && response.data) {
                    if (response.data.length > 0) {
                        // Costruisci la tabella delle rate
                        renderOrdersTable(response.data);
                    } else {
                        // Nessuna rata da mostrare
                        $container.html('<div class="no-orders">' + dreamshop_deposits_endpoints.i18n.no_orders + '</div>');
                    }
                } else {
                    // Errore nella risposta
                    showError();
                }
            },
            error: function() {
                showError();
            }
        });
    }
    
    // Funzione per mostrare un messaggio di errore
    function showError() {
        $('.dreamshop-rate-payments-content').html(
            '<div class="error-message">' + dreamshop_deposits_endpoints.i18n.error + '</div>'
        );
    }
    
    // Funzione per renderizzare la tabella delle rate
    function renderOrdersTable(orders) {
        const $container = $('.dreamshop-rate-payments-content');
        
        let html = '<table class="woocommerce-orders-table woocommerce-MyAccount-orders shop_table shop_table_responsive my_account_orders account-orders-table">';
        
        // Intestazione della tabella
        html += '<thead><tr>';
        html += '<th>Ordine #</th>';
        html += '<th>Data</th>';
        html += '<th>Ordine originale</th>';
        html += '<th>Stato</th>';
        html += '<th>Totale</th>';
        html += '<th>Azioni</th>';
        html += '</tr></thead>';
        
        // Corpo della tabella
        html += '<tbody>';
        
        orders.forEach(function(order) {
            html += '<tr>';
            html += '<td>' + order.id + '</td>';
            html += '<td>' + order.date_created + '</td>';
            html += '<td>' + (order.parent_order_number ? 'Ordine #' + order.parent_order_number : '-') + '</td>';
            html += '<td><span class="order-status ' + order.status + '">' + order.status_name + '</span></td>';
            html += '<td>' + order.formatted_total + '</td>';
            html += '<td>';
            
            // Bottone "Paga ora" solo per gli ordini in attesa di pagamento
            if (order.status === 'pending-deposit') {
                html += '<a href="#" class="pay-button" data-order-id="' + order.id + '">' + 
                       dreamshop_deposits_endpoints.i18n.pay_now + '</a>';
            }
            
            // Bottone "Visualizza dettagli" per tutti gli ordini
            html += '<a href="' + order.view_url + '" class="view-button">' + 
                   dreamshop_deposits_endpoints.i18n.view_details + '</a>';
            
            html += '</td>';
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        
        $container.html(html);
        
        // Aggiungi il listener per il pulsante di pagamento
        $('.pay-button').on('click', function(e) {
            e.preventDefault();
            const orderId = $(this).data('order-id');
            processPayment(orderId);
        });
    }
    
    // Funzione per processare il pagamento di una rata
    function processPayment(orderId) {
        $.ajax({
            url: dreamshop_deposits_endpoints.rest_url + 'scheduled-orders/' + orderId + '/pay',
            method: 'POST',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-WP-Nonce', dreamshop_deposits_endpoints.nonce);
            },
            success: function(response) {
                if (response.success && response.redirect) {
                    // Reindirizza alla pagina di pagamento
                    window.location.href = response.redirect;
                } else {
                    showError();
                }
            },
            error: function() {
                showError();
            }
        });
    }
    
    // Inizializza quando il documento è pronto
    $(document).ready(function() {
        // Verifica di essere nella pagina corretta
        if ($('.dreamshop-rate-payments').length) {
            loadScheduledOrders();
        }
    });
    
})(jQuery);
