<?php
/**
 * REST API endpoints for DreamShop Product Notifications
 */

if (!defined('ABSPATH')) {
    exit;
}

class DSPN_API {
    
    private $database;
    
    public function __construct() {
        $this->database = new DSPN_Database();
        add_action('rest_api_init', array($this, 'register_routes'));
    }
    
    /**
     * Register REST API routes
     */
    public function register_routes() {
        register_rest_route('dspn/v1', '/subscribe', array(
            'methods' => 'POST',
            'callback' => array($this, 'subscribe_to_product'),
            'permission_callback' => '__return_true',
            'args' => array(
                'email' => array(
                    'required' => true,
                    'type' => 'string',
                    'validate_callback' => array($this, 'validate_email')
                ),
                'product_id' => array(
                    'required' => true,
                    'type' => 'integer'
                ),
                'customer_name' => array(
                    'required' => false,
                    'type' => 'string',
                    'default' => ''
                )
            )
        ));
        
        register_rest_route('dspn/v1', '/unsubscribe', array(
            'methods' => 'POST',
            'callback' => array($this, 'unsubscribe_from_product'),
            'permission_callback' => '__return_true',
            'args' => array(
                'email' => array(
                    'required' => true,
                    'type' => 'string',
                    'validate_callback' => array($this, 'validate_email')
                ),
                'product_id' => array(
                    'required' => true,
                    'type' => 'integer'
                )
            )
        ));
        
        register_rest_route('dspn/v1', '/check-subscription', array(
            'methods' => 'GET',
            'callback' => array($this, 'check_subscription_status'),
            'permission_callback' => '__return_true',
            'args' => array(
                'email' => array(
                    'required' => true,
                    'type' => 'string',
                    'validate_callback' => array($this, 'validate_email')
                ),
                'product_id' => array(
                    'required' => true,
                    'type' => 'integer'
                )
            )
        ));
    }
    
    /**
     * Subscribe to product notifications
     */
    public function subscribe_to_product($request) {
        $email = sanitize_email($request['email']);
        $product_id = intval($request['product_id']);
        $customer_name = sanitize_text_field($request['customer_name']);
        
        // Check if WooCommerce is active
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_required', 'WooCommerce è richiesto', array('status' => 400));
        }
        
        // Add subscription
        $result = $this->database->add_subscription($email, $product_id, $customer_name);
        
        if (is_wp_error($result)) {
            return new WP_Error(
                $result->get_error_code(),
                $result->get_error_message(),
                array('status' => 400)
            );
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Iscrizione completata con successo! Ti avviseremo quando il prodotto sarà disponibile.',
            'subscription_id' => $result
        ), 200);
    }
    
    /**
     * Unsubscribe from product notifications
     */
    public function unsubscribe_from_product($request) {
        global $wpdb;
        
        $email = sanitize_email($request['email']);
        $product_id = intval($request['product_id']);
        
        $database = new DSPN_Database();
        
        $result = $wpdb->update(
            $wpdb->prefix . 'dspn_notifications',
            array('status' => 'cancelled'),
            array('email' => $email, 'product_id' => $product_id, 'status' => 'pending'),
            array('%s'),
            array('%s', '%d', '%s')
        );
        
        if ($result === false) {
            return new WP_Error('db_error', 'Errore durante la cancellazione', array('status' => 500));
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Disiscrizione completata con successo.'
        ), 200);
    }
    
    /**
     * Check subscription status
     */
    public function check_subscription_status($request) {
        global $wpdb;
        
        $email = sanitize_email($request['email']);
        $product_id = intval($request['product_id']);
        
        $subscription = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}dspn_notifications WHERE email = %s AND product_id = %d AND status = 'pending'",
            $email,
            $product_id
        ));
        
        return new WP_REST_Response(array(
            'subscribed' => !empty($subscription),
            'subscription' => $subscription
        ), 200);
    }
    
    /**
     * Validate email
     */
    public function validate_email($email) {
        return is_email($email);
    }
}