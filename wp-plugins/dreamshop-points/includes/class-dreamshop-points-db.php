<?php
/**
 * Gestisce le operazioni di database per il plugin DreamShop Points
 */
class DreamShop_Points_DB {
    
    /**
     * Nome della tabella dei punti
     *
     * @var string
     */
    private $points_table;
    
    /**
     * Nome della tabella di log
     *
     * @var string
     */
    private $points_log_table;
    
    /**
     * Costruttore
     */
    public function __construct() {
        global $wpdb;
        $this->points_table = $wpdb->prefix . 'dreamshop_points';
        $this->points_log_table = $wpdb->prefix . 'dreamshop_points_log';
    }
    
    /**
     * Crea le tabelle del database
     */
    public function create_tables() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();
        
        // Tabella principale dei punti
        $sql = "CREATE TABLE {$this->points_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            points int(11) NOT NULL DEFAULT 0,
            last_updated datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            UNIQUE KEY user_id (user_id)
        ) $charset_collate;";
        
        // Tabella di log delle transazioni dei punti
        $sql_log = "CREATE TABLE {$this->points_log_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            points int(11) NOT NULL,
            type enum('earn','redeem') NOT NULL,
            description text NOT NULL,
            order_id bigint(20) DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            KEY user_id (user_id),
            KEY order_id (order_id)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
        dbDelta($sql_log);
    }
    
    /**
     * Ottiene i punti di un utente
     *
     * @param int $user_id ID dell'utente
     * @return int Numero di punti
     */
    public function get_user_points($user_id) {
        global $wpdb;
        $points = $wpdb->get_var($wpdb->prepare(
            "SELECT points FROM {$this->points_table} WHERE user_id = %d",
            $user_id
        ));
        
        return $points ? (int) $points : 0;
    }
    
    /**
     * Ottiene la cronologia dei punti di un utente
     *
     * @param int $user_id ID dell'utente
     * @param int $limit Numero massimo di record da restituire
     * @param int $offset Offset per la paginazione
     * @return array Array di record di log
     */
    public function get_points_history($user_id, $limit = 50, $offset = 0) {
        global $wpdb;
        $history = $wpdb->get_results($wpdb->prepare(
            "SELECT id, points, type, description, order_id, created_at AS date 
            FROM {$this->points_log_table} 
            WHERE user_id = %d 
            ORDER BY created_at DESC 
            LIMIT %d OFFSET %d",
            $user_id, $limit, $offset
        ), ARRAY_A);
        
        return $history ?: [];
    }
    
    /**
     * Aggiunge punti a un utente
     *
     * @param int $user_id ID dell'utente
     * @param int $points Punti da aggiungere
     * @param string $description Descrizione dell'operazione
     * @param int $order_id ID dell'ordine associato (opzionale)
     * @return array Risultato dell'operazione
     */
    public function add_points($user_id, $points, $description, $order_id = 0) {
        global $wpdb;
        
        // Verifica che l'utente esista
        $user = get_user_by('id', $user_id);
        if (!$user) {
            return [
                'success' => false,
                'user_id' => $user_id,
                'description' => 'Utente non trovato'
            ];
        }
        
        // Verifica che i punti siano positivi
        if ($points <= 0) {
            return [
                'success' => false,
                'user_id' => $user_id,
                'description' => 'I punti devono essere maggiori di 0'
            ];
        }
        
        // Inizia la transazione
        $wpdb->query('START TRANSACTION');
        
        try {
            // Ottieni il bilancio attuale
            $current_points = $this->get_user_points($user_id);
            
            // Se l'utente non ha un record, crealo
            if ($current_points === 0 && !$wpdb->get_var($wpdb->prepare("SELECT id FROM {$this->points_table} WHERE user_id = %d", $user_id))) {
                $wpdb->insert(
                    $this->points_table,
                    [
                        'user_id' => $user_id,
                        'points' => $points,
                        'last_updated' => current_time('mysql')
                    ],
                    ['%d', '%d', '%s']
                );
            } else {
                // Aggiorna il bilancio esistente
                $wpdb->update(
                    $this->points_table,
                    [
                        'points' => $current_points + $points,
                        'last_updated' => current_time('mysql')
                    ],
                    ['user_id' => $user_id],
                    ['%d', '%s'],
                    ['%d']
                );
            }
            
            // Registra la transazione nel log
            $wpdb->insert(
                $this->points_log_table,
                [
                    'user_id' => $user_id,
                    'points' => $points,
                    'type' => 'earn',
                    'description' => $description,
                    'order_id' => $order_id,
                    'created_at' => current_time('mysql')
                ],
                ['%d', '%d', '%s', '%s', '%d', '%s']
            );
            
            // Commit della transazione
            $wpdb->query('COMMIT');
            
            return [
                'success' => true,
                'user_id' => $user_id,
                'points_added' => $points,
                'previous_balance' => $current_points,
                'new_balance' => $current_points + $points,
                'description' => $description,
                'order_id' => $order_id
            ];
            
        } catch (Exception $e) {
            // Rollback in caso di errore
            $wpdb->query('ROLLBACK');
            
            return [
                'success' => false,
                'user_id' => $user_id,
                'description' => 'Errore durante l\'aggiunta dei punti: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Riscatta punti di un utente
     *
     * @param int $user_id ID dell'utente
     * @param int $points Punti da riscattare
     * @param string $description Descrizione dell'operazione
     * @param int $order_id ID dell'ordine associato (opzionale)
     * @return array Risultato dell'operazione
     */
    public function redeem_points($user_id, $points, $description, $order_id = 0) {
        global $wpdb;
        
        // Verifica che l'utente esista
        $user = get_user_by('id', $user_id);
        if (!$user) {
            return [
                'success' => false,
                'user_id' => $user_id,
                'description' => 'Utente non trovato'
            ];
        }
        
        // Verifica che i punti siano positivi
        if ($points <= 0) {
            return [
                'success' => false,
                'user_id' => $user_id,
                'description' => 'I punti devono essere maggiori di 0'
            ];
        }
        
        // Ottieni il bilancio attuale
        $current_points = $this->get_user_points($user_id);
        
        // Verifica che l'utente abbia abbastanza punti
        if ($current_points < $points) {
            return [
                'success' => false,
                'user_id' => $user_id,
                'current_points' => $current_points,
                'requested_points' => $points,
                'description' => 'Punti insufficienti'
            ];
        }
        
        // Inizia la transazione
        $wpdb->query('START TRANSACTION');
        
        try {
            // Aggiorna il bilancio
            $wpdb->update(
                $this->points_table,
                [
                    'points' => $current_points - $points,
                    'last_updated' => current_time('mysql')
                ],
                ['user_id' => $user_id],
                ['%d', '%s'],
                ['%d']
            );
            
            // Registra la transazione nel log
            $wpdb->insert(
                $this->points_log_table,
                [
                    'user_id' => $user_id,
                    'points' => $points,
                    'type' => 'redeem',
                    'description' => $description,
                    'order_id' => $order_id,
                    'created_at' => current_time('mysql')
                ],
                ['%d', '%d', '%s', '%s', '%d', '%s']
            );
            
            // Commit della transazione
            $wpdb->query('COMMIT');
            
            return [
                'success' => true,
                'user_id' => $user_id,
                'points_redeemed' => $points,
                'previous_balance' => $current_points,
                'new_balance' => $current_points - $points,
                'description' => $description,
                'order_id' => $order_id
            ];
            
        } catch (Exception $e) {
            // Rollback in caso di errore
            $wpdb->query('ROLLBACK');
            
            return [
                'success' => false,
                'user_id' => $user_id,
                'description' => 'Errore durante il riscatto dei punti: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Calcola i punti da assegnare per un ordine
     *
     * @param WC_Order $order Ordine WooCommerce
     * @return float Numero di punti da assegnare
     */
    public function calculate_order_points($order) {
        if (!is_a($order, 'WC_Order')) {
            error_log('DreamShop Points: calculate_order_points chiamato con un parametro non valido');
            return 0;
        }

        // Inizia dal subtotale dei prodotti (senza spedizione e senza sconti)
        $subtotal = $order->get_subtotal(); // €39.90

        // Ottieni tutti i coupon applicati all'ordine
        $coupons = $order->get_coupon_codes();
        $non_points_discount = 0;

        // Calcola solo gli sconti NON punti (es. coupon promozionali)
        foreach ($coupons as $coupon_code) {
            // Se non è un coupon punti (non inizia con POINTS_ o points_), conta lo sconto
            if (strpos($coupon_code, 'POINTS_') !== 0 && strpos(strtolower($coupon_code), 'points_') !== 0) {
                // Ottieni l'oggetto coupon per calcolare correttamente lo sconto
                $coupon = new WC_Coupon($coupon_code);

                // Calcola lo sconto effettivo di questo coupon specifico
                $coupon_lines = $order->get_items('coupon');
                foreach ($coupon_lines as $coupon_item) {
                    if ($coupon_item->get_code() === $coupon_code) {
                        $non_points_discount += abs($coupon_item->get_discount());
                    }
                }
            }
        }

        // Calcolo corretto: Subtotale - Sconti promozionali = Valore per punti
        // €39.90 (subtotale) - €5.00 (sconto coupon) = €34.90 → 34 punti
        $points_eligible_amount = $subtotal - $non_points_discount;

        // Non permettere mai valori negativi
        $total = max(0, $points_eligible_amount);

        // Log molto visibile per debug
        error_log("=== DREAMSHOP POINTS DEBUG ===");
        error_log(sprintf(
            'DreamShop Points CORRETTO per ordine #%s - Subtotale: €%s, Sconti non-punti: €%s, Valore per punti: €%s',
            $order->get_id(),
            number_format($subtotal, 2),
            number_format($non_points_discount, 2),
            number_format($total, 2)
        ));
        error_log("=== FINE DEBUG ===");

        // Prendi il rapporto di punti dalle opzioni (default 1 punto per 1 euro)
        $points_ratio = floatval(get_option('dreamshop_points_earning_ratio', 1));

        // Debug
        error_log(sprintf('DreamShop Points: rapporto punti: %s', $points_ratio));

        // Calcola i punti (arrotondati per difetto)
        $points = floor($total * $points_ratio);

        // Debug
        error_log(sprintf('DreamShop Points: punti calcolati: %s', $points));

        // Applica un filtro per permettere modifiche al calcolo
        $points = apply_filters('dreamshop_points_calculated', $points, $order);

        return max(0, (int)$points); // Assicurati che i punti siano un intero positivo
    }
    
    /**
     * Calcola il valore di uno sconto basato sui punti
     *
     * @param int $points Punti da riscattare
     * @return float Valore dello sconto
     */
    public function calculate_points_discount($points) {
        // Di default, 1 punto = 0.01€
        $redemption_value = get_option('dreamshop_points_redemption_value', 0.01);
        
        // Calcola lo sconto
        $discount = $points * $redemption_value;
        
        // Applicazione di modificatori opzionali
        return apply_filters('dreamshop_points_calculate_discount', $discount, $points);
    }
    
    /**
     * Aggiorna l'ID dell'ordine nelle transazioni di punti recenti senza ordine associato
     *
     * @param int $order_id ID dell'ordine
     * @return bool True se l'operazione è riuscita, false altrimenti
     */
    public function update_points_transaction_order_id($order_id) {
        global $wpdb;
        
        if (empty($order_id)) {
            return false;
        }
        
        // Ottieni l'utente associato all'ordine
        $order = wc_get_order($order_id);
        if (!$order) {
            return false;
        }
        
        $user_id = $order->get_customer_id();
        if (empty($user_id)) {
            return false;
        }
        
        // Cerca le transazioni di riscatto recenti senza ordine associato
        $result = $wpdb->update(
            $this->points_log_table,
            ['order_id' => $order_id],
            [
                'user_id' => $user_id,
                'type' => 'redeem',
                'order_id' => 0
            ],
            ['%d'],
            ['%d', '%s', '%d']
        );
        
        return $result !== false;
    }
}
