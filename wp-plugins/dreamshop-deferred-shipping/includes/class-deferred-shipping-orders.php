<?php
/**
 * Orders management class
 */

if (!defined('ABSPATH')) {
    exit;
}

class DreamShop_Deferred_Shipping_Orders {
    
    private static $instance = null;
    private $db;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        $this->db = DreamShop_Deferred_Shipping_Database::get_instance();
        $this->init_hooks();
    }
    
    private function init_hooks() {
        // Hook to add meta to orders during checkout
        add_action('woocommerce_checkout_create_order', array($this, 'add_deferred_shipping_meta'), 10, 2);
        
        // Hook to handle order status changes
        add_action('woocommerce_order_status_changed', array($this, 'handle_shipping_order_payment'), 10, 3);
    }
    
    /**
     * Add deferred shipping meta to orders during checkout
     */
    public function add_deferred_shipping_meta($order, $data) {
        $has_deferred_shipping = false;
        
        foreach ($order->get_items() as $item) {
            $product_id = $item->get_product_id();
            
            if ($this->db->is_deferred_shipping_product($product_id)) {
                $shipping_data = $this->db->get_product_shipping_data($product_id);
                
                // Only add meta if shipping is not yet calculated
                if ($shipping_data && $shipping_data->status === 'pending') {
                    $has_deferred_shipping = true;
                    break;
                }
            }
        }
        
        if ($has_deferred_shipping) {
            $order->add_meta_data('_deferred_shipping', 'yes');
        }
    }
    
    /**
     * Create shipping order for customer
     */
    public function create_shipping_order($original_order_id, $product_id, $customer_id, $shipping_amount) {
        try {
            // Check if shipping order already exists for this combination
            global $wpdb;
            $table = $wpdb->prefix . 'deferred_shipping_orders';
            
            $existing = $wpdb->get_var($wpdb->prepare("
                SELECT id FROM $table 
                WHERE original_order_id = %d AND product_id = %d
            ", $original_order_id, $product_id));
            
            if ($existing) {
                error_log("Deferred Shipping: Order already exists for order $original_order_id and product $product_id");
                return false;
            }
            
            // Get original order data
            $original_order = wc_get_order($original_order_id);
            if (!$original_order) {
                return false;
            }
            
            // Create new order for shipping
            $shipping_order = wc_create_order();
            
            // Set customer
            $shipping_order->set_customer_id($customer_id);
            
            // Copy billing and shipping addresses from original order
            $shipping_order->set_address($original_order->get_address('billing'), 'billing');
            $shipping_order->set_address($original_order->get_address('shipping'), 'shipping');
            
            // Add shipping item
            $product = wc_get_product($product_id);
            $product_name = $product ? $product->get_name() : "Prodotto ID: $product_id";
            
            $item = new WC_Order_Item_Fee();
            $item->set_name("Spedizione - $product_name");
            $item->set_amount($shipping_amount);
            $item->set_total($shipping_amount);
            $item->set_tax_status('none');
            
            $shipping_order->add_item($item);
            
            // Set order totals
            $shipping_order->calculate_totals();
            
            // Set order status
            $shipping_order->set_status('pending');
            
            // Add meta data
            $shipping_order->add_meta_data('_is_shipping_order', 'yes');
            $shipping_order->add_meta_data('_original_order_id', $original_order_id);
            $shipping_order->add_meta_data('_shipping_product_id', $product_id);
            
            // Save the order
            $shipping_order->save();
            
            // Store relationship in database
            global $wpdb;
            $table = $wpdb->prefix . 'deferred_shipping_orders';
            
            $wpdb->insert(
                $table,
                array(
                    'original_order_id' => $original_order_id,
                    'shipping_order_id' => $shipping_order->get_id(),
                    'product_id' => $product_id,
                    'customer_id' => $customer_id,
                    'shipping_amount' => $shipping_amount,
                    'status' => 'pending'
                ),
                array('%d', '%d', '%d', '%d', '%f', '%s')
            );
            
            // Send email notification
            $emails = DreamShop_Deferred_Shipping_Emails::get_instance();
            $emails->send_shipping_payment_notification($shipping_order, $original_order);
            
            return $shipping_order->get_id();
            
        } catch (Exception $e) {
            error_log('Deferred Shipping: Error creating shipping order - ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Handle shipping order payment completion
     */
    public function handle_shipping_order_payment($order_id, $old_status, $new_status) {
        $order = wc_get_order($order_id);
        
        if (!$order || $order->get_meta('_is_shipping_order') !== 'yes') {
            return;
        }
        
        if ($new_status === 'completed' || $new_status === 'processing') {
            // Update database status
            global $wpdb;
            $table = $wpdb->prefix . 'deferred_shipping_orders';
            
            $wpdb->update(
                $table,
                array('status' => 'paid'),
                array('shipping_order_id' => $order_id),
                array('%s'),
                array('%d')
            );
            
            // Add note to original order
            $original_order_id = $order->get_meta('_original_order_id');
            if ($original_order_id) {
                $original_order = wc_get_order($original_order_id);
                if ($original_order) {
                    $original_order->add_order_note(
                        sprintf('Spedizione aggiuntiva pagata. Ordine spedizione: #%d', $order_id)
                    );
                }
            }
        }
    }
    
    /**
     * Get shipping orders for customer
     */
    public function get_customer_shipping_orders($customer_id) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'deferred_shipping_orders';
        
        $results = $wpdb->get_results($wpdb->prepare("
            SELECT dso.*, p.post_title as product_name 
            FROM $table dso
            LEFT JOIN {$wpdb->posts} p ON dso.product_id = p.ID
            WHERE dso.customer_id = %d 
            AND dso.status = 'pending'
            ORDER BY dso.created_at DESC
        ", $customer_id));
        
        return $results;
    }
    
    /**
     * Get shipping order details
     */
    public function get_shipping_order_details($order_id) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'deferred_shipping_orders';
        
        return $wpdb->get_row($wpdb->prepare("
            SELECT dso.*, p.post_title as product_name 
            FROM $table dso
            LEFT JOIN {$wpdb->posts} p ON dso.product_id = p.ID
            WHERE dso.shipping_order_id = %d
        ", $order_id));
    }
}