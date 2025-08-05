jQuery(document).ready(function($) {
    'use strict';
    
    // Initialize Select2 for product selection
    initProductSelect();
    
    // Bind events
    bindEvents();
    
    function initProductSelect() {
        $('#product-select').select2({
            placeholder: 'Cerca prodotto...',
            allowClear: true,
            ajax: {
                url: deferredShipping.ajaxUrl,
                dataType: 'json',
                delay: 250,
                data: function(params) {
                    return {
                        action: 'deferred_shipping_search_products',
                        term: params.term,
                        nonce: deferredShipping.nonce
                    };
                },
                processResults: function(data) {
                    if (data.success && data.data) {
                        return {
                            results: data.data
                        };
                    }
                    return {
                        results: []
                    };
                },
                cache: true
            },
            minimumInputLength: 2
        });
    }
    
    function bindEvents() {
        // Add product form
        $('#add-product-form').on('submit', handleAddProduct);
        
        // Remove product buttons
        $(document).on('click', '.remove-product-btn', handleRemoveProduct);
        
        // Update amount buttons
        $(document).on('click', '.update-amount-btn', handleUpdateAmount);
        
        // Create orders buttons
        $(document).on('click', '.create-orders-btn', handleCreateOrders);
        
        // Cleanup duplicates button
        $(document).on('click', '#cleanup-duplicates-btn', handleCleanupDuplicates);
        
        // Enter key on amount input
        $(document).on('keypress', '.shipping-amount-input', function(e) {
            if (e.which === 13) {
                $(this).siblings('.update-amount-btn').click();
            }
        });
    }
    
    function handleAddProduct(e) {
        e.preventDefault();
        
        var productId = $('#product-select').val();
        
        if (!productId) {
            showNotice('Seleziona un prodotto', 'error');
            return;
        }
        
        var $form = $(this);
        setLoading($form, true);
        
        $.ajax({
            url: deferredShipping.ajaxUrl,
            type: 'POST',
            data: {
                action: 'deferred_shipping_add_product',
                product_id: productId,
                nonce: deferredShipping.nonce
            },
            success: function(response) {
                if (response.success) {
                    showNotice(response.data, 'success');
                    location.reload(); // Reload to show updated list
                } else {
                    showNotice(response.data, 'error');
                }
            },
            error: function() {
                showNotice('Errore durante la comunicazione con il server', 'error');
            },
            complete: function() {
                setLoading($form, false);
            }
        });
    }
    
    function handleRemoveProduct(e) {
        e.preventDefault();
        
        if (!confirm(deferredShipping.strings.confirmRemove)) {
            return;
        }
        
        var productId = $(this).data('product-id');
        var $row = $(this).closest('tr');
        
        setLoading($row, true);
        
        $.ajax({
            url: deferredShipping.ajaxUrl,
            type: 'POST',
            data: {
                action: 'deferred_shipping_remove_product',
                product_id: productId,
                nonce: deferredShipping.nonce
            },
            success: function(response) {
                if (response.success) {
                    showNotice(response.data, 'success');
                    $row.fadeOut(300, function() {
                        $(this).remove();
                    });
                } else {
                    showNotice(response.data, 'error');
                    setLoading($row, false);
                }
            },
            error: function() {
                showNotice('Errore durante la comunicazione con il server', 'error');
                setLoading($row, false);
            }
        });
    }
    
    function handleUpdateAmount(e) {
        e.preventDefault();
        
        var $btn = $(this);
        var productId = $btn.data('product-id');
        var $input = $btn.siblings('.shipping-amount-input');
        var amount = parseFloat($input.val());
        
        if (isNaN(amount) || amount < 0) {
            showNotice('Inserisci un importo valido', 'error');
            $input.focus();
            return;
        }
        
        setLoading($btn, true);
        
        $.ajax({
            url: deferredShipping.ajaxUrl,
            type: 'POST',
            data: {
                action: 'deferred_shipping_update_amount',
                product_id: productId,
                amount: amount,
                nonce: deferredShipping.nonce
            },
            success: function(response) {
                if (response.success) {
                    showNotice(response.data, 'success');
                    location.reload(); // Reload to show updated status
                } else {
                    showNotice(response.data, 'error');
                }
            },
            error: function() {
                showNotice('Errore durante la comunicazione con il server', 'error');
            },
            complete: function() {
                setLoading($btn, false);
            }
        });
    }
    
    function handleCreateOrders(e) {
        e.preventDefault();
        
        var $btn = $(this);
        
        // Prevent double clicks
        if ($btn.prop('disabled') || $btn.hasClass('loading')) {
            return;
        }
        
        if (!confirm(deferredShipping.strings.confirmCreateOrders)) {
            return;
        }
        
        var productId = $btn.data('product-id');
        var amount = $btn.data('amount');
        
        // Immediately disable button to prevent double clicks
        $btn.prop('disabled', true).addClass('loading').text('Creazione in corso...');
        
        setLoading($btn, true);
        
        $.ajax({
            url: deferredShipping.ajaxUrl,
            type: 'POST',
            data: {
                action: 'deferred_shipping_create_orders',
                product_id: productId,
                amount: amount,
                nonce: deferredShipping.nonce
            },
            success: function(response) {
                if (response.success) {
                    showNotice(response.data, 'success');
                    $btn.prop('disabled', true).text('Ordini Creati');
                } else {
                    showNotice(response.data, 'error');
                }
            },
            error: function() {
                showNotice('Errore durante la comunicazione con il server', 'error');
            },
            complete: function() {
                setLoading($btn, false);
            }
        });
    }
    
    function handleCleanupDuplicates(e) {
        e.preventDefault();
        
        var $btn = $(this);
        
        if (!confirm('Sei sicuro di voler rimuovere tutti gli ordini duplicati? Questa operazione non può essere annullata.')) {
            return;
        }
        
        setLoading($btn, true);
        
        $.ajax({
            url: deferredShipping.ajaxUrl,
            type: 'POST',
            data: {
                action: 'deferred_shipping_cleanup_duplicates',
                nonce: deferredShipping.nonce
            },
            success: function(response) {
                if (response.success) {
                    showNotice(response.data, 'success');
                } else {
                    showNotice(response.data, 'error');
                }
            },
            error: function() {
                showNotice('Errore durante la comunicazione con il server', 'error');
            },
            complete: function() {
                setLoading($btn, false);
            }
        });
    }
    
    function setLoading($element, loading) {
        if (loading) {
            $element.addClass('loading').prop('disabled', true);
        } else {
            $element.removeClass('loading').prop('disabled', false);
        }
    }
    
    function showNotice(message, type) {
        var $notice = $('<div class="deferred-shipping-notice ' + type + '">' + message + '</div>');
        $('body').append($notice);
        
        setTimeout(function() {
            $notice.fadeOut(300, function() {
                $(this).remove();
            });
        }, 4000);
    }
});