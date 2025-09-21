<?php
/**
 * Plugin Name: DreamShop Advanced Filters
 * Plugin URI: https://dreamshop.it
 * Description: Plugin custom per filtri avanzati di prodotti WooCommerce con performance ottimizzate
 * Version: 1.0.0
 * Author: Plan Studios Group - FP
 * License: GPL v2 or later
 * Text Domain: dreamshop-filters
 * Requires at least: 5.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 8.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('DREAMSHOP_FILTERS_VERSION', '1.0.0');
define('DREAMSHOP_FILTERS_PLUGIN_URL', plugin_dir_url(__FILE__));
define('DREAMSHOP_FILTERS_PLUGIN_PATH', plugin_dir_path(__FILE__));

/**
 * Check if WooCommerce is active
 */
function dreamshop_filters_check_woocommerce() {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', 'dreamshop_filters_woocommerce_missing_notice');
        return false;
    }
    return true;
}

/**
 * Admin notice for missing WooCommerce
 */
function dreamshop_filters_woocommerce_missing_notice() {
    ?>
    <div class="notice notice-error">
        <p><?php _e('DreamShop Advanced Filters richiede WooCommerce per funzionare.', 'dreamshop-filters'); ?></p>
    </div>
    <?php
}

/**
 * Main plugin class
 */
class DreamShop_Advanced_Filters {

    private static $instance = null;

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('plugins_loaded', [$this, 'init']);
    }

    public function init() {
        // Check if WooCommerce is active
        if (!dreamshop_filters_check_woocommerce()) {
            return;
        }

        // Declare WooCommerce compatibility
        add_action('before_woocommerce_init', [$this, 'declare_woocommerce_compatibility']);

        // Load plugin files
        $this->load_dependencies();

        // Initialize REST API
        add_action('rest_api_init', [$this, 'register_rest_routes']);

        // Add CORS headers for frontend calls
        add_action('rest_api_init', [$this, 'add_cors_headers']);
    }

    /**
     * Declare WooCommerce compatibility
     */
    public function declare_woocommerce_compatibility() {
        if (class_exists('\Automattic\WooCommerce\Utilities\FeaturesUtil')) {
            \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
            \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('cart_checkout_blocks', __FILE__, true);
        }
    }

    /**
     * Load plugin dependencies
     */
    private function load_dependencies() {
        require_once DREAMSHOP_FILTERS_PLUGIN_PATH . 'includes/class-product-query.php';
        require_once DREAMSHOP_FILTERS_PLUGIN_PATH . 'includes/class-rest-api.php';
        require_once DREAMSHOP_FILTERS_PLUGIN_PATH . 'includes/class-cache-manager.php';
    }

    /**
     * Register REST API routes
     */
    public function register_rest_routes() {
        $rest_api = new DreamShop_Filters_REST_API();
        $rest_api->register_routes();
    }

    /**
     * Add CORS headers for frontend requests
     */
    public function add_cors_headers() {
        remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
        add_filter('rest_pre_serve_request', function($served, $result, $request, $server) {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-WP-Nonce');

            if ('OPTIONS' === $request->get_method()) {
                header('Access-Control-Max-Age: 86400');
                exit;
            }

            return $served;
        }, 10, 4);
    }
}

/**
 * Plugin activation hook
 */
function dreamshop_filters_activate() {
    // Flush rewrite rules to ensure REST API endpoints work
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'dreamshop_filters_activate');

/**
 * Plugin deactivation hook
 */
function dreamshop_filters_deactivate() {
    // Clean up any cached data
    wp_cache_flush();
    flush_rewrite_rules();
}
register_deactivation_hook(__FILE__, 'dreamshop_filters_deactivate');

/**
 * Initialize the plugin
 */
function dreamshop_filters_init() {
    return DreamShop_Advanced_Filters::getInstance();
}

// Start the plugin
dreamshop_filters_init();