<?php
/**
 * Plugin Name: Gift Card Custom
 * Plugin URI: https://your-domain.com/
 * Description: Plugin per gestione gift card con saldo utente e generazione coupon on-demand
 * Version: 1.0.0
 * Author: Francesco Pagano
 * License: GPL v2 or later
 * Text Domain: gift-card-custom
 */

if (!defined('ABSPATH')) {
    exit;
}

define('GIFT_CARD_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('GIFT_CARD_PLUGIN_URL', plugin_dir_url(__FILE__));

class GiftCardCustom {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('init', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    public function init() {
        $this->load_classes();
        $this->setup_hooks();
    }
    
    private function load_classes() {
        require_once GIFT_CARD_PLUGIN_PATH . 'includes/class-database.php';
        require_once GIFT_CARD_PLUGIN_PATH . 'includes/class-api.php';
        require_once GIFT_CARD_PLUGIN_PATH . 'includes/class-woocommerce-integration.php';
        require_once GIFT_CARD_PLUGIN_PATH . 'includes/class-gift-card-manager.php';
    }
    
    private function setup_hooks() {
        new GiftCard_Database();
        new GiftCard_API();
        new GiftCard_WooCommerce_Integration();
        new GiftCard_Manager();
    }
    
    public function activate() {
        // Carica le classi necessarie per l'attivazione
        require_once GIFT_CARD_PLUGIN_PATH . 'includes/class-database.php';
        GiftCard_Database::create_tables();
        flush_rewrite_rules();
    }
    
    public function deactivate() {
        flush_rewrite_rules();
    }
}

function gift_card_custom() {
    return GiftCardCustom::get_instance();
}

gift_card_custom();