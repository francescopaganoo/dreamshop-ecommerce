<?php
/**
 * Plugin Name: DreamShop Product Notifications
 * Plugin URI: https://dreamshop.it
 * Description: Gestisce le notifiche quando i prodotti tornano disponibili. Gli utenti possono iscriversi per ricevere email quando un prodotto esaurito torna in stock.
 * Version: 1.0.0
 * Author: DreamShop
 * License: GPL v2 or later
 * Text Domain: dreamshop-product-notifications
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('DSPN_VERSION', '1.0.0');
define('DSPN_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('DSPN_PLUGIN_URL', plugin_dir_url(__FILE__));
define('DSPN_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Main plugin class
 */
class DreamShop_Product_Notifications {
    
    /**
     * Constructor
     */
    public function __construct() {
        add_action('init', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    /**
     * Initialize the plugin
     */
    public function init() {
        // Load includes
        $this->load_dependencies();
        
        // Initialize components
        if (is_admin()) {
            new DSPN_Admin();
        }
        
        new DSPN_Database();
        new DSPN_API();
        new DSPN_Stock_Monitor();
        new DSPN_Email_Handler();
    }
    
    /**
     * Load plugin dependencies
     */
    private function load_dependencies() {
        require_once DSPN_PLUGIN_DIR . 'includes/class-dspn-database.php';
        require_once DSPN_PLUGIN_DIR . 'includes/class-dspn-api.php';
        require_once DSPN_PLUGIN_DIR . 'includes/class-dspn-stock-monitor.php';
        require_once DSPN_PLUGIN_DIR . 'includes/class-dspn-email-handler.php';
        
        if (is_admin()) {
            require_once DSPN_PLUGIN_DIR . 'admin/class-dspn-admin.php';
        }
    }
    
    /**
     * Plugin activation
     */
    public function activate() {
        // Load database class before using it
        require_once DSPN_PLUGIN_DIR . 'includes/class-dspn-database.php';
        
        // Create database tables
        $database = new DSPN_Database();
        $database->create_tables();
        
        // Set default options
        add_option('dspn_email_template', $this->get_default_email_template());
        add_option('dspn_from_email', get_option('admin_email'));
        add_option('dspn_from_name', get_bloginfo('name'));
        add_option('dspn_enabled', '1');
    }
    
    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Clean up if needed
    }
    
    /**
     * Get default email template
     */
    private function get_default_email_template() {
        return '
        <h2>Il prodotto che stavi aspettando è tornato disponibile!</h2>
        <p>Ciao {customer_name},</p>
        <p>Abbiamo buone notizie per te! Il prodotto <strong>{product_name}</strong> che stavi aspettando è finalmente tornato disponibile nel nostro store.</p>
        <p><a href="{product_url}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Acquista Ora</a></p>
        <p>Non perdere questa opportunità, le quantità potrebbero essere limitate!</p>
        <p>Cordiali saluti,<br>Il team di DreamShop</p>
        ';
    }
}

// Initialize the plugin
new DreamShop_Product_Notifications();