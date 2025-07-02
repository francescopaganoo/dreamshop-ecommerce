<?php
/**
 * Template per la pagina "Rate da pagare" nel mio account
 *
 * @package dreamshop-deposits-endpoints
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly.
}
?>

<div class="dreamshop-rate-payments">
    <h2><?php _e('Rate da pagare', 'dreamshop-deposits-endpoints'); ?></h2>
    
    <p><?php _e('Qui trovi tutte le rate pianificate per i tuoi ordini. Puoi vedere lo stato di ciascuna rata e procedere con il pagamento quando è disponibile.', 'dreamshop-deposits-endpoints'); ?></p>
    
    <div class="dreamshop-rate-payments-content">
        <!-- Il contenuto verrà caricato via JavaScript -->
    </div>
</div>
