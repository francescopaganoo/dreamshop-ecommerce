<?php

if (!defined('ABSPATH')) {
    exit;
}

class GiftCard_Database {
    
    public function __construct() {
        // Hook per eventuali aggiornamenti del database
        add_action('init', array($this, 'check_database_version'));
    }
    
    public function check_database_version() {
        $installed_version = get_option('gift_card_db_version', '0');
        if (version_compare($installed_version, GIFT_CARD_VERSION, '<')) {
            $this->create_tables();
            update_option('gift_card_db_version', GIFT_CARD_VERSION);
        }
    }
    
    public static function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        // Tabella per le transazioni gift card
        $table_name = $wpdb->prefix . 'gift_card_transactions';
        
        $sql = "CREATE TABLE $table_name (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            amount decimal(10,2) NOT NULL,
            type varchar(20) NOT NULL,
            description text,
            order_id bigint(20) DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY order_id (order_id),
            KEY type (type),
            KEY created_at (created_at)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
    
    /**
     * Ottiene il saldo di un utente
     */
    public static function get_user_balance($user_id) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'gift_card_transactions';
        
        $balance = $wpdb->get_var($wpdb->prepare("
            SELECT SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) 
            FROM $table_name 
            WHERE user_id = %d
        ", $user_id));
        
        return floatval($balance);
    }
    
    /**
     * Aggiorna il saldo di un utente
     */
    public static function update_user_balance($user_id, $amount, $type, $description, $order_id = null) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'gift_card_transactions';
        
        $result = $wpdb->insert(
            $table_name,
            array(
                'user_id' => $user_id,
                'amount' => $amount,
                'type' => $type,
                'description' => $description,
                'order_id' => $order_id
            ),
            array('%d', '%f', '%s', '%s', '%d')
        );
        
        return $result !== false;
    }
    
    /**
     * Ottiene le transazioni di un utente
     */
    public static function get_user_transactions($user_id, $limit = 20) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'gift_card_transactions';
        
        $transactions = $wpdb->get_results($wpdb->prepare("
            SELECT * FROM $table_name 
            WHERE user_id = %d 
            ORDER BY created_at DESC 
            LIMIT %d
        ", $user_id, $limit));
        
        return $transactions;
    }
    
    /**
     * Ottiene tutti gli utenti con saldo gift card
     */
    public static function get_users_with_balance() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'gift_card_transactions';
        
        $results = $wpdb->get_results("
            SELECT 
                user_id, 
                SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) as balance,
                COUNT(*) as transaction_count,
                MAX(created_at) as last_transaction
            FROM $table_name 
            GROUP BY user_id 
            HAVING balance > 0 
            ORDER BY balance DESC
        ");
        
        return $results;
    }
    
    /**
     * Elimina le transazioni di un utente (per GDPR)
     */
    public static function delete_user_transactions($user_id) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'gift_card_transactions';
        
        return $wpdb->delete(
            $table_name,
            array('user_id' => $user_id),
            array('%d')
        );
    }
}