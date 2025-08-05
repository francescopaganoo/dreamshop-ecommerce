<?php
/**
 * Plugin Name: DreamShop Deferred Shipping
 * Plugin URI: https://dreamshop18.com
 * Description: Gestisce la spedizione posticipata per prodotti con costi di spedizione variabili
 * Version: 1.0.0
 * Author: DreamShop
 * License: GPL v2 or later
 * Text Domain: dreamshop-deferred-shipping
 * Domain Path: /languages
 * Requires at least: 5.0
 * Tested up to: 6.4
 * WC requires at least: 5.0
 * WC tested up to: 8.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Check if WooCommerce is active
if (!in_array('woocommerce/woocommerce.php', apply_filters('active_plugins', get_option('active_plugins')))) {
    return;
}

// Define plugin constants
define('DREAMSHOP_DEFERRED_SHIPPING_VERSION', '1.0.0');
define('DREAMSHOP_DEFERRED_SHIPPING_PLUGIN_FILE', __FILE__);
define('DREAMSHOP_DEFERRED_SHIPPING_PLUGIN_BASENAME', plugin_basename(__FILE__));
define('DREAMSHOP_DEFERRED_SHIPPING_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('DREAMSHOP_DEFERRED_SHIPPING_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Main plugin class
 */
class DreamShop_Deferred_Shipping {
    
    /**
     * Plugin instance
     */
    private static $instance = null;
    
    /**
     * Get plugin instance
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Constructor
     */
    private function __construct() {
        $this->init_hooks();
        $this->include_files();
    }
    
    /**
     * Initialize hooks
     */
    private function init_hooks() {
        add_action('plugins_loaded', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        register_uninstall_hook(__FILE__, array('DreamShop_Deferred_Shipping', 'uninstall'));
    }
    
    /**
     * Include required files
     */
    private function include_files() {
        require_once DREAMSHOP_DEFERRED_SHIPPING_PLUGIN_PATH . 'includes/class-deferred-shipping-database.php';
        require_once DREAMSHOP_DEFERRED_SHIPPING_PLUGIN_PATH . 'includes/class-deferred-shipping-admin.php';
        require_once DREAMSHOP_DEFERRED_SHIPPING_PLUGIN_PATH . 'includes/class-deferred-shipping-orders.php';
        require_once DREAMSHOP_DEFERRED_SHIPPING_PLUGIN_PATH . 'includes/class-deferred-shipping-emails.php';
    }
    
    /**
     * Initialize plugin
     */
    public function init() {
        // Load textdomain
        load_plugin_textdomain('dreamshop-deferred-shipping', false, dirname(DREAMSHOP_DEFERRED_SHIPPING_PLUGIN_BASENAME) . '/languages/');
        
        // Initialize classes
        DreamShop_Deferred_Shipping_Database::get_instance();
        DreamShop_Deferred_Shipping_Admin::get_instance();
        DreamShop_Deferred_Shipping_Orders::get_instance();
        DreamShop_Deferred_Shipping_Emails::get_instance();
    }
    
    /**
     * Plugin activation
     */
    public function activate() {
        // Create database tables
        DreamShop_Deferred_Shipping_Database::create_tables();
        
        // Set default options
        add_option('dreamshop_deferred_shipping_version', DREAMSHOP_DEFERRED_SHIPPING_VERSION);
        
        // Flush rewrite rules
        flush_rewrite_rules();
    }
    
    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Flush rewrite rules
        flush_rewrite_rules();
    }
    
    /**
     * Plugin uninstall
     */
    public static function uninstall() {
        // Remove database tables
        DreamShop_Deferred_Shipping_Database::drop_tables();
        
        // Remove options
        delete_option('dreamshop_deferred_shipping_version');
    }
}

// Initialize plugin
DreamShop_Deferred_Shipping::get_instance();