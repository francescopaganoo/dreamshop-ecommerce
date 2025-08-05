<?php
/**
 * Database management class
 */

if (!defined('ABSPATH')) {
    exit;
}

class DreamShop_Deferred_Shipping_Database {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        // Constructor
    }
    
    /**
     * Create database tables
     */
    public static function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        // Table for deferred shipping products
        $table_products = $wpdb->prefix . 'deferred_shipping_products';
        $sql_products = "CREATE TABLE $table_products (
            id int(11) NOT NULL AUTO_INCREMENT,
            product_id int(11) NOT NULL,
            shipping_amount decimal(10,2) DEFAULT NULL,
            status enum('pending','calculated') DEFAULT 'pending',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY product_id (product_id)
        ) $charset_collate;";
        
        // Table for shipping orders relationship
        $table_orders = $wpdb->prefix . 'deferred_shipping_orders';
        $sql_orders = "CREATE TABLE $table_orders (
            id int(11) NOT NULL AUTO_INCREMENT,
            original_order_id int(11) NOT NULL,
            shipping_order_id int(11) DEFAULT NULL,
            product_id int(11) NOT NULL,
            customer_id int(11) NOT NULL,
            shipping_amount decimal(10,2) NOT NULL,
            status enum('pending','paid','cancelled') DEFAULT 'pending',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY original_order_id (original_order_id),
            KEY shipping_order_id (shipping_order_id),
            KEY customer_id (customer_id)
        ) $charset_collate;";
        
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql_products);
        dbDelta($sql_orders);
    }
    
    /**
     * Drop database tables
     */
    public static function drop_tables() {
        global $wpdb;
        
        $table_products = $wpdb->prefix . 'deferred_shipping_products';
        $table_orders = $wpdb->prefix . 'deferred_shipping_orders';
        
        $wpdb->query("DROP TABLE IF EXISTS $table_orders");
        $wpdb->query("DROP TABLE IF EXISTS $table_products");
    }
    
    /**
     * Get all deferred shipping products with purchase count
     */
    public function get_products() {
        global $wpdb;
        
        $table = $wpdb->prefix . 'deferred_shipping_products';
        
        $results = $wpdb->get_results("
            SELECT dsp.*, 
                   p.post_title as product_name,
                   COALESCE(purchase_counts.customer_count, 0) as customer_count
            FROM $table dsp 
            LEFT JOIN {$wpdb->posts} p ON dsp.product_id = p.ID 
            LEFT JOIN (
                SELECT oim.meta_value as product_id, 
                       COUNT(DISTINCT pm_customer.meta_value) as customer_count
                FROM {$wpdb->prefix}woocommerce_order_items oi
                INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim ON oi.order_item_id = oim.order_item_id
                INNER JOIN {$wpdb->posts} o ON oi.order_id = o.ID
                INNER JOIN {$wpdb->postmeta} pm_customer ON o.ID = pm_customer.post_id
                WHERE oim.meta_key = '_product_id'
                AND pm_customer.meta_key = '_customer_user'
                AND o.post_status IN ('wc-processing', 'wc-on-hold', 'wc-completed')
                AND pm_customer.meta_value > 0
                GROUP BY oim.meta_value
            ) purchase_counts ON dsp.product_id = purchase_counts.product_id
            WHERE p.post_status = 'publish'
            ORDER BY dsp.created_at DESC
        ");
        
        return $results;
    }
    
    /**
     * Add product to deferred shipping
     */
    public function add_product($product_id) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'deferred_shipping_products';
        
        $result = $wpdb->insert(
            $table,
            array(
                'product_id' => $product_id,
                'status' => 'pending'
            ),
            array('%d', '%s')
        );
        
        return $result !== false;
    }
    
    /**
     * Remove product from deferred shipping
     */
    public function remove_product($product_id) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'deferred_shipping_products';
        
        $result = $wpdb->delete(
            $table,
            array('product_id' => $product_id),
            array('%d')
        );
        
        return $result !== false;
    }
    
    /**
     * Update shipping amount for product
     */
    public function update_shipping_amount($product_id, $amount) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'deferred_shipping_products';
        
        $result = $wpdb->update(
            $table,
            array(
                'shipping_amount' => $amount,
                'status' => 'calculated'
            ),
            array('product_id' => $product_id),
            array('%f', '%s'),
            array('%d')
        );
        
        return $result !== false;
    }
    
    /**
     * Check if product has deferred shipping
     */
    public function is_deferred_shipping_product($product_id) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'deferred_shipping_products';
        
        $result = $wpdb->get_var($wpdb->prepare("
            SELECT COUNT(*) FROM $table WHERE product_id = %d
        ", $product_id));
        
        return $result > 0;
    }
    
    /**
     * Get product shipping data
     */
    public function get_product_shipping_data($product_id) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'deferred_shipping_products';
        
        return $wpdb->get_row($wpdb->prepare("
            SELECT * FROM $table WHERE product_id = %d
        ", $product_id));
    }
    
    /**
     * Get orders that need shipping notification
     */
    public function get_orders_for_notification($product_id) {
        global $wpdb;
        
        $deferred_table = $wpdb->prefix . 'deferred_shipping_products';
        $orders_table = $wpdb->prefix . 'deferred_shipping_orders';
        
        // Get all orders containing this product that haven't been processed yet
        $results = $wpdb->get_results($wpdb->prepare("
            SELECT DISTINCT o.ID, o.post_date, pm_customer.meta_value as customer_id
            FROM {$wpdb->posts} o
            INNER JOIN {$wpdb->prefix}woocommerce_order_items oi ON o.ID = oi.order_id
            INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim ON oi.order_item_id = oim.order_item_id
            INNER JOIN $deferred_table dsp ON oim.meta_value = dsp.product_id
            INNER JOIN {$wpdb->postmeta} pm_customer ON o.ID = pm_customer.post_id
            LEFT JOIN $orders_table dso ON o.ID = dso.original_order_id AND dso.product_id = %d
            WHERE o.post_type = 'shop_order'
            AND oim.meta_key = '_product_id'
            AND oim.meta_value = %d
            AND pm_customer.meta_key = '_customer_user'
            AND pm_customer.meta_value > 0
            AND o.post_status IN ('wc-processing', 'wc-on-hold', 'wc-completed')
            AND dso.id IS NULL
        ", $product_id, $product_id));
        
        return $results;
    }
    
    /**
     * Clean up duplicate shipping orders
     */
    public function cleanup_duplicate_orders() {
        global $wpdb;
        
        $table = $wpdb->prefix . 'deferred_shipping_orders';
        
        // Find and remove duplicates, keeping the oldest one
        $duplicates = $wpdb->get_results("
            SELECT original_order_id, product_id, COUNT(*) as count, 
                   GROUP_CONCAT(id ORDER BY created_at ASC) as ids
            FROM $table 
            GROUP BY original_order_id, product_id 
            HAVING COUNT(*) > 1
        ");
        
        $cleaned = 0;
        foreach ($duplicates as $duplicate) {
            $ids = explode(',', $duplicate->ids);
            // Keep the first (oldest) and delete the rest
            array_shift($ids);
            
            foreach ($ids as $id_to_delete) {
                // Get the shipping order ID before deleting
                $shipping_order_id = $wpdb->get_var($wpdb->prepare("
                    SELECT shipping_order_id FROM $table WHERE id = %d
                ", $id_to_delete));
                
                // Delete from database
                $wpdb->delete($table, array('id' => $id_to_delete), array('%d'));
                
                // Delete the WooCommerce order if it exists
                if ($shipping_order_id) {
                    $order = wc_get_order($shipping_order_id);
                    if ($order) {
                        $order->delete(true); // Force delete
                    }
                }
                $cleaned++;
            }
        }
        
        return $cleaned;
    }
}