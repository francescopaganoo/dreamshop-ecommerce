jQuery(document).ready(function($) {
    // Genera coupon
    $('#generate-coupon-form').on('submit', function(e) {
        e.preventDefault();
        
        var $form = $(this);
        var $button = $form.find('button[type="submit"]');
        var $result = $('#coupon-result');
        var amount = parseFloat($('#coupon-amount').val());
        
        if (!amount || amount <= 0) {
            alert('Inserisci un importo valido');
            return;
        }
        
        $button.prop('disabled', true).text('Generazione in corso...');
        $result.hide();
        
        $.ajax({
            url: gift_card_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'gift_card_generate_coupon',
                amount: amount,
                nonce: gift_card_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    $result.find('.coupon-code').html(
                        '<strong>' + response.data.coupon_code + '</strong>' +
                        '<button type="button" class="copy-coupon-btn" data-coupon="' + response.data.coupon_code + '">Copia</button>'
                    );
                    $result.show();
                    
                    // Aggiorna saldo visualizzato
                    $('.balance-amount').text('€' + response.data.formatted_balance.replace('€', ''));
                    
                    // Aggiorna il max dell'input
                    $('#coupon-amount').attr('max', response.data.new_balance);
                    
                    // Reset form
                    $form[0].reset();
                    
                    alert('Coupon da ' + response.data.formatted_amount + ' generato con successo!');
                } else {
                    alert('Errore: ' + response.data);
                }
            },
            error: function() {
                alert('Errore di connessione. Riprova più tardi.');
            },
            complete: function() {
                $button.prop('disabled', false).text('Genera Coupon');
            }
        });
    });
    
    // Copia coupon negli appunti
    $(document).on('click', '.copy-coupon-btn', function() {
        var couponCode = $(this).data('coupon');
        var $btn = $(this);
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(couponCode).then(function() {
                $btn.text('Copiato!').addClass('copied');
                setTimeout(function() {
                    $btn.text('Copia').removeClass('copied');
                }, 2000);
            });
        } else {
            // Fallback per browser più vecchi
            var textArea = document.createElement('textarea');
            textArea.value = couponCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            $btn.text('Copiato!').addClass('copied');
            setTimeout(function() {
                $btn.text('Copia').removeClass('copied');
            }, 2000);
        }
    });
    
    // Validazione importo in tempo reale
    $('#coupon-amount').on('input', function() {
        var amount = parseFloat($(this).val());
        var maxAmount = parseFloat($(this).attr('max'));
        var $button = $('#generate-coupon-form button[type="submit"]');
        
        if (amount > maxAmount) {
            $(this).addClass('error');
            $button.prop('disabled', true);
        } else {
            $(this).removeClass('error');
            $button.prop('disabled', false);
        }
    });
    
    // Aggiornamento automatico saldo (polling ogni 30 secondi)
    if ($('.balance-amount').length) {
        setInterval(function() {
            updateBalance();
        }, 30000);
    }
    
    function updateBalance() {
        var userId = $('.balance-amount').data('user-id');
        if (!userId) return;
        
        $.ajax({
            url: gift_card_ajax.api_url + 'balance/' + userId,
            type: 'GET',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-WP-Nonce', gift_card_ajax.nonce);
            },
            success: function(response) {
                if (response.success) {
                    $('.balance-amount').text(response.data.formatted_balance);
                    $('#coupon-amount').attr('max', response.data.balance);
                }
            },
            error: function(xhr) {
                console.log('Errore aggiornamento saldo:', xhr.responseText);
            }
        });
    }
    
    // Validazione coupon nel checkout (se presente)
    if ($('#coupon_code').length) {
        $('#coupon_code').on('blur', function() {
            var couponCode = $(this).val().trim();
            if (couponCode.startsWith('GC') && couponCode.length > 5) {
                validateGiftCardCoupon(couponCode);
            }
        });
    }
    
    function validateGiftCardCoupon(couponCode) {
        $.ajax({
            url: gift_card_ajax.api_url + 'coupon/' + couponCode,
            type: 'GET',
            success: function(response) {
                if (response.success) {
                    var coupon = response.data;
                    if (coupon.status === 'active') {
                        showCouponInfo('Coupon valido: ' + coupon.formatted_amount, 'success');
                    } else {
                        showCouponInfo('Coupon non più valido', 'error');
                    }
                } else {
                    showCouponInfo('Coupon non trovato', 'error');
                }
            },
            error: function() {
                console.log('Errore validazione coupon');
            }
        });
    }
    
    function showCouponInfo(message, type) {
        var $info = $('#coupon-info');
        if (!$info.length) {
            $info = $('<div id="coupon-info"></div>');
            $('#coupon_code').after($info);
        }
        
        $info.removeClass('success error').addClass(type).text(message).show();
        
        setTimeout(function() {
            $info.fadeOut();
        }, 5000);
    }
});