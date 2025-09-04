<?php
/**
 * Stock monitoring for DreamShop Product Notifications
 */

if (!defined('ABSPATH')) {
    exit;
}

class DSPN_Stock_Monitor {
    
    private $database;
    private $email_handler;
    
    public function __construct() {
        $this->database = new DSPN_Database();
        
        // Hook into WooCommerce stock changes
        add_action('woocommerce_product_set_stock', array($this, 'on_stock_change'));
        add_action('woocommerce_variation_set_stock', array($this, 'on_stock_change'));
        add_action('woocommerce_product_set_stock_status', array($this, 'on_stock_status_change'), 10, 3);
        add_action('woocommerce_variation_set_stock_status', array($this, 'on_stock_status_change'), 10, 3);
        
        // Hook into product save
        add_action('woocommerce_update_product', array($this, 'check_product_availability'));
        add_action('woocommerce_new_product', array($this, 'check_product_availability'));
        
        // Initialize email handler when needed
        add_action('init', array($this, 'init_email_handler'));
    }
    
    /**
     * Initialize email handler
     */
    public function init_email_handler() {
        if (!isset($this->email_handler)) {
            $this->email_handler = new DSPN_Email_Handler();
        }
    }
    
    /**
     * Handle stock quantity changes
     */
    public function on_stock_change($product_id) {
        $this->check_product_availability($product_id);
    }
    
    /**
     * Handle stock status changes
     */
    public function on_stock_status_change($product_id, $stock_status, $product) {
        if ($stock_status === 'instock') {
            $this->check_product_availability($product_id);
        }
    }
    
    /**
     * Check if product is now available and send notifications
     */
    public function check_product_availability($product_id) {
        // Skip if plugin is disabled
        if (get_option('dspn_enabled') !== '1') {
            return;
        }
        
        $product = wc_get_product($product_id);
        if (!$product) {
            return;
        }
        
        // Check if product is now in stock
        if (!$product->is_in_stock()) {
            return;
        }
        
        // Get pending notifications for this product
        $notifications = $this->database->get_pending_notifications($product_id);
        
        if (empty($notifications)) {
            return;
        }
        
        // Send notifications
        $sent_notifications = array();
        
        foreach ($notifications as $notification) {
            $email_sent = $this->email_handler->send_stock_notification(
                $notification->email,
                $notification->customer_name,
                $product,
                $notification->id
            );
            
            if ($email_sent) {
                $sent_notifications[] = $notification->id;
            }
        }
        
        // Mark notifications as sent
        if (!empty($sent_notifications)) {
            $this->database->mark_as_notified($sent_notifications);
            
            // Log for admin
            error_log(sprintf(
                'DSPN: Sent %d notifications for product %s (ID: %d)',
                count($sent_notifications),
                $product->get_name(),
                $product_id
            ));
        }
    }
    
    /**
     * Manual trigger for testing
     */
    public function manual_check_product($product_id) {
        $this->check_product_availability($product_id);
    }
}