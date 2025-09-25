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

        // Forza la creazione delle tabelle se non esistono
        global $wpdb;
        $gift_cards_table = $wpdb->prefix . 'gift_cards';
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '$gift_cards_table'");

        if (!$table_exists || version_compare($installed_version, GIFT_CARD_VERSION, '<')) {
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

        // Tabella per i codici gift card
        $gift_cards_table = $wpdb->prefix . 'gift_cards';

        $sql_gift_cards = "CREATE TABLE $gift_cards_table (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            code varchar(50) NOT NULL UNIQUE,
            amount decimal(10,2) NOT NULL,
            purchaser_id bigint(20) NOT NULL,
            recipient_email varchar(255) NOT NULL,
            recipient_name varchar(255) DEFAULT NULL,
            message text DEFAULT NULL,
            order_id bigint(20) DEFAULT NULL,
            redeemed_by bigint(20) DEFAULT NULL,
            redeemed_at datetime DEFAULT NULL,
            is_redeemed tinyint(1) DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            expires_at datetime DEFAULT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY code (code),
            KEY purchaser_id (purchaser_id),
            KEY recipient_email (recipient_email),
            KEY redeemed_by (redeemed_by),
            KEY order_id (order_id),
            KEY is_redeemed (is_redeemed)
        ) $charset_collate;";

        // Tabella per i log degli acquisti gift card
        $gift_card_logs_table = $wpdb->prefix . 'gift_card_logs';

        $sql_logs = "CREATE TABLE $gift_card_logs_table (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            order_id bigint(20) NOT NULL,
            gift_card_code varchar(50) NOT NULL,
            purchaser_id bigint(20) NOT NULL,
            purchaser_name varchar(255) NOT NULL,
            purchaser_email varchar(255) NOT NULL,
            recipient_email varchar(255) NOT NULL,
            recipient_name varchar(255) DEFAULT NULL,
            message text DEFAULT NULL,
            amount decimal(10,2) NOT NULL,
            email_sent tinyint(1) DEFAULT 0,
            email_sent_at datetime DEFAULT NULL,
            email_error text DEFAULT NULL,
            manual_sent tinyint(1) DEFAULT 0,
            manual_sent_at datetime DEFAULT NULL,
            manual_sent_by bigint(20) DEFAULT NULL,
            notes text DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY order_id (order_id),
            KEY gift_card_code (gift_card_code),
            KEY purchaser_id (purchaser_id),
            KEY recipient_email (recipient_email),
            KEY email_sent (email_sent),
            KEY manual_sent (manual_sent),
            KEY created_at (created_at)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
        dbDelta($sql_gift_cards);
        dbDelta($sql_logs);

        // Verifica specifica per la tabella gift_cards e creala manualmente se necessario
        $gift_cards_exists = $wpdb->get_var("SHOW TABLES LIKE '{$wpdb->prefix}gift_cards'");
        if (!$gift_cards_exists) {
            $manual_sql = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}gift_cards (
                id bigint(20) NOT NULL AUTO_INCREMENT,
                code varchar(50) NOT NULL,
                amount decimal(10,2) NOT NULL,
                purchaser_id bigint(20) NOT NULL,
                recipient_email varchar(255) NOT NULL,
                recipient_name varchar(255) DEFAULT NULL,
                message text DEFAULT NULL,
                order_id bigint(20) DEFAULT NULL,
                redeemed_by bigint(20) DEFAULT NULL,
                redeemed_at datetime DEFAULT NULL,
                is_redeemed tinyint(1) DEFAULT 0,
                created_at datetime DEFAULT CURRENT_TIMESTAMP,
                expires_at datetime DEFAULT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY code_unique (code),
                KEY purchaser_id (purchaser_id),
                KEY recipient_email (recipient_email),
                KEY redeemed_by (redeemed_by),
                KEY order_id (order_id),
                KEY is_redeemed (is_redeemed)
            ) {$charset_collate}";

            $wpdb->query($manual_sql);
        }
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

    /**
     * Crea un nuovo codice gift card
     */
    public static function create_gift_card($purchaser_id, $amount, $recipient_email, $recipient_name = '', $message = '', $order_id = null) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'gift_cards';

        // Verifica che la tabella esista, altrimenti creala
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '$table_name'");
        if (!$table_exists) {
            self::create_tables();
        }

        // Genera un codice univoco
        do {
            $code = 'GC' . strtoupper(wp_generate_password(12, false, false));
        } while (self::gift_card_exists($code));

        // Calcola la data di scadenza: 1 anno dalla data di creazione
        $expires_at = date('Y-m-d H:i:s', strtotime('+1 year'));

        $result = $wpdb->insert(
            $table_name,
            array(
                'code' => $code,
                'amount' => $amount,
                'purchaser_id' => $purchaser_id,
                'recipient_email' => $recipient_email,
                'recipient_name' => $recipient_name,
                'message' => $message,
                'order_id' => $order_id,
                'expires_at' => $expires_at
            ),
            array('%s', '%f', '%d', '%s', '%s', '%s', '%d', '%s')
        );

        if ($result) {
            return $code;
        }
        return false;
    }

    /**
     * Verifica se un codice gift card esiste
     */
    public static function gift_card_exists($code) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'gift_cards';

        // Verifica che la tabella esista
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '$table_name'");
        if (!$table_exists) {
            self::create_tables();
        }

        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table_name WHERE code = %s",
            $code
        ));

        return $count > 0;
    }

    /**
     * Ottiene i dati di una gift card tramite codice
     */
    public static function get_gift_card_by_code($code) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'gift_cards';

        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table_name WHERE code = %s",
            $code
        ));
    }

    /**
     * Riscatta una gift card
     */
    public static function redeem_gift_card($code, $user_id) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'gift_cards';

        // Verifica che la gift card esista e non sia già riscattata
        $gift_card = self::get_gift_card_by_code($code);

        if (!$gift_card) {
            return array('success' => false, 'message' => 'Codice gift card non valido');
        }

        if ($gift_card->is_redeemed) {
            return array('success' => false, 'message' => 'Gift card già utilizzata');
        }

        // Controlla scadenza se presente
        if ($gift_card->expires_at && strtotime($gift_card->expires_at) < time()) {
            return array('success' => false, 'message' => 'Gift card scaduta');
        }

        // Inizia transazione
        $wpdb->query('START TRANSACTION');

        try {
            // Marca la gift card come riscattata
            $update_result = $wpdb->update(
                $table_name,
                array(
                    'is_redeemed' => 1,
                    'redeemed_by' => $user_id,
                    'redeemed_at' => current_time('mysql')
                ),
                array('code' => $code),
                array('%d', '%d', '%s'),
                array('%s')
            );

            if ($update_result === false) {
                throw new Exception('Errore nell\'aggiornamento della gift card');
            }

            // Aggiungi il saldo all'utente
            $description = sprintf('Riscatto Gift Card %s', $code);
            $balance_result = self::update_user_balance($user_id, $gift_card->amount, 'credit', $description);

            if (!$balance_result) {
                throw new Exception('Errore nell\'aggiornamento del saldo');
            }

            $wpdb->query('COMMIT');

            return array(
                'success' => true,
                'message' => 'Gift card riscattata con successo',
                'amount' => $gift_card->amount
            );

        } catch (Exception $e) {
            $wpdb->query('ROLLBACK');
            return array('success' => false, 'message' => $e->getMessage());
        }
    }

    /**
     * Ottiene le gift card di un utente
     */
    public static function get_user_gift_cards($user_id, $type = 'purchased') {
        global $wpdb;

        $table_name = $wpdb->prefix . 'gift_cards';

        if ($type === 'purchased') {
            return $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM $table_name WHERE purchaser_id = %d ORDER BY created_at DESC",
                $user_id
            ));
        } else if ($type === 'redeemed') {
            return $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM $table_name WHERE redeemed_by = %d ORDER BY redeemed_at DESC",
                $user_id
            ));
        }

        return array();
    }

    /**
     * Crea un log dell'acquisto gift card
     */
    public static function create_gift_card_log($order_id, $gift_card_code, $purchaser_data, $recipient_data, $amount, $email_sent = false, $email_error = null) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'gift_card_logs';

        $result = $wpdb->insert(
            $table_name,
            array(
                'order_id' => $order_id,
                'gift_card_code' => $gift_card_code,
                'purchaser_id' => $purchaser_data['id'],
                'purchaser_name' => $purchaser_data['name'],
                'purchaser_email' => $purchaser_data['email'],
                'recipient_email' => $recipient_data['email'],
                'recipient_name' => $recipient_data['name'] ?: '',
                'message' => $recipient_data['message'] ?: '',
                'amount' => $amount,
                'email_sent' => $email_sent ? 1 : 0,
                'email_sent_at' => $email_sent ? current_time('mysql') : null,
                'email_error' => $email_error
            ),
            array('%d', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%f', '%d', '%s', '%s')
        );

        if ($result) {
            return $wpdb->insert_id;
        }
        return false;
    }

    /**
     * Aggiorna lo stato di invio email di un log
     */
    public static function update_gift_card_log_email_status($log_id, $email_sent, $email_error = null) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'gift_card_logs';

        return $wpdb->update(
            $table_name,
            array(
                'email_sent' => $email_sent ? 1 : 0,
                'email_sent_at' => $email_sent ? current_time('mysql') : null,
                'email_error' => $email_error
            ),
            array('id' => $log_id),
            array('%d', '%s', '%s'),
            array('%d')
        );
    }

    /**
     * Marca un log come inviato manualmente
     */
    public static function mark_gift_card_log_manual_sent($log_id, $sent_by_user_id, $notes = '') {
        global $wpdb;

        $table_name = $wpdb->prefix . 'gift_card_logs';

        return $wpdb->update(
            $table_name,
            array(
                'manual_sent' => 1,
                'manual_sent_at' => current_time('mysql'),
                'manual_sent_by' => $sent_by_user_id,
                'notes' => $notes
            ),
            array('id' => $log_id),
            array('%d', '%s', '%d', '%s'),
            array('%d')
        );
    }

    /**
     * Ottieni tutti i log degli acquisti gift card
     */
    public static function get_gift_card_logs($limit = 50, $offset = 0, $filters = array()) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'gift_card_logs';

        $where_clauses = array();
        $where_values = array();

        // Filtri opzionali
        if (!empty($filters['email_sent'])) {
            if ($filters['email_sent'] === 'failed') {
                $where_clauses[] = 'email_sent = 0';
            } elseif ($filters['email_sent'] === 'sent') {
                $where_clauses[] = 'email_sent = 1';
            }
        }

        if (!empty($filters['manual_sent'])) {
            if ($filters['manual_sent'] === 'yes') {
                $where_clauses[] = 'manual_sent = 1';
            } elseif ($filters['manual_sent'] === 'no') {
                $where_clauses[] = 'manual_sent = 0';
            }
        }

        if (!empty($filters['search'])) {
            $search = '%' . $wpdb->esc_like($filters['search']) . '%';
            $where_clauses[] = '(gift_card_code LIKE %s OR recipient_email LIKE %s OR purchaser_email LIKE %s OR recipient_name LIKE %s OR purchaser_name LIKE %s)';
            $where_values = array_merge($where_values, array($search, $search, $search, $search, $search));
        }

        $where_sql = '';
        if (!empty($where_clauses)) {
            $where_sql = 'WHERE ' . implode(' AND ', $where_clauses);
        }

        $sql = "SELECT * FROM $table_name $where_sql ORDER BY created_at DESC LIMIT %d OFFSET %d";
        $where_values[] = $limit;
        $where_values[] = $offset;

        if (!empty($where_values)) {
            $prepared_sql = $wpdb->prepare($sql, $where_values);
        } else {
            $prepared_sql = $wpdb->prepare($sql, $limit, $offset);
        }

        return $wpdb->get_results($prepared_sql);
    }

    /**
     * Conta i log degli acquisti gift card
     */
    public static function count_gift_card_logs($filters = array()) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'gift_card_logs';

        $where_clauses = array();
        $where_values = array();

        // Stessi filtri della funzione get_gift_card_logs
        if (!empty($filters['email_sent'])) {
            if ($filters['email_sent'] === 'failed') {
                $where_clauses[] = 'email_sent = 0';
            } elseif ($filters['email_sent'] === 'sent') {
                $where_clauses[] = 'email_sent = 1';
            }
        }

        if (!empty($filters['manual_sent'])) {
            if ($filters['manual_sent'] === 'yes') {
                $where_clauses[] = 'manual_sent = 1';
            } elseif ($filters['manual_sent'] === 'no') {
                $where_clauses[] = 'manual_sent = 0';
            }
        }

        if (!empty($filters['search'])) {
            $search = '%' . $wpdb->esc_like($filters['search']) . '%';
            $where_clauses[] = '(gift_card_code LIKE %s OR recipient_email LIKE %s OR purchaser_email LIKE %s OR recipient_name LIKE %s OR purchaser_name LIKE %s)';
            $where_values = array_merge($where_values, array($search, $search, $search, $search, $search));
        }

        $where_sql = '';
        if (!empty($where_clauses)) {
            $where_sql = 'WHERE ' . implode(' AND ', $where_clauses);
        }

        $sql = "SELECT COUNT(*) FROM $table_name $where_sql";

        if (!empty($where_values)) {
            $prepared_sql = $wpdb->prepare($sql, $where_values);
        } else {
            $prepared_sql = $sql;
        }

        return $wpdb->get_var($prepared_sql);
    }

    /**
     * Ottieni un log specifico per ID
     */
    public static function get_gift_card_log($log_id) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'gift_card_logs';

        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table_name WHERE id = %d",
            $log_id
        ));
    }
}