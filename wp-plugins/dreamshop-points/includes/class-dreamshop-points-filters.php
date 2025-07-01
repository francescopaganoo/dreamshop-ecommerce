<?php
/**
 * Filtri avanzati per compatibilità coupon
 * 
 * Questo file implementa una soluzione radicale per permettere l'uso simultaneo di coupon points e altri coupon,
 * anche quando hanno il flag individual_use attivato.
 */

if (!class_exists('DreamShop_Points_Coupon_Filters')) {
    class DreamShop_Points_Coupon_Filters {
        
        // Flag per evitare ricorsione infinita
        private $preventing_recursion = false;
        
        public function __construct() {
            // SOLUZIONE DRASTICA: Sostituisce completamente la logica di validazione dei coupon individual_use
            add_filter('woocommerce_coupon_get_individual_use', array($this, 'disable_individual_use_for_points_coupons'), 999, 2);
            
            // Considera i coupon punti sempre validi con la massima priorità
            add_filter('woocommerce_coupon_is_valid', array($this, 'always_validate_points_coupons'), 999, 2);
            
            // Bypass totale del controllo di errore per coupon con individual_use
            add_filter('woocommerce_coupon_error', array($this, 'bypass_coupon_restrictions'), 999, 3);
            
            // Salva i coupon applicati per prevenirne la rimozione
            add_action('woocommerce_applied_coupon', array($this, 'save_applied_points_coupon'), 10, 1);
            
            // Questo è un hook cruciale che interviene prima che WC provi a rimuovere coupon esistenti
            add_action('woocommerce_before_checkout_form', array($this, 'preserve_points_coupon'), 5);
            add_action('woocommerce_before_cart', array($this, 'preserve_points_coupon'), 5);
            
            // Debug hook per verificare lo stato dei coupon nel carrello
            add_action('woocommerce_after_cart', array($this, 'debug_coupons'));
            
            // Hook che intercetta direttamente il tentativo di rimuovere coupon
            add_action('woocommerce_cart_calculate_fees', array($this, 'prevent_coupon_removal'), 1);
            
            // Modifica direttamente la funzione is_valid di WC_Coupon
            add_filter('woocommerce_coupon_is_valid_for_cart', array($this, 'force_coupon_validity_in_cart'), 999, 2);
        }

        /**
         * Disabilita completamente il flag individual_use per permettere combinazioni con coupon punti
         */
        public function disable_individual_use_for_points_coupons($individual_use, $coupon) {
            // Ottieni i coupon applicati
            if (!WC()->cart || $this->preventing_recursion) {
                return $individual_use;
            }
            
            $this->preventing_recursion = true;
            $applied_coupons = WC()->cart->get_applied_coupons();
            $this->preventing_recursion = false;
            
            // Se ci sono coupon punti applicati, disabilita individual_use per tutti
            foreach ($applied_coupons as $applied_code) {
                if ($applied_code !== $coupon->get_code()) {
                    $other_coupon_id = wc_get_coupon_id_by_code($applied_code);
                    $is_points_coupon = get_post_meta($other_coupon_id, '_dreamshop_points_coupon', true) === 'yes';
                    
                    if ($is_points_coupon) {
                        // C'è un coupon punti, disabilita individual_use per tutti
                        error_log("DreamShop Points: Disabilitando individual_use per il coupon {$coupon->get_code()} perché ci sono coupon punti");
                        return false;
                    }
                }
            }
            
            // Controlla se questo stesso è un coupon punti
            $is_current_points_coupon = get_post_meta($coupon->get_id(), '_dreamshop_points_coupon', true) === 'yes';
            if ($is_current_points_coupon) {
                // Se è un coupon punti, disabilita individual_use
                return false;
            }
            
            return $individual_use;
        }
        
        /**
         * Bypass completo delle restrizioni per i coupon punti
         */
        public function bypass_coupon_restrictions($err, $err_code, $coupon) {
            if (!$coupon) {
                return $err;
            }
            
            // Se l'errore riguarda l'uso di coupon insieme a individual_use
            if ($err_code == 104 || $err_code == 105) {
                // Controlla se c'è almeno un coupon punti nel carrello
                if (WC()->cart) {
                    $applied_coupons = WC()->cart->get_applied_coupons();
                    foreach ($applied_coupons as $code) {
                        $other_coupon_id = wc_get_coupon_id_by_code($code);
                        $is_points_coupon = get_post_meta($other_coupon_id, '_dreamshop_points_coupon', true) === 'yes';
                        if ($is_points_coupon) {
                            error_log("DreamShop Points: Ignorando errore $err_code per il coupon {$coupon->get_code()} perché c'è un coupon punti");
                            return ''; // Ignora l'errore
                        }
                    }
                }
                
                // Controlla se questo stesso coupon è un coupon punti
                $is_current_points_coupon = get_post_meta($coupon->get_id(), '_dreamshop_points_coupon', true) === 'yes';
                if ($is_current_points_coupon) {
                    error_log("DreamShop Points: Ignorando errore $err_code per il coupon punti {$coupon->get_code()}");
                    return ''; // Ignora l'errore
                }
            }
            
            return $err;
        }
        
        /**
         * Forza la validità dei coupon punti
         */
        public function always_validate_points_coupons($valid, $coupon) {
            if (!$valid) {
                // Controlla se questo è un coupon dei punti
                $is_points_coupon = get_post_meta($coupon->get_id(), '_dreamshop_points_coupon', true) === 'yes';
                if ($is_points_coupon) {
                    error_log("DreamShop Points: Forzando validità per il coupon punti {$coupon->get_code()}");
                    return true; // Forza la validità
                }
            }
            return $valid;
        }
        
        /**
         * Forza la validità dei coupon nel carrello
         */
        public function force_coupon_validity_in_cart($valid, $coupon) {
            if (!$valid) {
                // Controlla se questo è un coupon dei punti
                $is_points_coupon = get_post_meta($coupon->get_id(), '_dreamshop_points_coupon', true) === 'yes';
                if ($is_points_coupon) {
                    error_log("DreamShop Points: Forzando validità nel carrello per il coupon punti {$coupon->get_code()}");
                    return true; // Forza la validità
                }
                
                // Se c'è un coupon punti nel carrello, permetti anche l'applicazione di altri coupon
                $applied_coupons = WC()->cart ? WC()->cart->get_applied_coupons() : [];
                foreach ($applied_coupons as $code) {
                    $other_coupon_id = wc_get_coupon_id_by_code($code);
                    $is_points_coupon = get_post_meta($other_coupon_id, '_dreamshop_points_coupon', true) === 'yes';
                    if ($is_points_coupon) {
                        error_log("DreamShop Points: Forzando validità per il coupon {$coupon->get_code()} perché è presente un coupon punti");
                        return true;
                    }
                }
            }
            return $valid;
        }
        
        /**
         * Salva i coupon punti applicati
         */
        public function save_applied_points_coupon($coupon_code) {
            // Verifica se questo è un coupon punti
            $coupon_id = wc_get_coupon_id_by_code($coupon_code);
            $is_points_coupon = get_post_meta($coupon_id, '_dreamshop_points_coupon', true) === 'yes';
            
            if ($is_points_coupon) {
                // Salva questo coupon punti nella sessione
                $saved_points_coupons = WC()->session->get('dreamshop_points_coupons', array());
                if (!in_array($coupon_code, $saved_points_coupons)) {
                    $saved_points_coupons[] = $coupon_code;
                    WC()->session->set('dreamshop_points_coupons', $saved_points_coupons);
                    error_log("DreamShop Points: Coupon punti $coupon_code salvato nella sessione");
                }
            }
            
            // Se ci sono coupon individual_use standard, forzane la modifica se questo è un coupon punti
            if ($is_points_coupon) {
                $applied_coupons = WC()->cart->get_applied_coupons();
                foreach ($applied_coupons as $applied_code) {
                    if ($applied_code !== $coupon_code) {
                        $other_coupon = new WC_Coupon($applied_code);
                        if ($other_coupon && $other_coupon->get_individual_use()) {
                            // Forza l'impostazione del meta individual_use a false
                            update_post_meta($other_coupon->get_id(), 'individual_use', 'no');
                        }
                    }
                }
                
                // Forza il coupon dei punti a diventare sempre valido
                // Questo è cruciale per bypassare le restrizioni di WooCommerce
                update_post_meta($coupon_id, '_bypass_dreamshop_validation', 'yes');
            }
        }
        
        /**
         * Preserva i coupon punti nel carrello
         */
        public function preserve_points_coupon() {
            if (!WC()->cart || !WC()->session) {
                return;
            }
            
            // Recupera i coupon punti salvati nella sessione
            $saved_points_coupons = WC()->session->get('dreamshop_points_coupons', array());
            $applied_coupons = WC()->cart->get_applied_coupons();
            
            // Controlla se c'è almeno un coupon punti salvato che non è più applicato
            foreach ($saved_points_coupons as $points_coupon) {
                if (!in_array($points_coupon, $applied_coupons)) {
                    // Verifica che il coupon esista ancora
                    $coupon_id = wc_get_coupon_id_by_code($points_coupon);
                    if ($coupon_id) {
                        error_log("DreamShop Points: Ripristino del coupon punti $points_coupon nel carrello");
                        
                        // Disabilita temporaneamente i filtri che potrebbero interferire
                        remove_all_filters('woocommerce_coupon_is_valid');
                        remove_all_filters('woocommerce_coupon_error');
                        
                        // Riapplica il coupon al carrello
                        WC()->cart->add_discount($points_coupon);
                        
                        // Ripristina i filtri
                        add_filter('woocommerce_coupon_is_valid', array($this, 'always_validate_points_coupons'), 999, 2);
                        add_filter('woocommerce_coupon_error', array($this, 'bypass_coupon_restrictions'), 999, 3);
                    }
                }
            }
        }
        
        /**
         * Previene la rimozione dei coupon punti
         */
        public function prevent_coupon_removal() {
            if (!WC()->cart || !WC()->session) {
                return;
            }
            
            // Recupera i coupon punti salvati nella sessione
            $saved_points_coupons = WC()->session->get('dreamshop_points_coupons', array());
            if (empty($saved_points_coupons)) {
                return;
            }
            
            // Aggiungi un filtro che impedisce la rimozione dei coupon punti
            add_filter('woocommerce_cart_remove_coupon_object', function($remove, $coupon) use ($saved_points_coupons) {
                if (in_array($coupon->get_code(), $saved_points_coupons)) {
                    error_log("DreamShop Points: Prevenuta rimozione del coupon punti {$coupon->get_code()}");
                    return false;
                }
                return $remove;
            }, 999, 2);
            
            // Interviene direttamente sulla struttura interna di WC_Cart per ripristinare i coupon punti
            $applied_coupons = WC()->cart->get_applied_coupons();
            $missing_coupons = array_diff($saved_points_coupons, $applied_coupons);
            
            foreach ($missing_coupons as $points_coupon) {
                // Verifica che il coupon esista ancora
                $coupon_id = wc_get_coupon_id_by_code($points_coupon);
                if ($coupon_id) {
                    error_log("DreamShop Points: Ripristino forzato del coupon punti $points_coupon nel carrello");
                    
                    // Forza l'aggiunta del coupon punti di nuovo al carrello
                    WC()->cart->applied_coupons[] = $points_coupon;
                    
                    // Rimuovi eventuali duplicati
                    WC()->cart->applied_coupons = array_unique(WC()->cart->applied_coupons);
                }
            }
        }
        
        /**
         * Stampa a schermo i coupon applicati per debug
         */
        public function debug_coupons() {
            if (defined('WP_DEBUG') && WP_DEBUG && current_user_can('manage_options')) {
                echo "<!-- DREAMSHOP POINTS DEBUG: ";
                $applied_coupons = WC()->cart ? WC()->cart->get_applied_coupons() : [];
                echo "Coupon applicati: " . implode(', ', $applied_coupons);
                
                // Verifica quali sono coupon punti
                $points_coupons = [];
                foreach ($applied_coupons as $code) {
                    $coupon_id = wc_get_coupon_id_by_code($code);
                    $is_points_coupon = get_post_meta($coupon_id, '_dreamshop_points_coupon', true) === 'yes';
                    if ($is_points_coupon) {
                        $points_coupons[] = $code;
                    }
                }
                
                echo " | Coupon punti: " . implode(', ', $points_coupons);
                echo " -->";
            }
        }
    }

    // Inizializza la classe
    add_action('woocommerce_init', function() {
        new DreamShop_Points_Coupon_Filters();
    });
}
