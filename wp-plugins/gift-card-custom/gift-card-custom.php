<?php
/**
 * Plugin Name: Gift Card Custom
 * Plugin URI: https://dreamshop.it
 * Description: Sistema Gift Card semplice con gestione saldi utenti e prodotti variabili
 * Version: 2.0.0
 * Author: Plan Studios Group - FP
 * License: GPL v2 or later
 * Text Domain: gift-card-custom
 */

if (!defined('ABSPATH')) {
    exit;
}

// Definizioni costanti
define('GIFT_CARD_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('GIFT_CARD_PLUGIN_URL', plugin_dir_url(__FILE__));
define('GIFT_CARD_VERSION', '2.0.0');

// Classe principale del plugin
class GiftCard_Plugin {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('plugins_loaded', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    public function init() {
        // Verifica che WooCommerce sia attivo
        if (!class_exists('WooCommerce')) {
            add_action('admin_notices', array($this, 'woocommerce_missing_notice'));
            return;
        }
        
        $this->load_classes();
        $this->init_hooks();
    }
    
    private function load_classes() {
        require_once GIFT_CARD_PLUGIN_PATH . 'includes/class-database.php';
        require_once GIFT_CARD_PLUGIN_PATH . 'includes/class-admin.php';
        require_once GIFT_CARD_PLUGIN_PATH . 'includes/class-order-handler.php';
        require_once GIFT_CARD_PLUGIN_PATH . 'includes/class-api.php';
    }
    
    private function init_hooks() {
        new GiftCard_Database();
        new GiftCard_Admin();
        new GiftCard_Order_Handler();
        new GiftCard_API();
    }
    
    public function activate() {
        // Crea le tabelle del database
        require_once GIFT_CARD_PLUGIN_PATH . 'includes/class-database.php';
        GiftCard_Database::create_tables();
        
        // Flush rewrite rules
        flush_rewrite_rules();
    }
    
    public function deactivate() {
        flush_rewrite_rules();
    }
    
    public function woocommerce_missing_notice() {
        ?>
        <div class="error">
            <p><strong>Gift Card Custom</strong> richiede WooCommerce per funzionare. Per favore installa e attiva WooCommerce.</p>
        </div>
        <?php
    }
}

// Inizializza il plugin
function gift_card_custom() {
    return GiftCard_Plugin::get_instance();
}

// Avvia il plugin
gift_card_custom();