jQuery(document).ready(function($) {
    'use strict';

    // Gestione click sul bottone rimborso
    $(document).on('click', '.dreamshop-refund-button', function(e) {
        e.preventDefault();

        const button = $(this);
        const orderId = button.data('order-id');
        const paymentMethod = button.data('payment-method');
        const transactionId = button.data('transaction-id');
        const orderTotal = parseFloat(button.data('order-total'));

        // Mostra modal per il rimborso
        showRefundModal(orderId, paymentMethod, transactionId, orderTotal);
    });

    /**
     * Mostra modal per il rimborso
     */
    function showRefundModal(orderId, paymentMethod, transactionId, orderTotal) {
        // Crea il modal HTML
        const modalHtml = `
            <div id="dreamshop-refund-modal" class="dreamshop-modal">
                <div class="dreamshop-modal-content">
                    <span class="dreamshop-modal-close">&times;</span>
                    <h2>${dreamshopRefunds.strings.confirm_refund}</h2>

                    <div class="dreamshop-refund-info">
                        <p><strong>Ordine ID:</strong> ${orderId}</p>
                        <p><strong>Metodo di pagamento:</strong> ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</p>
                        <p><strong>Transaction ID:</strong> ${transactionId}</p>
                        <p><strong>Totale ordine:</strong> €${orderTotal.toFixed(2)}</p>
                    </div>

                    <div class="dreamshop-refund-form">
                        <div class="dreamshop-form-group">
                            <label>
                                <input type="radio" name="refund_type" value="full" checked>
                                ${dreamshopRefunds.strings.full_refund} (€${orderTotal.toFixed(2)})
                            </label>
                        </div>

                        <div class="dreamshop-form-group">
                            <label>
                                <input type="radio" name="refund_type" value="partial">
                                ${dreamshopRefunds.strings.partial_refund}
                            </label>
                        </div>

                        <div class="dreamshop-form-group dreamshop-partial-amount" style="display: none;">
                            <label for="refund_amount">${dreamshopRefunds.strings.amount}:</label>
                            <input type="number" id="refund_amount" step="0.01" min="0.01" max="${orderTotal}" placeholder="0.00">
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

        // Gestione cambio tipo rimborso
        $('input[name="refund_type"]').on('change', function() {
            if ($(this).val() === 'partial') {
                $('.dreamshop-partial-amount').slideDown();
            } else {
                $('.dreamshop-partial-amount').slideUp();
                $('#refund_amount').val('');
            }
        });

        // Gestione click su "Rimborsa"
        $('#dreamshop-process-refund').on('click', function() {
            processRefund(orderId, paymentMethod, orderTotal);
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
    function processRefund(orderId, paymentMethod, orderTotal) {
        const modal = $('#dreamshop-refund-modal');
        const refundType = modal.find('input[name="refund_type"]:checked').val();
        const refundAmount = refundType === 'partial' ? parseFloat(modal.find('#refund_amount').val()) : 0;
        const refundReason = modal.find('#refund_reason').val();

        // Validazione
        if (!refundReason || refundReason.trim() === '') {
            showMessage('error', 'Il motivo del rimborso è obbligatorio');
            return;
        }

        if (refundType === 'partial' && (!refundAmount || refundAmount <= 0 || refundAmount > orderTotal)) {
            showMessage('error', 'Importo del rimborso non valido');
            return;
        }

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
                amount: refundAmount,
                reason: refundReason
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
