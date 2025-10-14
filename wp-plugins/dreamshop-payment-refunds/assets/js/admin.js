jQuery(document).ready(function($) {
    'use strict';

    // Gestione click sul bottone rimborso
    $(document).on('click', '.dreamshop-refund-button', function(e) {
        e.preventDefault();

        const button = $(this);
        const orderId = button.data('order-id');
        const paymentMethod = button.data('payment-method');
        const paymentGateway = button.data('payment-gateway');
        const transactionId = button.data('transaction-id');
        const orderTotal = parseFloat(button.data('order-total'));

        // Recupera i dettagli dell'ordine prima di mostrare la modale
        getOrderDetails(orderId, function(orderDetails) {
            // Mostra modal per il rimborso con i dettagli
            showRefundModal(orderId, paymentMethod, paymentGateway, transactionId, orderTotal, orderDetails);
        });
    });

    /**
     * Mostra modal per il rimborso
     */
    function showRefundModal(orderId, paymentMethod, paymentGateway, transactionId, orderTotal, orderDetails) {
        // Genera HTML per i prodotti
        let productsHtml = '';
        if (orderDetails && orderDetails.products && orderDetails.products.length > 0) {
            productsHtml = '<div class="dreamshop-order-items" style="margin-bottom: 15px;"><h3 style="margin-top: 0;">Seleziona prodotti da rimborsare</h3><table class="widefat" style="margin-bottom: 10px;"><thead><tr><th style="width: 50%;">Prodotto</th><th style="width: 20%;">Quantità</th><th style="width: 30%;">Totale</th></tr></thead><tbody>';

            orderDetails.products.forEach(function(product, index) {
                const stockInfo = product.stock !== null ? `(Giacenza attuale: ${product.stock})` : '';
                const pricePerUnit = product.total / product.quantity;
                productsHtml += `
                    <tr class="product-row" data-product-index="${index}">
                        <td>
                            ${product.name}<br>
                            <small style="color: #666;">${stockInfo}</small>
                        </td>
                        <td>
                            <input type="number"
                                   class="refund-product-qty"
                                   data-product-index="${index}"
                                   data-max-qty="${product.quantity}"
                                   data-price-per-unit="${pricePerUnit}"
                                   min="0"
                                   max="${product.quantity}"
                                   value="${product.quantity}"
                                   style="width: 80px; padding: 5px;">
                            / ${product.quantity}
                        </td>
                        <td class="product-total-cell" data-product-index="${index}">€${product.total.toFixed(2)}</td>
                    </tr>
                `;
            });
            productsHtml += '</tbody></table>';

            // Aggiungi spedizione
            if (orderDetails.shipping_total > 0) {
                productsHtml += `
                    <div style="margin-bottom: 10px;">
                        <label>
                            <input type="checkbox" id="refund-shipping" class="refund-item-checkbox" data-amount="${orderDetails.shipping_total}" checked>
                            Rimborsa spedizione: €${orderDetails.shipping_total.toFixed(2)}
                        </label>
                    </div>
                `;
            }

            // Aggiungi fee (tariffe PayPal, ecc.)
            if (orderDetails.fees && orderDetails.fees.length > 0) {
                orderDetails.fees.forEach(function(fee, index) {
                    productsHtml += `
                        <div style="margin-bottom: 10px;">
                            <label>
                                <input type="checkbox" class="refund-fee-checkbox" data-amount="${fee.total}" data-fee-index="${index}" checked>
                                Rimborsa ${fee.name}: €${fee.total.toFixed(2)}
                            </label>
                        </div>
                    `;
                });
            }

            productsHtml += '</div>';
        }

        // Crea il modal HTML
        const modalHtml = `
            <div id="dreamshop-refund-modal" class="dreamshop-modal">
                <div class="dreamshop-modal-content">
                    <span class="dreamshop-modal-close">&times;</span>
                    <h2>Rimborsa via ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</h2>

                    <div class="dreamshop-refund-info">
                        <p><strong>Ordine ID:</strong> ${orderId}</p>
                        <p><strong>Metodo di pagamento:</strong> ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</p>
                        <p><strong>Transaction ID:</strong> ${transactionId}</p>
                        <p><strong>Totale ordine:</strong> €${orderTotal.toFixed(2)}</p>
                    </div>

                    ${productsHtml}

                    <div class="dreamshop-refund-form">
                        <div class="dreamshop-form-group" style="border-top: 1px solid #ddd; padding-top: 15px; margin-top: 15px;">
                            <label for="refund_total_amount" style="font-weight: bold; font-size: 14px;">Totale rimborso:</label>
                            <input type="number" id="refund_total_amount" step="0.01" min="0.01" max="${orderTotal}" value="${orderTotal.toFixed(2)}" style="font-weight: bold; font-size: 16px; width: 150px;">
                            <p class="description" style="margin-top: 5px; font-style: italic; color: #666;">Puoi modificare l'importo manualmente</p>
                        </div>

                        <div class="dreamshop-form-group">
                            <label for="refund_reason">${dreamshopRefunds.strings.reason}:</label>
                            <textarea id="refund_reason" rows="3" placeholder="Motivo del rimborso..."></textarea>
                        </div>

                        <div class="dreamshop-form-actions">
                            <button type="button" class="button button-primary" id="dreamshop-process-refund">
                                ${dreamshopRefunds.strings.refund}
                            </button>
                            <button type="button" class="button dreamshop-modal-cancel">
                                ${dreamshopRefunds.strings.cancel}
                            </button>
                        </div>

                        <div id="dreamshop-refund-message" style="display: none; margin-top: 15px;"></div>
                    </div>
                </div>
            </div>
        `;

        // Aggiungi modal al DOM
        $('body').append(modalHtml);

        // Gestione chiusura modal
        $('.dreamshop-modal-close, .dreamshop-modal-cancel').on('click', function() {
            closeRefundModal();
        });

        // Chiudi modal cliccando fuori
        $(window).on('click', function(event) {
            if ($(event.target).is('#dreamshop-refund-modal')) {
                closeRefundModal();
            }
        });

        // Funzione per ricalcolare il totale del rimborso
        function recalculateRefundTotal() {
            let total = 0;

            // Calcola totale prodotti in base alle quantità
            $('.refund-product-qty').each(function() {
                const qty = parseInt($(this).val()) || 0;
                const pricePerUnit = parseFloat($(this).data('price-per-unit'));
                total += qty * pricePerUnit;
            });

            // Aggiungi spedizione se selezionata
            if ($('#refund-shipping').is(':checked')) {
                total += parseFloat($('#refund-shipping').data('amount'));
            }

            // Aggiungi fee se selezionate
            $('.refund-fee-checkbox:checked').each(function() {
                total += parseFloat($(this).data('amount'));
            });

            $('#refund_total_amount').val(total.toFixed(2));

            // Aggiorna anche i totali dei singoli prodotti
            $('.refund-product-qty').each(function() {
                const index = $(this).data('product-index');
                const qty = parseInt($(this).val()) || 0;
                const pricePerUnit = parseFloat($(this).data('price-per-unit'));
                const productTotal = qty * pricePerUnit;
                $(`.product-total-cell[data-product-index="${index}"]`).text('€' + productTotal.toFixed(2));
            });
        }

        // Gestione cambio quantità prodotti
        $('.refund-product-qty').on('input change', function() {
            const maxQty = parseInt($(this).data('max-qty'));
            let qty = parseInt($(this).val()) || 0;

            // Validazione quantità
            if (qty < 0) qty = 0;
            if (qty > maxQty) qty = maxQty;
            $(this).val(qty);

            recalculateRefundTotal();
        });

        // Gestione cambio checkbox spedizione/fee
        $('#refund-shipping, .refund-fee-checkbox').on('change', function() {
            recalculateRefundTotal();
        });

        // Gestione click su "Rimborsa"
        $('#dreamshop-process-refund').on('click', function() {
            processRefund(orderId, paymentMethod, paymentGateway, orderTotal);
        });
    }

    /**
     * Chiudi modal
     */
    function closeRefundModal() {
        $('#dreamshop-refund-modal').fadeOut(300, function() {
            $(this).remove();
        });
    }

    /**
     * Processa il rimborso
     */
    function processRefund(orderId, paymentMethod, paymentGateway, orderTotal) {
        const modal = $('#dreamshop-refund-modal');
        const refundAmount = parseFloat(modal.find('#refund_total_amount').val());
        const refundReason = modal.find('#refund_reason').val();

        // Validazione
        if (!refundReason || refundReason.trim() === '') {
            showMessage('error', 'Il motivo del rimborso è obbligatorio');
            return;
        }

        if (!refundAmount || refundAmount <= 0 || refundAmount > orderTotal) {
            showMessage('error', 'Importo del rimborso non valido');
            return;
        }

        // Raccogli i prodotti con le quantità da rimborsare
        const refundItems = [];
        $('.refund-product-qty').each(function() {
            const qty = parseInt($(this).val()) || 0;
            if (qty > 0) {
                refundItems.push({
                    index: $(this).data('product-index'),
                    quantity: qty,
                    price_per_unit: parseFloat($(this).data('price-per-unit'))
                });
            }
        });

        // Verifica se rimborsare la spedizione
        const refundShipping = $('#refund-shipping').is(':checked');

        // Verifica quali fee rimborsare
        const refundFees = [];
        $('.refund-fee-checkbox:checked').each(function() {
            refundFees.push(parseInt($(this).data('fee-index')));
        });

        // Disabilita il bottone e mostra loading
        const button = modal.find('#dreamshop-process-refund');
        button.prop('disabled', true).text(dreamshopRefunds.strings.processing);

        // Nascondi eventuali messaggi precedenti
        modal.find('#dreamshop-refund-message').hide();

        // Effettua la richiesta AJAX
        $.ajax({
            url: dreamshopRefunds.ajax_url,
            type: 'POST',
            data: {
                action: 'dreamshop_process_refund',
                nonce: dreamshopRefunds.nonce,
                order_id: orderId,
                payment_method: paymentMethod,
                payment_gateway: paymentGateway,
                amount: refundAmount,
                reason: refundReason,
                refund_items: JSON.stringify(refundItems),
                refund_shipping: refundShipping,
                refund_fees: JSON.stringify(refundFees)
            },
            success: function(response) {
                if (response.success) {
                    showMessage('success', response.data.message || dreamshopRefunds.strings.success);

                    // Ricarica la pagina dopo 2 secondi
                    setTimeout(function() {
                        location.reload();
                    }, 2000);
                } else {
                    showMessage('error', response.data.message || dreamshopRefunds.strings.error);
                    button.prop('disabled', false).text(dreamshopRefunds.strings.refund);
                }
            },
            error: function(xhr, status, error) {
                showMessage('error', dreamshopRefunds.strings.error + ': ' + error);
                button.prop('disabled', false).text(dreamshopRefunds.strings.refund);
            }
        });
    }

    /**
     * Mostra messaggio nel modal
     */
    function showMessage(type, message) {
        const messageDiv = $('#dreamshop-refund-message');
        const messageClass = type === 'success' ? 'notice-success' : 'notice-error';

        messageDiv
            .removeClass('notice-success notice-error')
            .addClass('notice ' + messageClass)
            .html('<p>' + message + '</p>')
            .slideDown();
    }

    /**
     * Recupera dettagli ordine via AJAX
     */
    function getOrderDetails(orderId, callback) {
        $.ajax({
            url: dreamshopRefunds.ajax_url,
            type: 'POST',
            data: {
                action: 'dreamshop_get_order_details',
                nonce: dreamshopRefunds.nonce,
                order_id: orderId
            },
            success: function(response) {
                if (response.success) {
                    callback(response.data);
                } else {
                    alert('Errore nel recupero dei dettagli ordine: ' + (response.data.message || 'Errore sconosciuto'));
                }
            },
            error: function(xhr, status, error) {
                alert('Errore nel recupero dei dettagli ordine: ' + error);
            }
        });
    }

    /**
     * Test connessione Stripe
     */
    $('#test-stripe-connection').on('click', function() {
        const button = $(this);
        button.prop('disabled', true).text('Testing...');

        $.ajax({
            url: dreamshopRefunds.ajax_url,
            type: 'POST',
            data: {
                action: 'dreamshop_test_stripe',
                nonce: dreamshopRefunds.nonce
            },
            success: function(response) {
                const resultsDiv = $('#test-results');
                if (response.success) {
                    resultsDiv.html('<div class="notice notice-success"><p>✓ Connessione Stripe OK</p></div>');
                } else {
                    resultsDiv.html('<div class="notice notice-error"><p>✗ Errore Stripe: ' + response.data.message + '</p></div>');
                }
                button.prop('disabled', false).text('Test Stripe');
            },
            error: function() {
                $('#test-results').html('<div class="notice notice-error"><p>✗ Errore di connessione</p></div>');
                button.prop('disabled', false).text('Test Stripe');
            }
        });
    });

    /**
     * Test connessione PayPal
     */
    $('#test-paypal-connection').on('click', function() {
        const button = $(this);
        button.prop('disabled', true).text('Testing...');

        $.ajax({
            url: dreamshopRefunds.ajax_url,
            type: 'POST',
            data: {
                action: 'dreamshop_test_paypal',
                nonce: dreamshopRefunds.nonce
            },
            success: function(response) {
                const resultsDiv = $('#test-results');
                if (response.success) {
                    resultsDiv.html('<div class="notice notice-success"><p>✓ Connessione PayPal OK</p></div>');
                } else {
                    resultsDiv.html('<div class="notice notice-error"><p>✗ Errore PayPal: ' + response.data.message + '</p></div>');
                }
                button.prop('disabled', false).text('Test PayPal');
            },
            error: function() {
                $('#test-results').html('<div class="notice notice-error"><p>✗ Errore di connessione</p></div>');
                button.prop('disabled', false).text('Test PayPal');
            }
        });
    });
});
