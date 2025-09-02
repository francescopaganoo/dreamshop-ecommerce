<?php
/**
 * Plugin Name: Pending Orders Cleanup
 * Plugin URI: https://dreamshop.it
 * Description: Plugin per cancellare automaticamente gli ordini in attesa di pagamento dopo un timeout configurabile
 * Version: 1.0.0
 * Author: Plan Studios Group FP
 * Requires at least: 5.6
 * Requires PHP: 7.4
 * Text Domain: dreamshop-pending-orders-cleanup
 * Domain Path: /languages
 * WC requires at least: 5.0
 * 
 * @package dreamshop-pending-orders-cleanup
 */

// Evita l'accesso diretto
if (!defined('ABSPATH')) {
    exit;
}

// Verifica che WooCommerce sia attivo
if (!in_array('woocommerce/woocommerce.php', apply_filters('active_plugins', get_option('active_plugins')))) {
    add_action('admin_notices', 'dreamshop_pending_cleanup_woocommerce_notice');
    return;
}

/**
 * Avviso che WooCommerce non è attivo
 */
function dreamshop_pending_cleanup_woocommerce_notice() {
    ?>
    <div class="error">
        <p><?php _e('DreamShop Pending Orders Cleanup richiede WooCommerce per funzionare.', 'dreamshop-pending-orders-cleanup'); ?></p>
    </div>
    <?php
}

/**
 * Definisce la classe principale del plugin
 */
class DreamShop_Pending_Orders_Cleanup {

    /**
     * Instance della classe
     *
     * @var DreamShop_Pending_Orders_Cleanup
     */
    private static $instance;

    /**
     * Ottieni l'instance della classe (Singleton)
     *
     * @return DreamShop_Pending_Orders_Cleanup
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Costruttore della classe
     */
    private function __construct() {
        $this->init_hooks();
    }

    /**
     * Inizializza gli hook
     */
    private function init_hooks() {
        // Registra il menu admin
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Registra le impostazioni
        add_action('admin_init', array($this, 'register_settings'));
        
        // Schedula il cron job all'attivazione del plugin
        register_activation_hook(__FILE__, array($this, 'schedule_cleanup_cron'));
        
        // Rimuovi il cron job alla disattivazione
        register_deactivation_hook(__FILE__, array($this, 'unschedule_cleanup_cron'));
        
        // Registra l'azione del cron job
        add_action('dreamshop_cleanup_pending_orders', array($this, 'cleanup_pending_orders'));
        
        // Aggiungi azione AJAX per cleanup manuale
        add_action('wp_ajax_dreamshop_manual_cleanup', array($this, 'manual_cleanup'));
        
        // Aggiungi azione AJAX per cancellare il log
        add_action('wp_ajax_dreamshop_clear_log', array($this, 'clear_log'));
    }

    /**
     * Schedula il cron job
     */
    public function schedule_cleanup_cron() {
        if (!wp_next_scheduled('dreamshop_cleanup_pending_orders')) {
            wp_schedule_event(time(), 'hourly', 'dreamshop_cleanup_pending_orders');
        }
    }

    /**
     * Rimuovi il cron job schedulato
     */
    public function unschedule_cleanup_cron() {
        $timestamp = wp_next_scheduled('dreamshop_cleanup_pending_orders');
        if ($timestamp) {
            wp_unschedule_event($timestamp, 'dreamshop_cleanup_pending_orders');
        }
    }

    /**
     * Aggiunge il menu nella dashboard admin
     */
    public function add_admin_menu() {
        add_options_page(
            'Pulizia Ordini in Attesa',
            'Pulizia Ordini',
            'manage_options',
            'dreamshop-pending-cleanup',
            array($this, 'admin_page')
        );
    }

    /**
     * Registra le impostazioni del plugin
     */
    public function register_settings() {
        register_setting('dreamshop_pending_cleanup', 'dreamshop_pending_timeout_hours');
        register_setting('dreamshop_pending_cleanup', 'dreamshop_pending_statuses');
        register_setting('dreamshop_pending_cleanup', 'dreamshop_pending_enable_logging');
    }

    /**
     * Ottieni il timeout in ore dalle impostazioni (default 3 ore)
     */
    private function get_timeout_hours() {
        return get_option('dreamshop_pending_timeout_hours', 3);
    }

    /**
     * Ottieni gli stati da monitorare (default: pending, on-hold)
     */
    private function get_monitored_statuses() {
        $default = array('pending', 'on-hold');
        $saved = get_option('dreamshop_pending_statuses', $default);
        return is_array($saved) ? $saved : $default;
    }

    /**
     * Controlla se il logging è abilitato
     */
    private function is_logging_enabled() {
        return get_option('dreamshop_pending_enable_logging', 1);
    }

    /**
     * Funzione principale che cancella gli ordini in attesa
     */
    public function cleanup_pending_orders() {
        $timeout_hours = $this->get_timeout_hours();
        $monitored_statuses = $this->get_monitored_statuses();
        
        error_log("[PENDING CLEANUP] Inizio pulizia ordini in attesa - timeout: {$timeout_hours} ore, stati: " . implode(', ', $monitored_statuses));
        
        // Calcola la data limite (X ore fa)
        $cutoff_time = date('Y-m-d H:i:s', strtotime("-{$timeout_hours} hours"));
        
        // Prima recupera TUTTI gli ordini con questi stati (senza filtro data)
        $all_orders = wc_get_orders(array(
            'status' => $monitored_statuses,
            'limit' => -1,
            'orderby' => 'date',
            'order' => 'ASC'
        ));
        
        error_log("[PENDING CLEANUP] Trovati " . count($all_orders) . " ordini totali con stati: " . implode(', ', $monitored_statuses));
        
        // Poi filtra manualmente per data
        $orders = array();
        $cutoff_timestamp = strtotime("-{$timeout_hours} hours");
        
        foreach ($all_orders as $order) {
            $order_created = $order->get_date_created();
            if ($order_created) {
                $order_timestamp = $order_created->getTimestamp();
                $hours_old = ($cutoff_timestamp - $order_timestamp) / 3600;
                
                error_log("[PENDING CLEANUP] Ordine #{$order->get_id()} - creato: " . $order_created->date('Y-m-d H:i:s') . " ({$hours_old} ore fa)");
                
                if ($order_timestamp < $cutoff_timestamp) {
                    $orders[] = $order;
                    error_log("[PENDING CLEANUP] Ordine #{$order->get_id()} selezionato per cancellazione");
                }
            }
        }
        
        $deleted_count = 0;
        
        foreach ($orders as $order) {
            $order_id = $order->get_id();
            $order_date = $order->get_date_created()->date('Y-m-d H:i:s');
            $customer_id = $order->get_customer_id();
            $customer_email = $order->get_billing_email();
            $order_total = $order->get_total();
            
            // Informazioni sul cliente
            $customer_info = array(
                'id' => $customer_id,
                'email' => $customer_email,
                'type' => $customer_id > 0 ? 'registered' : 'guest',
                'first_name' => $order->get_billing_first_name(),
                'last_name' => $order->get_billing_last_name()
            );
            
            error_log("[PENDING CLEANUP] Tentativo cancellazione ordine #{$order_id} (creato: {$order_date}, customer: {$customer_id}, email: {$customer_email})");
            
            $cancellation_successful = false;
            
            // Prova prima con il metodo WooCommerce
            try {
                // Metodo 1: Usa l'oggetto ordine WooCommerce
                $order->delete(true); // true = force delete (bypass trash)
                
                // Verifica se è stato davvero cancellato
                $check_order = wc_get_order($order_id);
                if (!$check_order || $check_order === false) {
                    $deleted_count++;
                    $cancellation_successful = true;
                    error_log("[PENDING CLEANUP] ✅ Ordine #{$order_id} cancellato con successo (metodo WooCommerce)");
                } else {
                    error_log("[PENDING CLEANUP] ⚠️ Ordine #{$order_id} ancora presente dopo delete(), provo wp_delete_post");
                    
                    // Metodo 2: Fallback con wp_delete_post
                    $wp_deleted = wp_delete_post($order_id, true);
                    
                    // Verifica di nuovo
                    $check_order_2 = wc_get_order($order_id);
                    if (!$check_order_2 || $check_order_2 === false) {
                        $deleted_count++;
                        $cancellation_successful = true;
                        error_log("[PENDING CLEANUP] ✅ Ordine #{$order_id} cancellato con successo (metodo wp_delete_post)");
                    } else {
                        error_log("[PENDING CLEANUP] ❌ ERRORE: Ordine #{$order_id} NON cancellato con nessun metodo!");
                        
                        // Debug: controlla se ci sono hook o filtri che impediscono la cancellazione
                        $post = get_post($order_id);
                        if ($post) {
                            error_log("[PENDING CLEANUP] DEBUG: Post #{$order_id} esiste ancora - post_type: {$post->post_type}, post_status: {$post->post_status}");
                        }
                    }
                }
            } catch (Exception $e) {
                error_log("[PENDING CLEANUP] ❌ Eccezione durante cancellazione ordine #{$order_id}: " . $e->getMessage());
            }
            
            // Log SOLO se la cancellazione è avvenuta con successo
            if ($cancellation_successful && $this->is_logging_enabled()) {
                $this->log_order_deletion($order_id, $order_date, $customer_info, $order_total, $order->get_status());
            }
        }
        
        error_log("[PENDING CLEANUP] Pulizia completata - cancellati {$deleted_count} ordini su " . count($orders) . " trovati");
        
        // Salva statistiche
        $this->save_cleanup_stats($deleted_count, count($orders));
    }

    /**
     * Salva le statistiche di pulizia
     */
    private function save_cleanup_stats($deleted, $total_found) {
        $stats = get_option('dreamshop_pending_cleanup_stats', array());
        $stats[] = array(
            'date' => current_time('mysql'),
            'deleted' => $deleted,
            'found' => $total_found
        );
        
        // Mantieni solo gli ultimi 100 record
        if (count($stats) > 100) {
            $stats = array_slice($stats, -100);
        }
        
        update_option('dreamshop_pending_cleanup_stats', $stats);
    }

    /**
     * Log della cancellazione ordine
     */
    private function log_order_deletion($order_id, $order_date, $customer_info, $total, $status) {
        $log_entry = array(
            'order_id' => $order_id,
            'order_date' => $order_date,
            'deleted_at' => current_time('mysql'),
            'customer_id' => $customer_info['id'],
            'customer_email' => $customer_info['email'],
            'customer_type' => $customer_info['type'],
            'customer_name' => trim($customer_info['first_name'] . ' ' . $customer_info['last_name']),
            'order_total' => $total,
            'order_status' => $status
        );
        
        // Ottieni il log esistente
        $log = get_option('dreamshop_pending_cleanup_log', array());
        
        // Aggiungi il nuovo entry all'inizio
        array_unshift($log, $log_entry);
        
        // Mantieni solo gli ultimi 500 record per evitare che diventi troppo grande
        if (count($log) > 500) {
            $log = array_slice($log, 0, 500);
        }
        
        // Salva il log aggiornato
        update_option('dreamshop_pending_cleanup_log', $log);
    }

    /**
     * Cleanup manuale tramite AJAX
     */
    public function manual_cleanup() {
        // Verifica i permessi
        if (!current_user_can('manage_options')) {
            wp_die('Permessi insufficienti');
        }
        
        // Verifica nonce per sicurezza
        if (!wp_verify_nonce($_POST['nonce'], 'dreamshop_manual_cleanup')) {
            wp_die('Nonce non valido');
        }
        
        // Esegui la pulizia
        $this->cleanup_pending_orders();
        
        // Ritorna una risposta
        wp_send_json_success(array(
            'message' => 'Pulizia manuale completata con successo'
        ));
    }

    /**
     * Cancella il log delle cancellazioni
     */
    public function clear_log() {
        // Verifica i permessi
        if (!current_user_can('manage_options')) {
            wp_die('Permessi insufficienti');
        }
        
        // Verifica nonce per sicurezza
        if (!wp_verify_nonce($_POST['nonce'], 'dreamshop_clear_log')) {
            wp_die('Nonce non valido');
        }
        
        // Cancella il log e le statistiche
        delete_option('dreamshop_pending_cleanup_log');
        delete_option('dreamshop_pending_cleanup_stats');
        
        error_log("[PENDING CLEANUP] Log e statistiche cancellati manualmente dall'admin");
        
        // Ritorna una risposta
        wp_send_json_success(array(
            'message' => 'Log cancellato con successo'
        ));
    }

    /**
     * Pagina admin del plugin
     */
    public function admin_page() {
        // Carica il file della pagina admin
        include plugin_dir_path(__FILE__) . 'admin/settings-page.php';
    }
}

// Inizializza il plugin
function dreamshop_pending_orders_cleanup() {
    return DreamShop_Pending_Orders_Cleanup::get_instance();
}

// Avvia il plugin
dreamshop_pending_orders_cleanup();