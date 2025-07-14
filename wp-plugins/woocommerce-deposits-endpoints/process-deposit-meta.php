<?php
/**
 * Funzioni per elaborare i metadati degli acconti 
 * 
 * @package DreamShop_Deposits_API
 */

// Torna al namespace globale
namespace {

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

/**
 * Processa i meta dati per convertire un prodotto normale in prodotto con acconto
 * 
 * @param array $cart_item_data Dati dell'elemento carrello
 * @param int $product_id ID del prodotto
 * @param int $variation_id ID della variazione
 * @return array Dati dell'elemento carrello modificati
 */
function dreamshop_process_deposit_meta($cart_item_data, $product_id, $variation_id) {
    // Verifica nei meta_data se c'è il flag per la conversione a acconto
    if (isset($cart_item_data['meta_data']) && is_array($cart_item_data['meta_data'])) {
        $convert_to_deposit = false;
        $deposit_type = 'percent';
        $deposit_amount = '40';

        // Cerca i meta dati specifici
        foreach ($cart_item_data['meta_data'] as $key => $meta) {
            if (isset($meta['key']) && $meta['key'] === '_wc_convert_to_deposit' && isset($meta['value']) && $meta['value'] === 'yes') {
                $convert_to_deposit = true;
                // Non rimuoviamo più questo meta dato
            }
            if (isset($meta['key']) && $meta['key'] === '_wc_deposit_type' && isset($meta['value'])) {
                $deposit_type = $meta['value'];
                // Non rimuoviamo più questo meta dato
            }
            if (isset($meta['key']) && $meta['key'] === '_wc_deposit_amount' && isset($meta['value'])) {
                $deposit_amount = $meta['value'];
                // Non rimuoviamo più questo meta dato
            }
        }

        // Se abbiamo identificato che questo articolo dovrebbe essere un acconto
        if ($convert_to_deposit) {
            error_log("[INFO] Convertendo prodotto ID: {$product_id} in prodotto con acconto. Tipo: {$deposit_type}, Importo: {$deposit_amount}");
            
            // Verifica se il prodotto supporta gli acconti
            $has_deposit = get_post_meta($product_id, '_wc_deposit_enabled', true);
            
            error_log("[DEBUG] Prodotto ID: {$product_id} - _wc_deposit_enabled: {$has_deposit}");
            
            // Se il prodotto supporta acconti, imposta i dati necessari
            if ($has_deposit === 'yes' || $has_deposit === 'optional') {
                // Imposta i meta dati standard di WooCommerce Deposits
                // Questi sono i meta dati che WooCommerce Deposits riconosce
                $cart_item_data['wc_deposit_option'] = 'yes';
                
                // Aggiungi anche questi meta dati come attributi del carrello
                // per assicurarsi che vengano propagati correttamente al checkout
                $cart_item_data['_wc_deposit_enabled'] = 'yes';
                $cart_item_data['_wc_deposit_type'] = $deposit_type;
                $cart_item_data['_wc_deposit_amount'] = $deposit_amount;
                
                error_log("[INFO] Prodotto convertito con successo in prodotto con acconto. Meta dati aggiunti:");
                error_log(json_encode($cart_item_data));
            } else {
                error_log("[WARNING] Il prodotto ID: {$product_id} non supporta acconti. Valore _wc_deposit_enabled: {$has_deposit}");
            }
        }
    }
    
    return $cart_item_data;
}

/**
 * Log dell'aggiunta al carrello per debug
 */
function dreamshop_log_cart_addition($cart_item_key, $product_id, $quantity, $variation_id, $variation, $cart_item_data) {
    error_log("[DEBUG] Prodotto aggiunto al carrello - ID: {$product_id}, Quantità: {$quantity}, Variazione: {$variation_id}");
    if (is_array($cart_item_data)) {
        error_log("[DEBUG] Dati elemento carrello: " . json_encode($cart_item_data));
    }
}

// Aggiungi i filtri e le azioni
add_filter('woocommerce_add_cart_item_data', 'dreamshop_process_deposit_meta', 10, 3);
add_action('woocommerce_add_to_cart', 'dreamshop_log_cart_addition', 10, 6);

} // Chiusura del namespace globale
