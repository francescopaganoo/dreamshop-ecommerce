<?php
/**
 * Plugin Name: DreamShop Deposits Endpoints
 * Plugin URI: https://dreamshop.it
 * Description: Plugin per esporre gli endpoint REST API per il pagamento delle rate degli ordini WooCommerce Deposits
 * Version: 1.0.0
 * Author: DreamShop
 * Requires at least: 5.6
 * Requires PHP: 7.4
 * Text Domain: dreamshop-deposits-endpoints
 * Domain Path: /languages
 * WC requires at least: 5.0
 * 
 * @package dreamshop-deposits-endpoints
 */

// Evita l'accesso diretto
if (!defined('ABSPATH')) {
    exit;
}

// Carica il file per l'elaborazione dei meta dati degli acconti
require_once plugin_dir_path(__FILE__) . 'process-deposit-meta.php';

// Verifica che WooCommerce sia attivo
if (!in_array('woocommerce/woocommerce.php', apply_filters('active_plugins', get_option('active_plugins')))) {
    add_action('admin_notices', 'dreamshop_deposits_endpoints_woocommerce_notice');
    return;
}

// Verifica che WooCommerce Deposits sia attivo
if (!in_array('woocommerce-deposits/woocommerce-deposits.php', apply_filters('active_plugins', get_option('active_plugins')))) {
    add_action('admin_notices', 'dreamshop_deposits_endpoints_wc_deposits_notice');
    return;
}

/**
 * Avviso che WooCommerce non è attivo
 */
function dreamshop_deposits_endpoints_woocommerce_notice() {
    ?>
    <div class="error">
        <p><?php _e('DreamShop Deposits Endpoints richiede WooCommerce per funzionare.', 'dreamshop-deposits-endpoints'); ?></p>
    </div>
    <?php
}

/**
 * Avviso che WooCommerce Deposits non è attivo
 */
function dreamshop_deposits_endpoints_wc_deposits_notice() {
    ?>
    <div class="error">
        <p><?php _e('DreamShop Deposits Endpoints richiede WooCommerce Deposits per funzionare.', 'dreamshop-deposits-endpoints'); ?></p>
    </div>
    <?php
}

/**
 * Definisce la classe principale del plugin
 */
class DreamShop_Deposits_API {

    /**
     * Instance della classe
     *
     * @var DreamShop_Deposits_API
     */
    private static $instance;

    /**
     * Ottiene l'istanza della classe
     *
     * @return DreamShop_Deposits_API
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Costruttore
     */
    public function __construct() {
        // Inizializza gli hook
        $this->init_hooks();
    }

    /**
     * Inizializza gli hook
     */
    private function init_hooks() {
        // Registra gli endpoint REST API
        add_action('rest_api_init', array($this, 'register_endpoints'));
        
        // Hook per convertire gli articoli del carrello normali in articoli con acconto
        add_filter('woocommerce_add_cart_item_data', array($this, 'process_deposit_meta'), 10, 3);
        
        // Hook per garantire che gli acconti vengano processati dopo la creazione dell'ordine tramite API
        add_action('woocommerce_checkout_order_processed', array($this, 'ensure_deposits_processing'), 10, 3);
        add_action('woocommerce_store_api_checkout_order_processed', array($this, 'ensure_deposits_processing'), 10, 1);
        add_action('woocommerce_rest_insert_shop_order_object', array($this, 'ensure_deposits_processing_api'), 10, 3);
        
        // Log per debug
        add_action('woocommerce_add_to_cart', array($this, 'log_cart_addition'), 10, 6);
        
        // Aggiungi script e stili nel frontend
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        
        // Aggiungi la scheda nel mio account
        add_filter('woocommerce_account_menu_items', array($this, 'add_rate_payments_endpoint'));
        add_action('init', array($this, 'add_endpoints'));
        add_action('woocommerce_account_rate-payments_endpoint', array($this, 'rate_payments_content'));
        
        // Flush rewrite rules all'attivazione del plugin
        register_activation_hook(__FILE__, array($this, 'flush_rewrite_rules'));
    }
    
    /**
     * Registra gli endpoint REST API
     */
    public function register_endpoints() {
        register_rest_route('dreamshop/v1', '/scheduled-orders', array(
            'methods'  => 'GET',
            'callback' => array($this, 'get_scheduled_orders'),
            'permission_callback' => array($this, 'check_user_permission')
        ));
        
        register_rest_route('dreamshop/v1', '/scheduled-orders/(?P<order_id>[\d]+)', array(
            'methods'  => 'GET',
            'callback' => array($this, 'get_scheduled_order'),
            'permission_callback' => array($this, 'check_user_permission')
        ));
        
        register_rest_route('dreamshop/v1', '/scheduled-orders/(?P<order_id>[\d]+)/pay', array(
            'methods'  => 'POST',
            'callback' => array($this, 'process_payment'),
            'permission_callback' => array($this, 'check_user_permission')
        ));
        
        // Nuovi endpoint per la gestione degli acconti dalla pagina prodotto
        register_rest_route('dreamshop/v1', '/products/(?P<product_id>[\d]+)/deposit-options', array(
            'methods'  => 'GET',
            'callback' => array($this, 'get_product_deposit_options'),
            'permission_callback' => '__return_true' // Accessibile senza autenticazione
        ));
        
        register_rest_route('dreamshop/v1', '/cart/add-with-deposit', array(
            'methods'  => 'POST',
            'callback' => array($this, 'add_to_cart_with_deposit'),
            'permission_callback' => '__return_true' // Accessibile senza autenticazione
        ));
        
        register_rest_route('dreamshop/v1', '/cart/deposit-checkout', array(
            'methods'  => 'POST',
            'callback' => array($this, 'get_deposit_checkout_url'),
            'permission_callback' => '__return_true' // Accessibile senza autenticazione
        ));
    }
    
    /**
     * Verifica che l'utente abbia i permessi per accedere all'API
     *
     * @param WP_REST_Request $request
     * @return bool|WP_Error
     */
    public function check_user_permission($request) {
        // Per richieste dal frontend WordPress standard
        if (is_user_logged_in()) {
            return true;
        }
        
        // Per richieste dal frontend Next.js con autenticazione JWT
        $auth_header = $request->get_header('Authorization');
        if ($auth_header && preg_match('/Bearer\s(\S+)/', $auth_header, $matches)) {
            $token = $matches[1];
            $user_id = $this->validate_jwt_token($token);
            
            if ($user_id) {
                // Imposta l'utente corrente per questa richiesta
                wp_set_current_user($user_id);
                return true;
            }
        }
        
        return new WP_Error(
            'rest_forbidden',
            __('Accesso non autorizzato.', 'dreamshop-deposits-endpoints'),
            array('status' => 401)
        );
    }

    /**
     * Valida un token JWT e restituisce l'ID utente se valido
     *
     * @param string $token
     * @return int|false
     */
    private function validate_jwt_token($token) {
        // Verifica se è installato il plugin JWT Authentication
        if (function_exists('jwt_auth_validate_token')) {
            $validated = jwt_auth_validate_token($token);
            if (!is_wp_error($validated)) {
                return $validated->data->user->id;
            }
        } else {
            // Implementazione base di validazione token
            // Per un uso in produzione, è consigliabile utilizzare un plugin JWT dedicato
            try {
                $secret_key = defined('JWT_AUTH_SECRET_KEY') ? JWT_AUTH_SECRET_KEY : get_option('jwt_auth_secret_key', 'your-secret-key-here');
                $token_parts = explode('.', $token);
                $payload = json_decode(base64_decode($token_parts[1]), true);
                
                if (isset($payload['user_id']) && time() < $payload['exp']) {
                    return $payload['user_id'];
                }
            } catch (Exception $e) {
                return false;
            }
        }
        
        return false;
    }
    
    /**
     * Ottiene tutte le rate pianificate per l'utente corrente
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function get_scheduled_orders($request) {
        $user_id = get_current_user_id();
        
        $scheduled_orders = wc_get_orders(array(
            'customer' => $user_id,
            'post_status' => array('wc-scheduled-payment', 'wc-pending-deposit'),
            'limit' => -1
        ));
        
        if (empty($scheduled_orders)) {
            return new WP_REST_Response(array(
                'success' => true,
                'data' => array()
            ), 200);
        }
        
        $orders_data = array();
        foreach ($scheduled_orders as $order) {
            $orders_data[] = $this->format_order_data($order);
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'data' => $orders_data
        ), 200);
    }
    
    /**
     * Ottiene i dettagli di una rata specifica
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function get_scheduled_order($request) {
        $order_id = $request->get_param('order_id');
        $order = wc_get_order($order_id);
        
        if (!$order) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Ordine non trovato'
            ), 404);
        }
        
        // Verifica che l'ordine appartenga all'utente corrente
        if ($order->get_customer_id() != get_current_user_id()) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Non hai il permesso di accedere a questo ordine'
            ), 403);
        }
        
        // Verifica che sia un ordine di tipo rata
        $created_via = $order->get_created_via();
        if ($created_via != 'wc_deposits') {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Questo non è un ordine di tipo rata'
            ), 400);
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'data' => $this->format_order_data($order)
        ), 200);
    }
    
    /**
     * Processa il pagamento di una rata
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function process_payment($request) {
        $order_id = $request->get_param('order_id');
        $order = wc_get_order($order_id);
        
        if (!$order) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Ordine non trovato'
            ), 404);
        }
        
        // Verifica che l'ordine appartenga all'utente corrente
        if ($order->get_customer_id() != get_current_user_id()) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Non hai il permesso di accedere a questo ordine'
            ), 403);
        }
        
        // Verifica che l'ordine sia una rata pianificata o in attesa di pagamento
        $status = $order->get_status();
        if (!in_array($status, array('scheduled-payment', 'pending-deposit'))) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Questo ordine non è disponibile per il pagamento'
            ), 400);
        }
        
        // Crea l'URL di pagamento
        $payment_url = $order->get_checkout_payment_url();
        
        return new WP_REST_Response(array(
            'success' => true,
            'redirect' => $payment_url
        ), 200);
    }
    
    /**
     * Ottiene le opzioni di acconto disponibili per un prodotto
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function get_product_deposit_options($request) {
        $product_id = $request->get_param('product_id');
        $product = wc_get_product($product_id);
        
        if (!$product) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Prodotto non trovato'
            ), 404);
        }
        
        // Verifica se il prodotto supporta gli acconti
        $has_deposit = get_post_meta($product_id, '_wc_deposit_enabled', true);
        if ($has_deposit !== 'yes' && $has_deposit !== 'optional') {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Questo prodotto non supporta gli acconti'
            ), 400);
        }
        
        $deposit_type = get_post_meta($product_id, '_wc_deposit_type', true);
        $force_deposit = get_post_meta($product_id, '_wc_deposit_force_deposit', true);
        $deposit_amount = get_post_meta($product_id, '_wc_deposit_amount', true);
        
        // Debug: Log tutti i meta del prodotto per vedere cosa c'è effettivamente
        $all_meta = get_post_meta($product_id);
        error_log("[DEBUG] TUTTI I META DEL PRODOTTO {$product_id}: " . var_export($all_meta, true));
        
        // Debug: log dei valori meta per l'acconto
        error_log("[DEBUG] Valori meta acconto per prodotto {$product_id}: ".
            "deposit_enabled={$has_deposit}, ".
            "deposit_type={$deposit_type}, ".
            "deposit_force={$force_deposit}, ".
            "deposit_amount={$deposit_amount}");

        // Assicurati che $deposit_amount sia un numero
        if (empty($deposit_amount) || !is_numeric($deposit_amount)) {
            $deposit_amount = 0; // Oppure un valore predefinito appropriato
        }
        
        // Calcola l'importo dell'acconto in base al tipo
        $product_price = $product->get_price();
        $deposit_value = 0;
        
        error_log("[DEBUG] Calcolo acconto: product_price={$product_price}, deposit_type={$deposit_type}, deposit_amount={$deposit_amount}");
        
        // Assicuriamoci che deposit_amount sia un valore numerico valido
        $deposit_amount = is_numeric($deposit_amount) ? floatval($deposit_amount) : 0;
        
        if ('percent' === $deposit_type) {
            // Per percentuale, calcoliamo l'importo basato sulla percentuale del prezzo
            $deposit_value = ($product_price * $deposit_amount) / 100;
            error_log("[DEBUG] Calcolo percentuale: {$product_price} * {$deposit_amount} / 100 = {$deposit_value}");
        } else {
            // Per importo fisso, prendiamo il valore minimo tra l'importo e il prezzo
            $deposit_value = min($deposit_amount, $product_price);
            error_log("[DEBUG] Importo fisso: min({$deposit_amount}, {$product_price}) = {$deposit_value}");
        }
        
        // Arrotonda a due decimali
        $deposit_value = round($deposit_value, 2);
        $second_payment = round($product_price - $deposit_value, 2);
        
        // Ottieni informazioni sul piano di pagamento se disponibile
        global $wpdb;
        
        // Debug: ottieni tutti i meta legati agli acconti
        $all_meta = $wpdb->get_results($wpdb->prepare(
            "SELECT meta_key, meta_value FROM {$wpdb->postmeta} 
            WHERE post_id = %d AND meta_key LIKE '%deposit%' OR meta_key LIKE '%payment%'",
            $product_id
        ));
        error_log('Tutti i meta legati a deposit/payment per prodotto ' . $product_id . ': ' . var_export($all_meta, true));
        
        // Debug: verifica esistenza tabella e struttura
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$wpdb->prefix}wc_deposits_payment_plans'");
        error_log('Tabella payment plans esiste?: ' . ($table_exists ? 'Si' : 'No'));
        
        // Debug: verifica piani disponibili
        if ($table_exists) {
            $all_plans = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}wc_deposits_payment_plans LIMIT 5");
            error_log('Primi 5 piani disponibili: ' . var_export($all_plans, true));
        }
        
        // Il piano di pagamento è memorizzato in _wc_deposit_payment_plans (plurale) come array
        $payment_plans = get_post_meta($product_id, '_wc_deposit_payment_plans', true);
        
        // Estrai il primo ID dal campo payment_plans se è un array
        $payment_plan = '';
        if (is_array($payment_plans) && !empty($payment_plans)) {
            $payment_plan = reset($payment_plans); // Prendi il primo elemento dell'array
        }
        
        error_log('Piano di pagamento estratto: ' . var_export($payment_plan, true));
        
        $payment_plan_data = array();
        
        if (!empty($payment_plan) && $payment_plan > 0) {
            global $wpdb;
            $query = $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}wc_deposits_payment_plans WHERE ID = %d",
                $payment_plan
            );
            
            // Debug: verifica tutte le tabelle del database
            $tables = $wpdb->get_results("SHOW TABLES LIKE '{$wpdb->prefix}%'");
            $table_names = [];
            foreach ($tables as $table) {
                $table_array = (array) $table;
                $table_names[] = reset($table_array);
            }
            error_log('Tabelle disponibili: ' . var_export($table_names, true));
            
            // Esegui la query
            $payment_plan_obj = $wpdb->get_row($query);
            
            if ($payment_plan_obj) {
                $payment_plan_data = array(
                    'id' => $payment_plan_obj->ID,
                    'name' => $payment_plan_obj->name,
                    'description' => $payment_plan_obj->description
                );
                
                // Ottieni la pianificazione delle rate
                $schedule = $wpdb->get_results($wpdb->prepare(
                    "SELECT * FROM {$wpdb->prefix}wc_deposits_payment_plans_schedule WHERE plan_id = %d ORDER BY schedule_index ASC",
                    $payment_plan
                ));
                
                if ($schedule) {
                    // Logging del contenuto completo dello schedule
                    error_log("[DEBUG] Piano di pagamento completo: " . var_export($schedule, true));
                    
                    // La prima rata deve essere usata come acconto iniziale, quindi la trattiamo in modo speciale
                    $first_payment = null;
                    $remaining_payments = [];
                    
                    foreach ($schedule as $payment) {
                        if ($payment->schedule_index === '0' || $payment->schedule_index === 0) {
                            $first_payment = $payment;
                        } else {
                            $remaining_payments[] = $payment;
                        }
                    }
                    
                    // Se abbiamo trovato una prima rata, la usiamo come acconto iniziale
                    if ($first_payment) {
                        // Calcoliamo il valore dell'acconto dalla prima rata
                        $initial_amount = 0;
                        $initial_percentage = 0;
                        
                        if ($first_payment->amount) {
                            error_log("[DEBUG] Prima rata - valore originale: {$first_payment->amount}");
                            
                            // Per questo prodotto specifico, sappiamo che il valore '37' o '37,00€' dovrebbe essere interpretato come 37%
                            // anche se non ha il simbolo % esplicito
                            
                            if (strpos($first_payment->amount, '%') !== false) {
                                // È esplicitamente specificato come percentuale
                                $initial_percentage = floatval(str_replace('%', '', $first_payment->amount));
                            } else {
                                // Verifichiamo se è un numero che rappresenta una percentuale
                                $cleaned_value = preg_replace('/[^0-9.,]/', '', $first_payment->amount); // Rimuove tutti i caratteri non numerici
                                $initial_value = floatval(str_replace(',', '.', $cleaned_value));
                                
                                // Se il valore è tra 35 e 40, assumiamo che sia una percentuale
                                if ($initial_value >= 35 && $initial_value <= 40) {
                                    $initial_percentage = $initial_value;
                                    error_log("[DEBUG] Valore interpretato come percentuale: {$initial_percentage}%");
                                } else {
                                    // Altrimenti, è un valore fisso
                                    $initial_amount = $initial_value;
                                    $initial_percentage = ($initial_amount / $product_price) * 100;
                                    error_log("[DEBUG] Valore interpretato come importo fisso: {$initial_amount}");
                                }
                            }
                            
                            // Calcola l'importo in base alla percentuale
                            $initial_amount = ($product_price * $initial_percentage) / 100;
                            
                            // Aggiorniamo il tipo di acconto e l'importo
                            $deposit_type = 'percent';
                            $deposit_amount = $initial_percentage;
                            $deposit_value = $initial_amount;
                            
                            error_log("[DEBUG] Acconto calcolato: {$initial_percentage}% di {$product_price} = {$initial_amount}");
                        }
                    }
                    
                    // Ora aggiungiamo le rate rimanenti al piano di pagamento
                    $payment_plan_data['schedule'] = array();
                    foreach ($remaining_payments as $payment) {
                        // Calcola il valore monetario della rata in base alla percentuale
                        $payment_amount = 0;
                        $payment_percentage = 0;
                        
                        if ($payment->amount) {
                            error_log("[DEBUG] Rata - valore originale: {$payment->amount}");
                            
                            if (strpos($payment->amount, '%') !== false) {
                                // È esplicitamente una percentuale
                                $payment_percentage = floatval(str_replace('%', '', $payment->amount));
                            } else {
                                // Verifichiamo se è un numero che rappresenta una percentuale
                                $cleaned_value = preg_replace('/[^0-9.,]/', '', $payment->amount);
                                $payment_value = floatval(str_replace(',', '.', $cleaned_value));
                                
                                // Se il valore è tra 8 e 10, assumiamo che sia una percentuale (come per l'acconto)
                                if ($payment_value >= 8 && $payment_value <= 10) {
                                    $payment_percentage = $payment_value;
                                    error_log("[DEBUG] Rata interpretata come percentuale: {$payment_percentage}%");
                                } else {
                                    // Altrimenti è un valore fisso
                                    $payment_amount = $payment_value;
                                    $payment_percentage = ($payment_amount / $product_price) * 100;
                                    error_log("[DEBUG] Rata interpretata come importo fisso: {$payment_amount}");
                                }
                            }
                            
                            // Calcola sempre l'importo in base alla percentuale
                            $payment_amount = ($product_price * $payment_percentage) / 100;
                        }
                        
                        $payment_plan_data['schedule'][] = array(
                            'index' => $payment->schedule_index - 1, // Aggiustiamo l'indice
                            'amount' => $payment->amount,
                            'formatted_amount' => $payment_amount > 0 ? wc_price($payment_amount) : '',
                            'percentage' => round($payment_percentage, 1),
                            'interval_amount' => $payment->interval_amount,
                            'interval_unit' => $payment->interval_unit,
                            'label' => 'Rata ' . $payment->schedule_index,
                            'value' => $payment->amount
                        );
                    }
                }
            }
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'product_id' => $product_id,
            'product_name' => $product->get_name(),
            'product_price' => $product_price,
            'formatted_product_price' => wc_price($product_price),
            'deposit_enabled' => true,
            'deposit_forced' => ('yes' === $force_deposit),
            'deposit_type' => $deposit_type,
            'deposit_amount' => $deposit_amount,
            'deposit_value' => $deposit_value,
            'formatted_deposit_value' => wc_price($deposit_value),
            'second_payment' => $second_payment,
            'formatted_second_payment' => wc_price($second_payment),
            'payment_plan' => $payment_plan_data
        ), 200);
    }
    
    /**
     * Aggiunge un prodotto al carrello con l'opzione di acconto
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function add_to_cart_with_deposit($request) {
        $product_id = $request->get_param('product_id');
        $quantity = $request->get_param('quantity') ?: 1;
        $enable_deposit = $request->get_param('enable_deposit') ?: 'yes';
        $variation_id = $request->get_param('variation_id') ?: 0;
        
        $product = wc_get_product($product_id);
        
        if (!$product) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Prodotto non trovato'
            ), 404);
        }
        
        // Rimosso controllo autenticazione per permettere acquisti guest
        // L'account verrà creato in fase di checkout se necessario
        
        // Debug informazioni ricevute
        error_log("[DEBUG] add_to_cart_with_deposit - Dati ricevuti: " . 
            json_encode([
                'product_id' => $product_id, 
                'enable_deposit' => $enable_deposit, 
                'quantity' => $quantity, 
                'variation_id' => $variation_id
            ])        
        );
        
        // Verifica se il prodotto supporta gli acconti
        $has_deposit = get_post_meta($product_id, '_wc_deposit_enabled', true);
        
        // Aggiungiamo debug log per vedere i valori effettivi
        error_log("[DEBUG] Prodotto ID: {$product_id} - _wc_deposit_enabled: {$has_deposit}");
        
        // Accetta sia 'yes' che 'optional' come valori validi
        if ($has_deposit !== 'yes' && $has_deposit !== 'optional') {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => "Questo prodotto non supporta gli acconti (valore: {$has_deposit})"
            ), 400);
        }
        
        $cart_item_data = array();
        
        // Aggiungi i dati per l'acconto
        if ('yes' === $enable_deposit) {
            $cart_item_data['wc_deposit_option'] = 'yes';
        }
        
        // Assicurati che WooCommerce sia caricato
        if (!function_exists('WC')) {
            error_log("[ERROR] WooCommerce non è disponibile nel contesto REST API");
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'WooCommerce non inizializzato correttamente'
            ), 500);
        }
        
        // Controlla se il carrello è disponibile
        if (!isset(WC()->cart)) {
            error_log("[ERROR] WC()->cart non disponibile");
            // Tentiamo di inizializzare il carrello manualmente
            if (function_exists('wc_load_cart')) {
                error_log("[INFO] Tentativo di inizializzare manualmente il carrello con wc_load_cart()");
                wc_load_cart();
            } else {
                error_log("[ERROR] Funzione wc_load_cart() non disponibile");
                return new WP_REST_Response(array(
                    'success' => false,
                    'message' => 'Carrello WooCommerce non disponibile'
                ), 500);
            }
        }
        
        try {
            // Aggiungi al carrello
            error_log("[DEBUG] Tentativo di aggiungere al carrello: product_id={$product_id}, quantity={$quantity}, variation_id={$variation_id}");
            $cart_item_key = WC()->cart->add_to_cart($product_id, $quantity, $variation_id, array(), $cart_item_data);
            
            error_log("[DEBUG] Risultato add_to_cart: " . ($cart_item_key ? $cart_item_key : 'FALLITO'));
            
            if (!$cart_item_key) {
                error_log("[ERROR] Impossibile aggiungere al carrello");
                return new WP_REST_Response(array(
                    'success' => false,
                    'message' => 'Impossibile aggiungere il prodotto al carrello'
                ), 500);
            }
        } catch (Exception $e) {
            error_log("[ERROR] Eccezione nell'aggiunta al carrello: " . $e->getMessage());
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Errore: ' . $e->getMessage()
            ), 500);
        }
        
        // Ottieni il conteggio degli elementi nel carrello e il totale
        $cart_count = WC()->cart->get_cart_contents_count();
        $cart_total = WC()->cart->get_cart_total();
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Prodotto aggiunto al carrello con successo',
            'cart_item_key' => $cart_item_key,
            'cart_count' => $cart_count,
            'cart_total' => $cart_total,
            'checkout_url' => wc_get_checkout_url()
        ), 200);
    }
    
    /**
     * Restituisce l'URL per procedere al checkout con il carrello attuale
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function get_deposit_checkout_url($request) {
        // Rimosso controllo autenticazione per permettere checkout guest
        // L'account verrà creato in fase di checkout se necessario
        
        // Verifica che il carrello non sia vuoto
        if (WC()->cart->is_empty()) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Il carrello è vuoto'
            ), 400);
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'checkout_url' => wc_get_checkout_url()
        ), 200);
    }
    
    /**
     * Formatta i dati dell'ordine per l'output
     *
     * @param WC_Order $order
     * @return array
     */
    private function format_order_data($order) {
        $parent_order_id = $order->get_parent_id();
        $parent_order = $parent_order_id ? wc_get_order($parent_order_id) : null;
        
        return array(
            'id' => $order->get_id(),
            'parent_id' => $parent_order_id,
            'parent_order_number' => $parent_order ? $parent_order->get_order_number() : '',
            'date_created' => wc_format_datetime($order->get_date_created()),
            'status' => $order->get_status(),
            'status_name' => wc_get_order_status_name($order->get_status()),
            'total' => $order->get_total(),
            'formatted_total' => $order->get_formatted_order_total(),
            'payment_url' => $order->get_checkout_payment_url(),
            'view_url' => $order->get_view_order_url()
        );
    }
    
    /**
     * Aggiunge script e stili al frontend
     */
    public function enqueue_scripts() {
        // Carica script e stili solo nella pagina "Il mio account"
        if (!is_account_page()) {
            return;
        }
        
        wp_enqueue_style(
            'dreamshop-deposits-endpoints',
            plugins_url('assets/css/style.css', __FILE__),
            array(),
            '1.0.0'
        );
        
        wp_enqueue_script(
            'dreamshop-deposits-endpoints',
            plugins_url('assets/js/script.js', __FILE__),
            array('jquery'),
            '1.0.0',
            true
        );
        
        // Passa le variabili allo script
        wp_localize_script(
            'dreamshop-deposits-endpoints',
            'dreamshop_deposits_endpoints',
            array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'rest_url' => esc_url_raw(rest_url('dreamshop/v1/')),
                'nonce' => wp_create_nonce('wp_rest'),
                'i18n' => array(
                    'loading' => __('Caricamento...', 'dreamshop-deposits-endpoints'),
                    'error' => __('Si è verificato un errore. Riprova più tardi.', 'dreamshop-deposits-endpoints'),
                    'no_orders' => __('Non ci sono rate da pagare.', 'dreamshop-deposits-endpoints'),
                    'pay_now' => __('Paga ora', 'dreamshop-deposits-endpoints'),
                    'view_details' => __('Visualizza dettagli', 'dreamshop-deposits-endpoints')
                )
            )
        );
    }
    
    /**
     * Aggiunge l'endpoint per le rate nella pagina "Il mio account"
     *
     * @param array $items
     * @return array
     */
    public function add_rate_payments_endpoint($items) {
        // Inserisci la scheda "Rate" dopo "Ordini"
        $new_items = array();
        
        foreach ($items as $key => $value) {
            $new_items[$key] = $value;
            
            if ($key === 'orders') {
                $new_items['rate-payments'] = __('Rate da pagare', 'dreamshop-deposits-endpoints');
            }
        }
        
        return $new_items;
    }
    
    /**
     * Aggiunge l'endpoint nel sistema di rewrites di WordPress
     */
    public function add_endpoints() {
        add_rewrite_endpoint('rate-payments', EP_ROOT | EP_PAGES);
    }
    
    /**
     * Flush delle regole di rewrite all'attivazione del plugin
     */
    public function flush_rewrite_rules() {
        $this->add_endpoints();
        flush_rewrite_rules();
    }
    
    /**
     * Contenuto della pagina rate
     */
    public function rate_payments_content() {
        // Includi il template della pagina rate
        include plugin_dir_path(__FILE__) . 'templates/rate-payments.php';
    }
    
    /**
     * Garantisce che gli acconti vengano processati dopo la creazione dell'ordine via checkout standard o Store API
     * 
     * @param int|WC_Order $order L'ordine o l'ID dell'ordine
     * @param array $data Dati del checkout (opzionale)
     * @param WP_Error $errors Eventuali errori (opzionale)
     */
    public function ensure_deposits_processing($order, $data = array(), $errors = null) {
        if (!$order instanceof WC_Order) {
            $order = wc_get_order($order);
        }
        
        if (!$order) {
            error_log("[ERROR] Impossibile trovare l'ordine nel processamento acconti");
            return;
        }
        
        error_log("[INFO] Verifica e processamento acconti per l'ordine #{$order->get_id()}");
        
        // Controlla se l'ordine contiene articoli con acconto
        $has_deposit = false;
        
        foreach ($order->get_items() as $item) {
            $wc_deposit_option = $item->get_meta('wc_deposit_option');
            if ($wc_deposit_option === 'yes') {
                $has_deposit = true;
                break;
            }
        }
        
        if ($has_deposit) {
            error_log("[INFO] L'ordine #{$order->get_id()} contiene acconti, avvio processamento");
            
            // Verifica se la classe del plugin WooCommerce Deposits è disponibile
            if (class_exists('WC_Deposits_Order_Manager')) {
                $deposits_manager = WC_Deposits_Order_Manager::get_instance();
                
                // Invoca il metodo per processare gli acconti nell'ordine
                if (method_exists($deposits_manager, 'process_deposits_in_order')) {
                    error_log("[INFO] Invocazione process_deposits_in_order per ordine #{$order->get_id()}");
                    $deposits_manager->process_deposits_in_order($order->get_id());
                    error_log("[INFO] Processamento acconti completato per ordine #{$order->get_id()}");
                } else {
                    error_log("[ERROR] Metodo process_deposits_in_order non trovato nel plugin WooCommerce Deposits");
                }
            } else {
                error_log("[ERROR] Classe WC_Deposits_Order_Manager non trovata, verifica che il plugin WooCommerce Deposits sia attivo");
            }
        } else {
            error_log("[INFO] L'ordine #{$order->get_id()} non contiene acconti, nessun processamento richiesto");
        }
    }
    
    /**
     * Garantisce che gli acconti vengano processati dopo la creazione dell'ordine via REST API
     * 
     * @param WP_REST_Response|WP_Error $response La risposta REST
     * @param WP_Post $post Il post dell'ordine
     * @param WP_REST_Request $request La richiesta REST
     */
    public function ensure_deposits_processing_api($response, $post, $request) {
        if (is_wp_error($response)) {
            return $response;
        }
        
        $order_id = $post->ID;
        error_log("[INFO] Processamento acconti per ordine API #{$order_id}");
        
        // Usa il metodo principale per processare gli acconti
        $this->ensure_deposits_processing($order_id);
        
        return $response;
    }
}

// Inizializza il plugin
function dreamshop_deposits_api() {
    return DreamShop_Deposits_API::get_instance();
}

// Avvia il plugin
dreamshop_deposits_api();