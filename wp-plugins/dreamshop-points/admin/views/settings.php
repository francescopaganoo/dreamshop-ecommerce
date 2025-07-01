<?php
// Previene l'accesso diretto
if (!defined('ABSPATH')) {
    exit;
}

// Mostra eventuali errori o messaggi
settings_errors('dreamshop_points');

// Salva le impostazioni se il form è stato inviato
if (isset($_POST['dreamshop_points_settings_nonce']) && wp_verify_nonce($_POST['dreamshop_points_settings_nonce'], 'dreamshop_points_settings')) {
    $earning_ratio = floatval($_POST['earning_ratio']);
    $redemption_value = floatval($_POST['redemption_value']);
    $min_points = intval($_POST['min_points']);
    
    // Stati degli ordini che generano punti
    $earning_statuses = isset($_POST['earning_statuses']) ? $_POST['earning_statuses'] : array('completed');
    
    update_option('dreamshop_points_earning_ratio', $earning_ratio);
    update_option('dreamshop_points_redemption_value', $redemption_value);
    update_option('dreamshop_points_min_redemption', $min_points);
    update_option('dreamshop_points_earning_statuses', $earning_statuses);
    
    echo '<div class="notice notice-success"><p>' . esc_html__('Impostazioni salvate con successo!', 'dreamshop-points') . '</p></div>';
    
    // Log per debugging
    error_log("DreamShop Points: Impostazioni aggiornate - Rapporto guadagno: {$earning_ratio}, Valore riscatto: {$redemption_value}, Min punti: {$min_points}");
    error_log("DreamShop Points: Stati ordini che generano punti: " . implode(', ', $earning_statuses));
}

// Recupera le impostazioni correnti
$earning_ratio = get_option('dreamshop_points_earning_ratio', 1);
$redemption_value = get_option('dreamshop_points_redemption_value', 0.01);
$min_points = get_option('dreamshop_points_min_redemption', 100);
$earning_statuses = get_option('dreamshop_points_earning_statuses', array('completed'));

// Recupera tutti i possibili stati di ordini di WooCommerce
$order_statuses = wc_get_order_statuses();
?>

<div class="wrap dreamshop-points-settings">
    <h1><?php _e('Impostazioni Punti Fedeltà', 'dreamshop-points'); ?></h1>
    
    <form method="post" action="">
        <?php wp_nonce_field('dreamshop_points_settings'); ?>
        <input type="hidden" name="dreamshop_points_settings_nonce" value="<?php echo wp_create_nonce('dreamshop_points_settings'); ?>">
        <input type="hidden" name="dreamshop_points_save_settings" value="1">
        
        <table class="form-table">
            <tr>
                <th scope="row"><?php _e('Rapporto di guadagno punti', 'dreamshop-points'); ?></th>
                <td>
                    <input type="number" step="0.01" min="0" name="earning_ratio" value="<?php echo esc_attr($earning_ratio); ?>" class="small-text">
                    <p class="description">
                        <?php _e('Numero di punti guadagnati per ogni euro speso. Ad esempio, con un valore di 1, un ordine di 50€ farà guadagnare 50 punti.', 'dreamshop-points'); ?>
                    </p>
                </td>
            </tr>
            
            <tr>
                <th scope="row"><?php _e('Valore di riscatto punti', 'dreamshop-points'); ?></th>
                <td>
                    <input type="number" step="0.01" min="0" name="redemption_value" value="<?php echo esc_attr($redemption_value); ?>" class="small-text">
                    <p class="description">
                        <?php _e('Valore in euro di ogni punto. Ad esempio, con un valore di 0.01, 100 punti valgono 1€ di sconto.', 'dreamshop-points'); ?>
                    </p>
                </td>
            </tr>
            
            <tr>
                <th scope="row"><?php _e('Punti minimi per il riscatto', 'dreamshop-points'); ?></th>
                <td>
                    <input type="number" step="1" min="1" name="min_points" value="<?php echo esc_attr($min_points); ?>" class="small-text">
                    <p class="description">
                        <?php _e('Numero minimo di punti necessari per poter richiedere uno sconto.', 'dreamshop-points'); ?>
                    </p>
                </td>
            </tr>
            
            <tr>
                <th scope="row"><?php _e('Stati ordini che generano punti', 'dreamshop-points'); ?></th>
                <td>
                    <fieldset>
                        <legend class="screen-reader-text">
                            <?php _e('Stati ordini che generano punti', 'dreamshop-points'); ?>
                        </legend>
                        <?php foreach ($order_statuses as $status_key => $status_label) : 
                            $status_key = str_replace('wc-', '', $status_key); // Rimuovi il prefisso wc-
                            $checked = in_array($status_key, $earning_statuses) ? 'checked' : '';
                        ?>
                        <label>
                            <input type="checkbox" name="earning_statuses[]" value="<?php echo esc_attr($status_key); ?>" <?php echo $checked; ?>>
                            <?php echo esc_html($status_label); ?>
                        </label><br>
                        <?php endforeach; ?>
                        <p class="description">
                            <?php _e('Seleziona gli stati degli ordini che generano punti per i clienti. Di default, solo gli ordini completati generano punti.', 'dreamshop-points'); ?>
                        </p>
                    </fieldset>
                </td>
            </tr>
        </table>
        
        <?php submit_button(__('Salva impostazioni', 'dreamshop-points')); ?>
    </form>
</div>

<style>
.dreamshop-points-settings .form-table th {
    width: 250px;
}
</style>
