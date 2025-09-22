<?php
/**
 * Database operations for DreamShop Product Notifications
 */

if (!defined('ABSPATH')) {
    exit;
}

class DSPN_Database {
    
    private $table_name;
    
    public function __construct() {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'dspn_notifications';
        
        add_action('init', array($this, 'maybe_upgrade_database'));
    }
    
    /**
     * Create database tables
     */
    public function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE {$this->table_name} (
            id int(11) NOT NULL AUTO_INCREMENT,
            email varchar(255) NOT NULL,
            product_id int(11) NOT NULL,
            customer_name varchar(255) DEFAULT '',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            notified_at datetime NULL,
            status enum('pending', 'notified', 'cancelled') DEFAULT 'pending',
            PRIMARY KEY (id),
            UNIQUE KEY unique_subscription (email, product_id),
            KEY product_id (product_id),
            KEY email (email),
            KEY status (status)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
        
        // Store current database version
        update_option('dspn_db_version', '1.0.0');
    }
    
    /**
     * Check if database needs upgrade
     */
    public function maybe_upgrade_database() {
        $current_version = get_option('dspn_db_version');
        if ($current_version !== '1.0.0') {
            $this->create_tables();
        }
    }
    
    /**
     * Add notification subscription
     */
    public function add_subscription($email, $product_id, $customer_name = '') {
        global $wpdb;
        
        // Validate email
        if (!is_email($email)) {
            return new WP_Error('invalid_email', 'Email non valida');
        }
        
        // Check if product exists
        $product = wc_get_product($product_id);
        if (!$product) {
            return new WP_Error('invalid_product', 'Prodotto non trovato');
        }
        
        // Check if already subscribed (only pending status)
        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$this->table_name} WHERE email = %s AND product_id = %d AND status = 'pending'",
            $email,
            $product_id
        ));

        if ($existing) {
            return new WP_Error('already_subscribed', 'Sei già iscritto per questo prodotto');
        }

        // Check if user previously cancelled subscription
        $cancelled = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$this->table_name} WHERE email = %s AND product_id = %d AND status = 'cancelled'",
            $email,
            $product_id
        ));

        if ($cancelled) {
            // Reactivate cancelled subscription
            $result = $wpdb->update(
                $this->table_name,
                array(
                    'customer_name' => $customer_name,
                    'created_at' => current_time('mysql'),
                    'status' => 'pending',
                    'notified_at' => null
                ),
                array('id' => $cancelled->id),
                array('%s', '%s', '%s', '%s'),
                array('%d')
            );

            return $result ? $cancelled->id : new WP_Error('db_error', 'Errore durante la riattivazione');
        }

        // Insert new subscription
        $result = $wpdb->insert(
            $this->table_name,
            array(
                'email' => $email,
                'product_id' => $product_id,
                'customer_name' => $customer_name,
                'created_at' => current_time('mysql'),
                'status' => 'pending'
            ),
            array('%s', '%d', '%s', '%s', '%s')
        );
        
        if ($result === false) {
            return new WP_Error('db_error', 'Errore durante l\'iscrizione');
        }
        
        return $wpdb->insert_id;
    }
    
    /**
     * Get pending notifications for a product
     */
    public function get_pending_notifications($product_id) {
        global $wpdb;
        
        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$this->table_name} WHERE product_id = %d AND status = 'pending'",
            $product_id
        ));
    }
    
    /**
     * Mark notifications as sent
     */
    public function mark_as_notified($notification_ids) {
        global $wpdb;
        
        if (empty($notification_ids)) {
            return false;
        }
        
        $ids_placeholder = implode(',', array_fill(0, count($notification_ids), '%d'));
        
        return $wpdb->query($wpdb->prepare(
            "UPDATE {$this->table_name} 
             SET status = 'notified', notified_at = %s 
             WHERE id IN ({$ids_placeholder})",
            array_merge([current_time('mysql')], $notification_ids)
        ));
    }
    
    /**
     * Get all notifications for admin panel
     */
    public function get_all_notifications($status = 'all', $limit = 50, $offset = 0) {
        global $wpdb;
        
        $where = "WHERE 1=1";
        $params = array();
        
        if ($status !== 'all') {
            $where .= " AND status = %s";
            $params[] = $status;
        }
        
        $sql = "SELECT n.*, p.post_title as product_name 
                FROM {$this->table_name} n 
                LEFT JOIN {$wpdb->posts} p ON n.product_id = p.ID 
                {$where} 
                ORDER BY n.created_at DESC 
                LIMIT %d OFFSET %d";
        
        $params[] = $limit;
        $params[] = $offset;
        
        return $wpdb->get_results($wpdb->prepare($sql, $params));
    }
    
    /**
     * Get notification count
     */
    public function get_notification_count($status = 'all') {
        global $wpdb;
        
        $where = "WHERE 1=1";
        $params = array();
        
        if ($status !== 'all') {
            $where .= " AND status = %s";
            $params[] = $status;
        }
        
        $sql = "SELECT COUNT(*) FROM {$this->table_name} {$where}";
        
        if (!empty($params)) {
            return $wpdb->get_var($wpdb->prepare($sql, $params));
        } else {
            return $wpdb->get_var($sql);
        }
    }
    
    /**
     * Delete notification
     */
    public function delete_notification($id) {
        global $wpdb;
        
        return $wpdb->delete(
            $this->table_name,
            array('id' => $id),
            array('%d')
        );
    }
}