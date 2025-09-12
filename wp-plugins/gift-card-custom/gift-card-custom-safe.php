<?php
/**
 * Plugin Name: Gift Card Custom (Safe Version)
 * Plugin URI: https://your-domain.com/
 * Description: Plugin per gestione gift card con saldo utente e generazione coupon on-demand - Versione sicura
 * Version: 1.0.1
 * Author: Francesco Pagano
 * License: GPL v2 or later
 * Text Domain: gift-card-custom
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('GIFT_CARD_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('GIFT_CARD_PLUGIN_URL', plugin_dir_url(__FILE__));
define('GIFT_CARD_VERSION', '1.0.1');

class GiftCardCustomSafe {
    
    private static $instance = null;
    private $plugin_path;
    private $includes_loaded = false;
    
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        $this->plugin_path = plugin_dir_path(__FILE__);
        
        // Register hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        
        // Initialize plugin
        add_action('plugins_loaded', array($this, 'init'));
    }
    
    public function init() {
        // Check if WooCommerce is active
        if (!class_exists('WooCommerce')) {
            add_action('admin_notices', array($this, 'woocommerce_missing_notice'));
            return;
        }
        
        // Load includes
        $this->load_includes();
        
        if ($this->includes_loaded) {
            $this->setup_hooks();
        }
    }
    
    private function load_includes() {
        $includes = array(
            'includes/class-database.php',
            'includes/class-api.php', 
            'includes/class-woocommerce-integration.php',
            'includes/class-gift-card-manager.php'
        );
        
        foreach ($includes as $file) {
            $file_path = $this->plugin_path . $file;
            
            if (file_exists($file_path)) {
                require_once $file_path;
            } else {
                add_action('admin_notices', function() use ($file) {
                    echo '<div class="notice notice-error"><p>Gift Card Plugin: File mancante - ' . esc_html($file) . '</p></div>';
                });
                return;
            }
        }
        
        $this->includes_loaded = true;
    }
    
    private function setup_hooks() {
        // Check if classes exist before instantiating
        if (class_exists('GiftCard_Database')) {
            new GiftCard_Database();
        }
        
        if (class_exists('GiftCard_API')) {
            new GiftCard_API();
        }
        
        if (class_exists('GiftCard_WooCommerce_Integration')) {
            new GiftCard_WooCommerce_Integration();
        }
        
        if (class_exists('GiftCard_Manager')) {
            new GiftCard_Manager();
        }
    }
    
    public function activate() {
        // Check WordPress and WooCommerce versions
        if (!$this->check_requirements()) {
            deactivate_plugins(plugin_basename(__FILE__));
            wp_die('Gift Card Plugin richiede WordPress 5.0+ e WooCommerce 3.0+');
        }
        
        // Load database class if not already loaded
        if (!class_exists('GiftCard_Database')) {
            $database_file = $this->plugin_path . 'includes/class-database.php';
            if (file_exists($database_file)) {
                require_once $database_file;
            } else {
                wp_die('Gift Card Plugin: File database class non trovato');
            }
        }
        
        // Create tables
        if (class_exists('GiftCard_Database')) {
            try {
                GiftCard_Database::create_tables();
                
                // Log successful activation
                error_log('Gift Card Plugin: Attivato con successo');
                
            } catch (Exception $e) {
                error_log('Gift Card Plugin: Errore durante attivazione - ' . $e->getMessage());
                wp_die('Errore durante l\'attivazione del Gift Card Plugin: ' . $e->getMessage());
            }
        }
        
        flush_rewrite_rules();
    }
    
    public function deactivate() {
        flush_rewrite_rules();
        error_log('Gift Card Plugin: Disattivato');
    }
    
    private function check_requirements() {
        global $wp_version;
        
        // Check WordPress version
        if (version_compare($wp_version, '5.0', '<')) {
            return false;
        }
        
        // Check WooCommerce
        if (!class_exists('WooCommerce')) {
            return false;
        }
        
        // Check WooCommerce version
        if (defined('WC_VERSION') && version_compare(WC_VERSION, '3.0', '<')) {
            return false;
        }
        
        return true;
    }
    
    public function woocommerce_missing_notice() {
        echo '<div class="notice notice-error"><p>';
        echo '<strong>Gift Card Plugin</strong> richiede WooCommerce per funzionare. ';
        echo 'Installa e attiva WooCommerce prima di utilizzare questo plugin.';
        echo '</p></div>';
    }
}

// Initialize the plugin
function gift_card_custom_safe() {
    return GiftCardCustomSafe::get_instance();
}

// Start the plugin
gift_card_custom_safe();