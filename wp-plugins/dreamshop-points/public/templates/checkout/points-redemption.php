<?php
/**
 * Template per la sezione di riscatto punti nel checkout
 */
if (!defined('ABSPATH')) {
    exit;
}
?>

<div class="dreamshop-points-redemption">
    <h3><?php _e('I tuoi punti', 'dreamshop-points'); ?></h3>
    
    <div class="points-redemption-info">
        <p>
            <?php echo sprintf(__('Il tuo saldo punti attuale: <strong>%d punti</strong>', 'dreamshop-points'), $points); ?>
        </p>
        
        <?php if ($points >= $min_points) : ?>
            <?php if ($points_applied) : ?>
                <div class="points-applied">
                    <p>
                        <?php echo sprintf(
                            __('Hai riscattato <strong>%d punti</strong> per uno sconto di <strong>%s€</strong>', 'dreamshop-points'),
                            $points_applied,
                            number_format($discount_value, 2, ',', '.')
                        ); ?>
                    </p>
                    <p>
                        <a href="#" class="button alt" id="dreamshop-remove-points"><?php _e('Rimuovi punti', 'dreamshop-points'); ?></a>
                    </p>
                </div>
            <?php else : ?>
                <div class="points-available">
                    <p>
                        <?php echo sprintf(
                            __('Puoi riscattare i tuoi punti per ottenere uno sconto. Ogni punto vale %s€.', 'dreamshop-points'),
                            number_format($redemption_value, 2, ',', '.')
                        ); ?>
                    </p>
                    
                    <div class="points-redemption-form">
                        <div class="form-row">
                            <input type="number" id="dreamshop-points-to-redeem" name="dreamshop_points_to_redeem" 
                                   min="<?php echo esc_attr($min_points); ?>" 
                                   max="<?php echo esc_attr($points); ?>" 
                                   step="1" 
                                   placeholder="<?php echo sprintf(__('Minimo %d punti', 'dreamshop-points'), $min_points); ?>">
                            <button type="button" id="dreamshop-apply-points" class="button alt"><?php _e('Applica punti', 'dreamshop-points'); ?></button>
                        </div>
                        <p class="description">
                            <?php echo sprintf(__('Puoi riscattare da %d a %d punti.', 'dreamshop-points'), $min_points, $points); ?>
                        </p>
                    </div>
                </div>
            <?php endif; ?>
        <?php elseif ($points > 0) : ?>
            <p>
                <?php echo sprintf(
                    __('Hai bisogno di almeno %d punti per ottenere uno sconto. Ti mancano %d punti.', 'dreamshop-points'),
                    $min_points,
                    $min_points - $points
                ); ?>
            </p>
        <?php endif; ?>
    </div>
</div>

<style>
.dreamshop-points-redemption {
    margin: 1.5em 0;
    padding: 1em;
    border: 1px solid #e5e5e5;
    background: #f8f8f8;
}

.points-redemption-form .form-row {
    display: flex;
    margin-bottom: 0.5em;
}

.points-redemption-form input {
    flex: 1;
    margin-right: 10px;
}

.points-applied {
    background: #e8f7e8;
    padding: 0.75em;
    border-left: 3px solid #46b450;
}
</style>

<script type="text/javascript">
jQuery(document).ready(function($) {
    // Applica punti
    $('#dreamshop-apply-points').click(function() {
        var points = $('#dreamshop-points-to-redeem').val();
        if (!points || points < <?php echo $min_points; ?>) {
            alert('<?php echo sprintf(__('È necessario riscattare almeno %d punti.', 'dreamshop-points'), $min_points); ?>');
            return;
        }
        
        // Aggiorna la sessione tramite AJAX
        $.ajax({
            url: wc_checkout_params.ajax_url,
            type: 'POST',
            data: {
                action: 'dreamshop_redeem_points',
                points: points,
                security: '<?php echo wp_create_nonce('dreamshop-points-redeem'); ?>'
            },
            success: function(response) {
                if (response.success) {
                    // Aggiorna il checkout
                    $('body').trigger('update_checkout');
                } else {
                    alert(response.data.message || '<?php _e('Si è verificato un errore durante il riscatto dei punti.', 'dreamshop-points'); ?>');
                }
            },
            error: function() {
                alert('<?php _e('Si è verificato un errore durante il riscatto dei punti.', 'dreamshop-points'); ?>');
            }
        });
    });
    
    // Rimuovi punti
    $('#dreamshop-remove-points').click(function(e) {
        e.preventDefault();
        
        // Aggiorna la sessione tramite AJAX
        $.ajax({
            url: wc_checkout_params.ajax_url,
            type: 'POST',
            data: {
                action: 'dreamshop_remove_points',
                security: '<?php echo wp_create_nonce('dreamshop-points-redeem'); ?>'
            },
            success: function(response) {
                if (response.success) {
                    // Aggiorna il checkout
                    $('body').trigger('update_checkout');
                } else {
                    alert(response.data.message || '<?php _e('Si è verificato un errore durante la rimozione dei punti.', 'dreamshop-points'); ?>');
                }
            },
            error: function() {
                alert('<?php _e('Si è verificato un errore durante la rimozione dei punti.', 'dreamshop-points'); ?>');
            }
        });
    });
});
</script>
