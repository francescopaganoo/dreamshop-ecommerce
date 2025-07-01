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
        $this->load_dependencies();
        $this->define_admin_hooks();
        $this->define_public_hooks();
        $this->define_rest_api();
    }
    
    /**
     * Carica le dipendenze del plugin
     */
    private function load_dependencies() {
        // Database
        require_once DREAMSHOP_POINTS_PLUGIN_DIR . 'includes/class-dreamshop-points-db.php';
        
        // API
        require_once DREAMSHOP_POINTS_PLUGIN_DIR . 'includes/class-dreamshop-points-api.php';
        
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
