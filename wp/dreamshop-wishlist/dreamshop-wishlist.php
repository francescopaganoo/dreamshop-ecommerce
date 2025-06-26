<?php
/**
 * Plugin Name: DreamShop Wishlist
 * Description: A simple wishlist plugin for DreamShop e-commerce
 * Version: 1.0.0
 * Author: DreamShop
 * Text Domain: dreamshop-wishlist
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class DreamShop_Wishlist {
    
    /**
     * Constructor
     */
    public function __construct() {
        // Create database table on plugin activation
        register_activation_hook(__FILE__, array($this, 'create_wishlist_table'));
        
        // Register REST API endpoints
        add_action('rest_api_init', array($this, 'register_endpoints'));
    }
    
    /**
     * Create wishlist database table
     */
    public function create_wishlist_table() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'dreamshop_wishlist';
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            user_id mediumint(9) NOT NULL,
            product_id mediumint(9) NOT NULL,
            date_added datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY user_product (user_id, product_id)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
    
    /**
     * Register REST API endpoints
     */
    public function register_endpoints() {
        // Get wishlist items for a user
        register_rest_route('dreamshop/v1', '/wishlist/(?P<user_id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_wishlist'),
            'permission_callback' => '__return_true',
        ));
        
        // Add item to wishlist
        register_rest_route('dreamshop/v1', '/wishlist/add', array(
            'methods' => 'POST',
            'callback' => array($this, 'add_to_wishlist'),
            'permission_callback' => '__return_true',
        ));
        
        // Remove item from wishlist
        register_rest_route('dreamshop/v1', '/wishlist/remove', array(
            'methods' => 'POST',
            'callback' => array($this, 'remove_from_wishlist'),
            'permission_callback' => '__return_true',
        ));
        
        // Check if product is in wishlist
        register_rest_route('dreamshop/v1', '/wishlist/is-in-wishlist', array(
            'methods' => 'POST',
            'callback' => array($this, 'is_in_wishlist'),
            'permission_callback' => '__return_true',
        ));
    }
    
    /**
     * Get wishlist items for a user
     */
    public function get_wishlist($request) {
        global $wpdb;
        
        $user_id = $request['user_id'];
        
        if (empty($user_id)) {
            return new WP_Error('invalid_user', 'Invalid user ID', array('status' => 400));
        }
        
        $table_name = $wpdb->prefix . 'dreamshop_wishlist';
        
        $wishlist_items = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM $table_name WHERE user_id = %d ORDER BY date_added DESC",
                $user_id
            ),
            ARRAY_A
        );
        
        $products = array();
        
        foreach ($wishlist_items as $item) {
            $product = wc_get_product($item['product_id']);
            
            if ($product) {
                $products[] = array(
                    'id' => $product->get_id(),
                    'name' => $product->get_name(),
                    'price' => $product->get_price(),
                    'regular_price' => $product->get_regular_price(),
                    'sale_price' => $product->get_sale_price(),
                    'image' => wp_get_attachment_image_src(get_post_thumbnail_id($product->get_id()), 'full'),
                    'permalink' => get_permalink($product->get_id()),
                    'date_added' => $item['date_added'],
                );
            }
        }
        
        return rest_ensure_response($products);
    }
    
    /**
     * Add item to wishlist
     */
    public function add_to_wishlist($request) {
        global $wpdb;
        
        $params = $request->get_json_params();
        
        $user_id = isset($params['user_id']) ? intval($params['user_id']) : 0;
        $product_id = isset($params['product_id']) ? intval($params['product_id']) : 0;
        
        if (empty($user_id) || empty($product_id)) {
            return new WP_Error('invalid_data', 'User ID and Product ID are required', array('status' => 400));
        }
        
        $table_name = $wpdb->prefix . 'dreamshop_wishlist';
        
        // Check if the product is already in the wishlist
        $existing = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT id FROM $table_name WHERE user_id = %d AND product_id = %d",
                $user_id,
                $product_id
            )
        );
        
        if ($existing) {
            return rest_ensure_response(array(
                'success' => true,
                'message' => 'Product already in wishlist',
                'already_exists' => true,
            ));
        }
        
        // Add to wishlist
        $result = $wpdb->insert(
            $table_name,
            array(
                'user_id' => $user_id,
                'product_id' => $product_id,
                'date_added' => current_time('mysql'),
            ),
            array('%d', '%d', '%s')
        );
        
        if ($result === false) {
            return new WP_Error('db_error', 'Could not add product to wishlist', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Product added to wishlist',
            'id' => $wpdb->insert_id,
        ));
    }
    
    /**
     * Remove item from wishlist
     */
    public function remove_from_wishlist($request) {
        global $wpdb;
        
        $params = $request->get_json_params();
        
        $user_id = isset($params['user_id']) ? intval($params['user_id']) : 0;
        $product_id = isset($params['product_id']) ? intval($params['product_id']) : 0;
        
        if (empty($user_id) || empty($product_id)) {
            return new WP_Error('invalid_data', 'User ID and Product ID are required', array('status' => 400));
        }
        
        $table_name = $wpdb->prefix . 'dreamshop_wishlist';
        
        $result = $wpdb->delete(
            $table_name,
            array(
                'user_id' => $user_id,
                'product_id' => $product_id,
            ),
            array('%d', '%d')
        );
        
        if ($result === false) {
            return new WP_Error('db_error', 'Could not remove product from wishlist', array('status' => 500));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Product removed from wishlist',
        ));
    }
    
    /**
     * Check if product is in wishlist
     */
    public function is_in_wishlist($request) {
        global $wpdb;
        
        $params = $request->get_json_params();
        
        $user_id = isset($params['user_id']) ? intval($params['user_id']) : 0;
        $product_id = isset($params['product_id']) ? intval($params['product_id']) : 0;
        
        if (empty($user_id) || empty($product_id)) {
            return new WP_Error('invalid_data', 'User ID and Product ID are required', array('status' => 400));
        }
        
        $table_name = $wpdb->prefix . 'dreamshop_wishlist';
        
        $exists = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM $table_name WHERE user_id = %d AND product_id = %d",
                $user_id,
                $product_id
            )
        );
        
        return rest_ensure_response(array(
            'in_wishlist' => (bool) $exists,
        ));
    }
}

// Initialize the plugin
new DreamShop_Wishlist();
