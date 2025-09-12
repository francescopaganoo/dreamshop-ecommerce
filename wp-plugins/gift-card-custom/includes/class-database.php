<?php

if (!defined('ABSPATH')) {
    exit;
}

class GiftCard_Database {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
    }
    
    public function init() {
        
    }
    
    public static function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        // Tabella per i saldi gift card degli utenti
        $table_balances = $wpdb->prefix . 'gift_card_balances';
        $sql_balances = "CREATE TABLE $table_balances (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            balance decimal(10,2) NOT NULL DEFAULT 0.00,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY user_id (user_id)
        ) $charset_collate;";
        
        // Tabella per le transazioni gift card
        $table_transactions = $wpdb->prefix . 'gift_card_transactions';
        $sql_transactions = "CREATE TABLE $table_transactions (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            amount decimal(10,2) NOT NULL,
            type enum('credit','debit') NOT NULL,
            description varchar(255) DEFAULT NULL,
            order_id bigint(20) DEFAULT NULL,
            coupon_code varchar(100) DEFAULT NULL,
            reference_id varchar(100) DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY order_id (order_id),
            KEY coupon_code (coupon_code)
        ) $charset_collate;";
        
        // Tabella per i coupon generati
        $table_coupons = $wpdb->prefix . 'gift_card_coupons';
        $sql_coupons = "CREATE TABLE $table_coupons (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            coupon_code varchar(100) NOT NULL,
            amount decimal(10,2) NOT NULL,
            status enum('active','used','expired') NOT NULL DEFAULT 'active',
            order_id bigint(20) DEFAULT NULL,
            expires_at datetime DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            used_at datetime DEFAULT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY coupon_code (coupon_code),
            KEY user_id (user_id),
            KEY status (status)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql_balances);
        dbDelta($sql_transactions);
        dbDelta($sql_coupons);
    }
    
    public static function get_user_balance($user_id) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'gift_card_balances';
        $balance = $wpdb->get_var($wpdb->prepare(
            "SELECT balance FROM $table WHERE user_id = %d", 
            $user_id
        ));
        
        return $balance ? floatval($balance) : 0.00;
    }
    
    public static function update_user_balance($user_id, $amount, $type = 'credit', $description = '', $order_id = null, $coupon_code = null) {
        global $wpdb;
        
        $table_balances = $wpdb->prefix . 'gift_card_balances';
        $table_transactions = $wpdb->prefix . 'gift_card_transactions';
        
        // Inizia transazione
        $wpdb->query('START TRANSACTION');
        
        try {
            // Ottieni saldo attuale
            $current_balance = self::get_user_balance($user_id);
            
            // Calcola nuovo saldo
            $new_balance = $type === 'credit' ? $current_balance + $amount : $current_balance - $amount;
            
            // Verifica che il saldo non diventi negativo
            if ($new_balance < 0) {
                throw new Exception('Saldo insufficiente');
            }
            
            // Aggiorna o inserisci saldo
            $wpdb->replace(
                $table_balances,
                array(
                    'user_id' => $user_id,
                    'balance' => $new_balance
                ),
                array('%d', '%f')
            );
            
            // Registra transazione
            $wpdb->insert(
                $table_transactions,
                array(
                    'user_id' => $user_id,
                    'amount' => $amount,
                    'type' => $type,
                    'description' => $description,
                    'order_id' => $order_id,
                    'coupon_code' => $coupon_code
                ),
                array('%d', '%f', '%s', '%s', '%d', '%s')
            );
            
            $wpdb->query('COMMIT');
            return true;
            
        } catch (Exception $e) {
            $wpdb->query('ROLLBACK');
            return false;
        }
    }
    
    public static function get_user_transactions($user_id, $limit = 50, $offset = 0) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'gift_card_transactions';
        
        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table 
             WHERE user_id = %d 
             ORDER BY created_at DESC 
             LIMIT %d OFFSET %d",
            $user_id, $limit, $offset
        ));
    }
    
    public static function create_coupon($user_id, $amount) {
        global $wpdb;
        
        // Verifica saldo sufficiente
        $balance = self::get_user_balance($user_id);
        if ($balance < $amount) {
            return false;
        }
        
        // Genera codice coupon unico
        $coupon_code = 'GC' . strtoupper(uniqid());
        
        $table = $wpdb->prefix . 'gift_card_coupons';
        
        $result = $wpdb->insert(
            $table,
            array(
                'user_id' => $user_id,
                'coupon_code' => $coupon_code,
                'amount' => $amount,
                'expires_at' => date('Y-m-d H:i:s', strtotime('+1 year'))
            ),
            array('%d', '%s', '%f', '%s')
        );
        
        if ($result) {
            // Scala dal saldo
            self::update_user_balance($user_id, $amount, 'debit', 'Coupon generato: ' . $coupon_code, null, $coupon_code);
            return $coupon_code;
        }
        
        return false;
    }
    
    public static function get_coupon_info($coupon_code) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'gift_card_coupons';
        
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE coupon_code = %s",
            $coupon_code
        ));
    }
    
    public static function mark_coupon_used($coupon_code, $order_id) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'gift_card_coupons';
        
        return $wpdb->update(
            $table,
            array(
                'status' => 'used',
                'order_id' => $order_id,
                'used_at' => current_time('mysql', true)
            ),
            array('coupon_code' => $coupon_code),
            array('%s', '%d', '%s'),
            array('%s')
        );
    }
}