<?php
/**
 * Plugin Name: DreamShop Points
 * Description: Sistema di punti fedeltà per WooCommerce
 * Version: 1.0.0
 * Author: DreamShop
 * Text Domain: dreamshop-points
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 7.0
 * Woo: 8.2.0:8.2.0
 */

// Se questo file viene chiamato direttamente, interrompi l'esecuzione.
if (!defined('ABSPATH')) {
    exit;
}

// Definisci le costanti del plugin
define('DREAMSHOP_POINTS_VERSION', '1.0.0');
define('DREAMSHOP_POINTS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('DREAMSHOP_POINTS_PLUGIN_URL', plugin_dir_url(__FILE__));
define('DREAMSHOP_POINTS_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Classe principale del plugin
 */
class DreamShop_Points {
    
    /**
     * Istanza singleton
     *
     * @var DreamShop_Points
     */
    private static $instance = null;
    
    /**
     * Restituisce l'istanza singleton del plugin
     *
     * @return DreamShop_Points
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Costruttore
     */
    private function __construct() {
        // Dichiara la compatibilità HPOS prima di tutto
        add_action('before_woocommerce_init', array($this, 'declare_hpos_compatibility'));
        
        $this->load_dependencies();
        $this->define_admin_hooks();
        $this->define_public_hooks();
        $this->define_rest_api();
    }
    
    /**
     * Dichiara la compatibilità con HPOS (High-Performance Order Storage)
     */
    public function declare_hpos_compatibility() {
        if (class_exists('\Automattic\WooCommerce\Utilities\FeaturesUtil')) {
            \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
        }
    }
    
    /**
     * Carica le dipendenze del plugin
     */
    private function load_dependencies() {
        // Database
        require_once DREAMSHOP_POINTS_PLUGIN_DIR . 'includes/class-dreamshop-points-db.php';
        
        // API
        require_once DREAMSHOP_POINTS_PLUGIN_DIR . 'includes/class-dreamshop-points-api.php';
        
        // Filtri avanzati per compatibilità coupon
        require_once DREAMSHOP_POINTS_PLUGIN_DIR . 'includes/class-dreamshop-points-filters.php';
        
        // Admin
        require_once DREAMSHOP_POINTS_PLUGIN_DIR . 'admin/class-dreamshop-points-admin.php';
        
        // Public
        require_once DREAMSHOP_POINTS_PLUGIN_DIR . 'public/class-dreamshop-points-public.php';
    }
    
    /**
     * Definisce gli hook amministrativi
     */
    private function define_admin_hooks() {
        $admin = new DreamShop_Points_Admin();
        
        // Aggiunta dei menu e delle pagine admin
        add_action('admin_menu', array($admin, 'add_admin_menu'));
        
        // Aggiunta dei meta box
        add_action('add_meta_boxes', array($admin, 'add_order_points_meta_box'));
        
        // Salvataggio dei meta box
        add_action('save_post', array($admin, 'save_order_points_meta_box'), 10, 2);
    }
    
    /**
     * Definisce gli hook pubblici
     */
    private function define_public_hooks() {
        $public = new DreamShop_Points_Public();
        
        // Aggiunta dei punti quando un ordine passa a completato
        add_action('woocommerce_order_status_completed', array($public, 'add_points_on_order_complete'));
        
        // Mostra il saldo punti nella pagina Il Mio Account
        add_action('woocommerce_account_dashboard', array($public, 'show_points_balance'));
        
        // IMPORTANTE: Hook per la gestione della compatibilità tra coupon
        // Permetti ai coupon dei punti di funzionare insieme ai coupon individual_use
        add_filter('woocommerce_coupon_is_valid', array($this, 'enable_points_coupon_with_individual_use'), 20, 2);
        
        // Aggiungi i coupon dei punti all'elenco delle eccezioni per i coupon individual_use
        add_filter('woocommerce_coupon_get_individual_use_only', array($this, 'modify_individual_use_for_points_coupons'), 20, 2);
        
        // Permetti ai coupon dei punti di essere applicati anche se ci sono coupon individual_use
        add_filter('woocommerce_coupon_is_valid_for_cart', array($this, 'validate_points_coupon_for_cart'), 20, 2);
    }
    
    /**
     * Definisce gli endpoint REST API
     */
    private function define_rest_api() {
        $api = new DreamShop_Points_API();
        add_action('rest_api_init', array($api, 'register_endpoints'));
    }
    
    /**
     * Attivazione del plugin
     */
    public static function activate() {
        // Crea la tabella dei punti
        require_once DREAMSHOP_POINTS_PLUGIN_DIR . 'includes/class-dreamshop-points-db.php';
        $db = new DreamShop_Points_DB();
        $db->create_tables();
        
        // Imposta la versione del database
        update_option('dreamshop_points_db_version', DREAMSHOP_POINTS_VERSION);
    }
    
    /**
     * Disattivazione del plugin
     */
    public static function deactivate() {
        // Pulisci le pianificazioni
        wp_clear_scheduled_hook('dreamshop_points_daily_tasks');
    }
    
    /**
     * Disinstallazione del plugin
     */
    public static function uninstall() {
        // Se abilitata l'opzione, elimina tutti i dati
        if (get_option('dreamshop_points_delete_data_on_uninstall', false)) {
            global $wpdb;
            $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}dreamshop_points");
            $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}dreamshop_points_log");
            delete_option('dreamshop_points_db_version');
            delete_option('dreamshop_points_settings');
        }
    }
    
    /**
     * Permette ai coupon dei punti di funzionare insieme ai coupon individual_use
     * 
     * @param bool $valid Se il coupon è valido o no
     * @param WC_Coupon $coupon Oggetto coupon WooCommerce
     * @return bool
     */
    public function enable_points_coupon_with_individual_use($valid, $coupon) {
        // Se il coupon è già invalido, restituisci subito false
        if (!$valid) {
            return false;
        }

        // Controlla se questo è un coupon dei punti
        $is_points_coupon = get_post_meta($coupon->get_id(), '_dreamshop_points_coupon', true) === 'yes';
        
        if ($is_points_coupon) {
            // Forza la validità di questo coupon anche se ci sono coupon individual_use
            return true;
        }
        
        return $valid;
    }
    
    /**
     * Modifica il flag individual_use per i coupon dei punti
     * 
     * @param bool $individual_use Se il coupon è individual_use
     * @param WC_Coupon $coupon Oggetto coupon WooCommerce
     * @return bool
     */
    public function modify_individual_use_for_points_coupons($individual_use, $coupon) {
        // Se ci sono coupon di punti nel carrello, disabilita il flag individual_use per gli altri coupon
        if ($individual_use) {
            // Controlla se ci sono coupon dei punti applicati
            $applied_coupons = WC()->cart ? WC()->cart->get_applied_coupons() : [];
            
            foreach ($applied_coupons as $code) {
                $other_coupon_id = wc_get_coupon_id_by_code($code);
                $is_points_coupon = get_post_meta($other_coupon_id, '_dreamshop_points_coupon', true) === 'yes';
                
                if ($is_points_coupon) {
                    // C'è un coupon dei punti applicato, disabilita individual_use
                    return false;
                }
            }
        }
        
        return $individual_use;
    }
    
    /**
     * Valida i coupon dei punti per il carrello anche se ci sono coupon individual_use
     * 
     * @param bool $valid Se il coupon è valido per il carrello
     * @param WC_Coupon $coupon Oggetto coupon WooCommerce
     * @return bool
     */
    public function validate_points_coupon_for_cart($valid, $coupon) {
        // Se il coupon è già invalido, restituisci subito false
        if (!$valid) {
            return false;
        }
        
        // Controlla se questo è un coupon dei punti
        $is_points_coupon = get_post_meta($coupon->get_id(), '_dreamshop_points_coupon', true) === 'yes';
        
        if ($is_points_coupon) {
            // Se c'è un coupon individual_use applicato che non sia un coupon punti,
            // dobbiamo comunque permettere l'applicazione del coupon punti
            $applied_coupons = WC()->cart ? WC()->cart->get_applied_coupons() : [];
            
            foreach ($applied_coupons as $code) {
                if ($code !== $coupon->get_code()) {
                    $other_coupon = new WC_Coupon($code);
                    if ($other_coupon && $other_coupon->get_individual_use()) {
                        // C'è un coupon individual_use, ma permettiamo comunque l'uso del coupon punti
                        return true;
                    }
                }
            }
        }
        
        return $valid;
    }
}

// Registrazione dei hook di attivazione e disattivazione
register_activation_hook(__FILE__, array('DreamShop_Points', 'activate'));
register_deactivation_hook(__FILE__, array('DreamShop_Points', 'deactivate'));
register_uninstall_hook(__FILE__, array('DreamShop_Points', 'uninstall'));

// Avvio del plugin
function run_dreamshop_points() {
    return DreamShop_Points::get_instance();
}

// Inizializza il plugin
run_dreamshop_points();
