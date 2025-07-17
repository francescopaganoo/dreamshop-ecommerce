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
        $payment_plan = '';

        // Cerca i meta dati specifici
        foreach ($cart_item_data['meta_data'] as $key => $meta) {
            if (isset($meta['key']) && $meta['key'] === '_wc_convert_to_deposit' && isset($meta['value']) && $meta['value'] === 'yes') {
                $convert_to_deposit = true;
            }
            if (isset($meta['key']) && $meta['key'] === '_wc_deposit_type' && isset($meta['value'])) {
                $deposit_type = $meta['value'];
            }
            if (isset($meta['key']) && $meta['key'] === '_wc_deposit_amount' && isset($meta['value'])) {
                $deposit_amount = $meta['value'];
            }
            if (isset($meta['key']) && $meta['key'] === '_wc_payment_plan' && isset($meta['value'])) {
                $payment_plan = $meta['value'];
            }
        }

        // Se abbiamo identificato che questo articolo dovrebbe essere un acconto
        if ($convert_to_deposit) {
            error_log("[INFO] Convertendo prodotto ID: {$product_id} in prodotto con acconto. Tipo: {$deposit_type}, Importo: {$deposit_amount}");
            
            // Verifica se il prodotto supporta gli acconti
            $has_deposit = get_post_meta($product_id, '_wc_deposit_enabled', true);
            
            // Se il prodotto supporta acconti, imposta i dati necessari
            if ($has_deposit === 'yes' || $has_deposit === 'optional') {
                // Imposta i meta dati standard di WooCommerce Deposits
                $cart_item_data['wc_deposit_option'] = 'yes';
                
                // Metadati base per il deposito
                $cart_item_data['is_deposit'] = true;
                $cart_item_data['_wc_deposit_enabled'] = 'yes';
                $cart_item_data['_wc_deposit_type'] = $deposit_type;
                $cart_item_data['_wc_deposit_amount'] = $deposit_amount;
                
                // Calcola l'importo dell'acconto
                $product = wc_get_product($variation_id ? $variation_id : $product_id);
                $product_price = $product->get_price();
                
                // Calcola importo acconto e importo totale
                if ($deposit_type === 'percent') {
                    $deposit_value = ($product_price * floatval($deposit_amount)) / 100;
                } else {
                    $deposit_value = floatval($deposit_amount);
                }
                
                // Arrotonda a 2 decimali
                $deposit_value = round($deposit_value, 2);
                
                // Aggiungi importi calcolati
                $cart_item_data['deposit_amount'] = $deposit_value;
                $cart_item_data['full_amount'] = $product_price;
                
                // Aggiungi anche gli importi senza tasse (usati da WooCommerce Deposits)
                $cart_item_data['_deposit_deposit_amount_ex_tax'] = wc_get_price_excluding_tax($product, ['price' => $deposit_value]);
                $cart_item_data['_deposit_full_amount_ex_tax'] = wc_get_price_excluding_tax($product);
                
                // Se c'è un piano di pagamento, lo aggiungiamo
                if (!empty($payment_plan)) {
                    $cart_item_data['payment_plan'] = $payment_plan;
                }
                
                error_log("[INFO] Prodotto convertito con successo in prodotto con acconto. Meta dati aggiunti:");
                error_log(json_encode($cart_item_data));
            } else {
                error_log("[WARNING] Il prodotto ID: {$product_id} non supporta acconti. Valore _wc_deposit_enabled: {$has_deposit}");
            }
        }
    }
    
    // Assicurati che i metadati siano coerenti sia come proprietà dirette che in formato meta_data
    if (isset($cart_item_data['_wc_convert_to_deposit']) && $cart_item_data['_wc_convert_to_deposit'] === 'yes') {
        // Assicurati che i metadati siano coerenti anche in formato meta_data
        if (!isset($cart_item_data['meta_data'])) {
            $cart_item_data['meta_data'] = [];
        }
        
        // Aggiungi o aggiorna i metadati nel formato strutturato
        $cart_item_data['meta_data'][] = [
            'key' => '_wc_convert_to_deposit',
            'value' => 'yes'
        ];
        $cart_item_data['meta_data'][] = [
            'key' => '_wc_deposit_type',
            'value' => $cart_item_data['_wc_deposit_type'] ?? 'percent'
        ];
        $cart_item_data['meta_data'][] = [
            'key' => '_wc_deposit_amount',
            'value' => $cart_item_data['_wc_deposit_amount'] ?? '40'
        ];
        
        error_log("[INFO] Meta_data strutturati sincronizzati con le proprietà dirette: " . json_encode($cart_item_data['meta_data']));
    }
    
    return $cart_item_data;
}

/**
 * Processa i metadati degli articoli dell'ordine per gli acconti
 * da utilizzare quando si crea un ordine via API
 * 
 * @param array $item_data Dati dell'articolo dell'ordine
 * @return array Dati dell'articolo dell'ordine modificati con metadati acconto
 */
function dreamshop_process_order_item_deposit_meta($item_data) {
    // Verifica se ci sono metadati di acconto da processare
    if (!isset($item_data['meta_data']) || !is_array($item_data['meta_data'])) {
        return $item_data;
    }
    
    $convert_to_deposit = false;
    $deposit_type = 'percent';
    $deposit_amount = '40';
    $payment_plan = '';
    
    // Estrai i metadati di acconto
    foreach ($item_data['meta_data'] as $meta) {
        if (isset($meta['key']) && $meta['key'] === '_wc_convert_to_deposit' && isset($meta['value']) && $meta['value'] === 'yes') {
            $convert_to_deposit = true;
        }
        if (isset($meta['key']) && $meta['key'] === '_wc_deposit_type' && isset($meta['value'])) {
            $deposit_type = $meta['value'];
        }
        if (isset($meta['key']) && $meta['key'] === '_wc_deposit_amount' && isset($meta['value'])) {
            $deposit_amount = $meta['value'];
        }
        if (isset($meta['key']) && $meta['key'] === '_wc_payment_plan' && isset($meta['value'])) {
            $payment_plan = $meta['value'];
        }
    }
    
    // Se questo articolo deve essere convertito in acconto
    if ($convert_to_deposit) {
        $product = wc_get_product($item_data['product_id']);
        if (!$product) {
            return $item_data;
        }
        
        $product_price = $product->get_price();
        
        // Calcola importo acconto
        if ($deposit_type === 'percent') {
            $deposit_value = ($product_price * floatval($deposit_amount)) / 100;
        } else {
            $deposit_value = floatval($deposit_amount);
        }
        
        // Arrotonda a 2 decimali
        $deposit_value = round($deposit_value, 2);
        
        // Aggiungi metadati necessari per WooCommerce Deposits
        $item_data['meta_data'][] = [
            'key' => 'is_deposit',
            'value' => 'yes'
        ];
        
        $item_data['meta_data'][] = [
            'key' => 'deposit_amount',
            'value' => $deposit_value
        ];
        
        $item_data['meta_data'][] = [
            'key' => 'full_amount',
            'value' => $product_price
        ];
        
        $item_data['meta_data'][] = [
            'key' => '_deposit_deposit_amount_ex_tax',
            'value' => wc_get_price_excluding_tax($product, ['price' => $deposit_value])
        ];
        
        $item_data['meta_data'][] = [
            'key' => '_deposit_full_amount_ex_tax',
            'value' => wc_get_price_excluding_tax($product)
        ];
        
        // Se c'è un piano di pagamento
        if (!empty($payment_plan)) {
            $item_data['meta_data'][] = [
                'key' => 'payment_plan',
                'value' => $payment_plan
            ];
        }
    }
    
    return $item_data;
}

/**
 * Processa gli articoli di un ordine per gestire gli acconti
 * 
 * @param WC_Order $order Oggetto ordine
 */
function dreamshop_process_order_deposits($order) {
    $has_deposit = false;
    
    // Controlla se almeno un articolo dell'ordine è un deposito
    foreach ($order->get_items() as $item) {
        $is_deposit = $item->get_meta('is_deposit');
        if ($is_deposit === 'yes') {
            $has_deposit = true;
            break;
        }
    }
    
    // Se l'ordine contiene acconti, imposta lo stato su partial-payment
    if ($has_deposit) {
        $order->set_status('partial-payment');
        $order->save();
    }
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
add_action('woocommerce_checkout_order_processed', 'dreamshop_process_order_deposits', 10, 1);
add_action('woocommerce_rest_insert_shop_order_object', 'dreamshop_process_order_deposits', 10, 1);

} // Chiusura del namespace globale
