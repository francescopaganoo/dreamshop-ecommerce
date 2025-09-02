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
        
        // Hook per controllare quando una rata viene pagata
        add_action('woocommerce_order_status_changed', array($this, 'check_installment_completion'), 10, 4);
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
        
        // Nuovo endpoint per il checkout con acconti direttamente dal frontend Next.js
        register_rest_route('dreamshop/v1', '/orders/create-with-deposits', array(
            'methods'  => 'POST',
            'callback' => array($this, 'create_order_with_deposits'),
            'permission_callback' => array($this, 'check_user_permission')
        ));
        
        // Endpoint per forzare l'elaborazione degli acconti su un ordine esistente
        register_rest_route('dreamshop/v1', '/orders/(?P<order_id>[\d]+)/force-deposits-processing', array(
            'methods'  => 'POST',
            'callback' => array($this, 'force_deposits_processing'),
            'permission_callback' => '__return_true' // Accessibile senza autenticazione per il momento
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
        


        // Assicurati che $deposit_amount sia un numero
        if (empty($deposit_amount) || !is_numeric($deposit_amount)) {
            $deposit_amount = 0; // Oppure un valore predefinito appropriato
        }
        
        // Calcola l'importo dell'acconto in base al tipo
        $product_price = $product->get_price();
        $deposit_value = 0;
        
        
        // Assicuriamoci che deposit_amount sia un valore numerico valido
        $deposit_amount = is_numeric($deposit_amount) ? floatval($deposit_amount) : 0;
        
        if ('percent' === $deposit_type) {
            // Per percentuale, calcoliamo l'importo basato sulla percentuale del prezzo
            $deposit_value = ($product_price * $deposit_amount) / 100;
        } else {
            // Per importo fisso, prendiamo il valore minimo tra l'importo e il prezzo
            $deposit_value = min($deposit_amount, $product_price);
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
                            
                            // Per questo prodotto specifico, sappiamo che il valore '37' o '37,00€' dovrebbe essere interpretato come 37%
                            // anche se non ha il simbolo % esplicito
                            
                            // Verifichiamo prima se abbiamo informazioni sul tipo di valore direttamente dal database
                            $is_percentage = false;
                            
                            // Controlliamo se esiste un campo 'type' nella tabella schedule
                            if (isset($first_payment->type)) {
                                $is_percentage = ($first_payment->type === 'percent');
                            } else if (strpos($first_payment->amount, '%') !== false) {
                                // È esplicitamente specificato come percentuale nel valore
                                $is_percentage = true;
                            } else {
                                // Definiamo esplicitamente che i valori per gli acconti sono SEMPRE percentuali 
                                // (essendo questo il comportamento atteso per il piano di pagamento)
                                $is_percentage = true;
                            }
                            
                            // Pulizia del valore numerico
                            $cleaned_value = preg_replace('/[^0-9.,]/', '', $first_payment->amount); // Rimuove tutti i caratteri non numerici
                            $initial_value = floatval(str_replace(',', '.', $cleaned_value));
                            
                            if ($is_percentage) {
                                $initial_percentage = $initial_value;
                            } else {
                                $initial_amount = $initial_value;
                                $initial_percentage = ($initial_amount / $product_price) * 100;
                            }
                            
                            // Calcola l'importo in base alla percentuale
                            $initial_amount = ($product_price * $initial_percentage) / 100;
                            
                            // Aggiorniamo il tipo di acconto e l'importo
                            $deposit_type = 'percent';
                            $deposit_amount = $initial_percentage;
                            $deposit_value = $initial_amount;
                            
                        }
                    }
                    
                    // Ora aggiungiamo le rate rimanenti al piano di pagamento
                    $payment_plan_data['schedule'] = array();
                    foreach ($remaining_payments as $payment) {
                        // Calcola il valore monetario della rata in base alla percentuale
                        $payment_amount = 0;
                        $payment_percentage = 0;
                        
                        if ($payment->amount) {
                            
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
                                } else {
                                    // Altrimenti è un valore fisso
                                    $payment_amount = $payment_value;
                                    $payment_percentage = ($payment_amount / $product_price) * 100;
                                }
                            }
                            
                            // Calcola sempre l'importo in base alla percentuale
                            $payment_amount = ($product_price * $payment_percentage) / 100;
                        }
                        
                        // Determiniamo esplicitamente se è una percentuale o un importo fisso
                        $is_percent = false;
                        $display_amount = $payment->amount;
                        
                        // Verifichiamo se il valore è una percentuale in diversi modi
                        
                        // 1. Se è un piano conosciuto che usa percentuali
                        if ($payment_plan_data['id'] === '810' || $payment_plan_data['id'] === 'pianoprova') {
                            $is_percent = true;
                        } 
                        // 2. Se il valore contiene già il simbolo %
                        else if (strpos($payment->amount, '%') !== false) {
                            $is_percent = true;
                        }
                        // 3. Se il valore è un numero intero tra 1 e 100 senza simboli valuta
                        else {
                            // Pulisci il valore da qualsiasi carattere non numerico
                            $clean_amount = preg_replace('/[^0-9.,]/', '', $payment->amount);
                            $numeric_value = floatval(str_replace(',', '.', $clean_amount));
                            
                            // Se è un numero intero tra 1 e 100, probabilmente è una percentuale
                            // E non contiene simboli valuta come € o $
                            if ($numeric_value >= 1 && $numeric_value <= 100 && 
                                !strpos($payment->amount, '€') && !strpos($payment->amount, '$')) {
                                $is_percent = true;
                                $payment_percentage = $numeric_value;  // Aggiorna il valore percentuale
                            }
                        }
                        
                        // Aggiorna il display_amount se è una percentuale
                        if ($is_percent) {
                            $display_amount = $payment_percentage . '%';
                        }
                        

                        
                        // Assicuriamoci che il valore percentuale sia corretto (non troppo preciso)
                        $rounded_percentage = round($payment_percentage);
                        
                        // Costruisci l'oggetto con valori coerenti
                        $payment_plan_data['schedule'][] = array(
                            'index' => $payment->schedule_index - 1, // Aggiustiamo l'indice
                            'amount' => $is_percent ? "{$rounded_percentage}%" : $display_amount, // Mostra sempre la % se è percentuale
                            'formatted_amount' => $payment_amount > 0 ? wc_price($payment_amount) : '',
                            'percentage' => $rounded_percentage, // Arrotondiamo per semplicità
                            'interval_amount' => $payment->interval_amount,
                            'interval_unit' => $payment->interval_unit,
                            'label' => 'Rata ' . $payment->schedule_index,
                            'value' => $is_percent ? $rounded_percentage : $payment_amount, // Valore numerico (% o importo)
                            'is_percent' => $is_percent // Flag esplicito
                        );
                    }
                }
            }
        }
        
        // Ottieni il piano hardcoded se necessario
        $is_pianoprova = false;
        if ($payment_plan_data['id'] === '810' || $payment_plan_data['name'] === 'pianoprova') {
            $is_pianoprova = true;
            // Assicurati che l'ID e il nome siano corretti
            $payment_plan_data['id'] = '810';
            $payment_plan_data['name'] = 'pianoprova';
            
            // Correggi il piano direttamente nel caso sia pianoprova
            $piano_config = $this->get_piano_prova_plan();
            
            // Forza l'acconto corretto
            $deposit_value = 25; // 25% di acconto
            $deposit_amount = ($product_price * $deposit_value) / 100;
            $deposit_type = 'percent';
            
            // Assicurati che il secondo pagamento sia calcolato correttamente
            // Il secondo pagamento è la somma di tutte le rate
            $second_payment = 0;
            foreach ($piano_config['installments'] as $installment) {
                $second_payment += ($product_price * $installment['percent'] / 100);
            }
            
            // SOSTITUISCI sempre lo schedule con i valori corretti per il piano pianoprova
            // Questo sovrascrive qualsiasi valore precedente anche se lo schedule esisteva già
            $payment_plan_data['schedule'] = [];
            
            // Valori corretti per le rate del piano pianoprova (35% e 40%)
            $installments = [
                0 => ['percent' => 35, 'months' => 1],
                1 => ['percent' => 40, 'months' => 2]
            ];
            
            // Crea lo schedule corretto per il piano pianoprova con i valori hardcoded
            foreach ($installments as $index => $installment) {
                $rate_amount = ($product_price * $installment['percent']) / 100;
                $payment_plan_data['schedule'][] = [
                    'index' => $index,
                    'amount' => $installment['percent'] . '%', // Esplicitamente in percentuale
                    'formatted_amount' => wc_price($rate_amount),
                    'percentage' => $installment['percent'],
                    'interval_amount' => $installment['months'],
                    'interval_unit' => 'month',
                    'label' => 'Rata ' . ($index + 1) . ' di ' . count($installments),
                    'value' => $installment['percent'],
                    'is_percent' => true
                ];
            }
        }
        
        // Aggiorna la risposta API con informazioni più esplicite
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
            'deposit_is_percent' => ($deposit_type === 'percent'),
            'deposit_display' => ($deposit_type === 'percent') ? $deposit_value . '%' : wc_price($deposit_value),
            'formatted_deposit_value' => wc_price($deposit_value),
            'second_payment' => $second_payment,
            'formatted_second_payment' => wc_price($second_payment),
            'payment_plan' => $payment_plan_data,
            'is_pianoprova' => $is_pianoprova
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
        $payment_plan_id = $request->get_param('payment_plan_id'); // Nuovo parametro per il piano di pagamento
        
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

        
        // Verifica se il prodotto supporta gli acconti
        $has_deposit = get_post_meta($product_id, '_wc_deposit_enabled', true);
        
        // Aggiungiamo debug log per vedere i valori effettivi
        
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
            
            // Salviamo anche il piano di pagamento se specificato
            if (!empty($payment_plan_id)) {
                $cart_item_data['_deposit_payment_plan'] = $payment_plan_id;
                error_log("[INFO] Piano di pagamento salvato nel carrello: {$payment_plan_id}");
            }
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
            $cart_item_key = WC()->cart->add_to_cart($product_id, $quantity, $variation_id, array(), $cart_item_data);
            
            
            if (!$cart_item_key) {
                error_log("[ERROR] Impossibile aggiungere al carrello");
                return new WP_REST_Response(array(
                    'success' => false,
                    'message' => 'Impossibile aggiungere il prodotto al carrello'
                ), 500);
            }
        } catch (Exception $e) {
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

        // Ottieni l'ID del piano di pagamento dalla richiesta
        $params = json_decode($request->get_body(), true);
        
        // Debug SUPER COMPLETO dei parametri ricevuti - LOG EVIDENZIATI PER TRACCIAMENTO
        error_log('!!!!!!!!!!!!!!!!! BACKEND CHECKOUT DEBUG - INIZIO !!!!!!!!!!!!!!!!!!');
        error_log('[INFO IMPORTANTE] Raw request body: ' . $request->get_body());
        error_log('[INFO IMPORTANTE] Headers ricevuti: ' . print_r($request->get_headers(), true));
        error_log('[INFO IMPORTANTE] Parametri ricevuti dal frontend: ' . print_r($params, true));
        
        // Esamina il tipo esatto di $params e la sua struttura
        error_log('[INFO IMPORTANTE] Tipo di dato $params: ' . gettype($params));
        if (is_array($params)) {
            error_log('[INFO IMPORTANTE] Chiavi presenti in $params: ' . implode(', ', array_keys($params)));
        }
        
        // Verifica se paymentPlanId è presente nei parametri ricevuti
        error_log('[INFO IMPORTANTE] paymentPlanId esiste nei params? ' . (isset($params['paymentPlanId']) ? 'SI' : 'NO'));
        
        $payment_plan_id = isset($params['paymentPlanId']) ? sanitize_text_field($params['paymentPlanId']) : '';
        
        // Log dettagliati per debug - ALTA PRIORITÀ
        error_log('[INFO IMPORTANTE] Piano di pagamento ricevuto nel checkout: ' . $payment_plan_id);
        error_log('[INFO IMPORTANTE] Tipo di dato payment_plan_id: ' . gettype($payment_plan_id));
        error_log('[INFO IMPORTANTE] payment_plan_id vuoto? ' . (empty($payment_plan_id) ? 'SI' : 'NO'));
        error_log('[INFO IMPORTANTE] payment_plan_id raw value: ' . var_export($payment_plan_id, true));
        error_log('[INFO IMPORTANTE] payment_plan_id isset? ' . (isset($payment_plan_id) ? 'SI' : 'NO'));
        error_log('[INFO IMPORTANTE] payment_plan_id === NULL? ' . (is_null($payment_plan_id) ? 'SI' : 'NO'));
        error_log('[INFO IMPORTANTE] payment_plan_id === ""? ' . ($payment_plan_id === "" ? 'SI' : 'NO'));
        error_log('[INFO IMPORTANTE] payment_plan_id === 0? ' . ($payment_plan_id === 0 ? 'SI' : 'NO'));
        error_log('[INFO IMPORTANTE] payment_plan_id == false? ' . (!$payment_plan_id ? 'SI' : 'NO'));
        
        // Debug del carrello WooCommerce
        error_log('[CHECKOUT DEBUG] Contenuto carrello:');
        if (function_exists('WC') && WC()->cart) {
            foreach (WC()->cart->get_cart() as $cart_item_key => $cart_item) {
                error_log("[CHECKOUT DEBUG] Articolo carrello {$cart_item_key}: " . json_encode($cart_item));
                
                // Verifica se l'articolo ha già dei metadati di acconto
                $has_deposit = isset($cart_item['_wc_convert_to_deposit']) && $cart_item['_wc_convert_to_deposit'] === 'yes';
                error_log("[CHECKOUT DEBUG] Articolo {$cart_item_key} ha acconto? " . ($has_deposit ? 'SI' : 'NO'));
                
                // Verifica se l'articolo ha già un piano di pagamento
                $existing_plan = isset($cart_item['_deposit_payment_plan']) ? $cart_item['_deposit_payment_plan'] : 'NON TROVATO';
                error_log("[CHECKOUT DEBUG] Articolo {$cart_item_key} piano pagamento esistente: {$existing_plan}");
            }
        } else {
            error_log('[CHECKOUT DEBUG] Carrello WooCommerce non disponibile');
        }
        
        error_log('!!!!!!!!!!!!!!!!! BACKEND CHECKOUT DEBUG - FINE !!!!!!!!!!!!!!!!!!');
        
        // Log anche su file WordPress normale
        error_log('[CHECKOUT DEBUG] payment_plan_id ricevuto: ' . $payment_plan_id);
        
        // Salva l'ID del piano di pagamento nella sessione per poterlo recuperare durante il checkout
        if (!empty($payment_plan_id)) {
            WC()->session->set('deposit_payment_plan_id', $payment_plan_id);
            error_log('!!!!! SESSIONE !!!!! Piano di pagamento salvato nella sessione: ' . $payment_plan_id);
            error_log('[INFO IMPORTANTE] payment_plan_id salvato nella sessione WooCommerce: ' . $payment_plan_id);
            
            // CORREZIONE CRITICA: Applica il piano di pagamento direttamente agli articoli nel carrello
            if (function_exists('WC') && WC()->cart) {
                foreach (WC()->cart->get_cart() as $cart_item_key => $cart_item) {
                    // Verifica se l'articolo ha l'acconto attivo
                    if (isset($cart_item['_wc_convert_to_deposit']) && $cart_item['_wc_convert_to_deposit'] === 'yes') {
                        // Aggiorna l'articolo nel carrello con il piano di pagamento
                        WC()->cart->cart_contents[$cart_item_key]['_deposit_payment_plan'] = $payment_plan_id;
                        error_log("!!!!! CARRELLO !!!!! Piano di pagamento applicato all'articolo {$cart_item_key}: {$payment_plan_id}");
                    }
                }
                WC()->cart->set_session(); // Salva le modifiche nella sessione
            }
            
            // Salva il carrello
            WC()->cart->set_session();
            error_log('!!!!! CARRELLO SALVATO !!!!! Carrello aggiornato e salvato in sessione con il piano: ' . $payment_plan_id);
            
            // NUOVO! Aggiungi hook per salvare il piano di pagamento durante la creazione dell'ordine
            if (!has_action('woocommerce_checkout_create_order', array($this, 'save_payment_plan_to_order'))) {
                add_action('woocommerce_checkout_create_order', array($this, 'save_payment_plan_to_order'), 10, 1);
                error_log('!!!!! HOOK AGGIUNTO !!!!! Registrato hook per salvare il piano di pagamento nell\'ordine: ' . $payment_plan_id);
            }
        } else {
            error_log('!!!!! ATTENZIONE !!!!! Nessun piano di pagamento da salvare nella sessione (valore vuoto)');
        }

        // Aggiungi hook per applicare il piano di pagamento al checkout
        if (!empty($payment_plan_id)) {
            add_action('woocommerce_checkout_create_order', function($order, $data) use ($payment_plan_id) {
                // Salva l'ID del piano di pagamento nei metadati dell'ordine
                $order->update_meta_data('_deposit_payment_plan', $payment_plan_id);
                error_log('!!!!!!!!!! APPLICAZIONE PIANO PAGAMENTO ALL\'ORDINE !!!!!!!!!!');
                error_log('[INFO IMPORTANTE] Piano di pagamento applicato all\'ordine #' . $order->get_id() . ': ' . $payment_plan_id);
                error_log('[INFO IMPORTANTE] Hook woocommerce_checkout_create_order eseguito correttamente');
                
                // NUOVO: Aggiungiamo un hook per applicare il piano anche agli articoli dell'ordine quando vengono creati
                add_action('woocommerce_checkout_create_order_line_item', function($item, $cart_item_key, $values, $order) use ($payment_plan_id) {
                    // Verifica se l'articolo del carrello ha l'acconto attivo
                    if (isset($values['_wc_convert_to_deposit']) && $values['_wc_convert_to_deposit'] === 'yes') {
                        // Applica direttamente il piano di pagamento all'articolo dell'ordine
                        $item->update_meta_data('_deposit_payment_plan', $payment_plan_id);
                        error_log("!!!!!!!!!! APPLICAZIONE PIANO PAGAMENTO ALL'ARTICOLO #{$cart_item_key} !!!!!!!!!!");
                        error_log("[INFO IMPORTANTE] Piano di pagamento {$payment_plan_id} applicato all'articolo del carrello: {$cart_item_key}");
                    }
                }, 10, 4);
                
                // Log tutti i metadati dell'ordine per debug
                $metadata = $order->get_meta_data();
                $metadata_values = [];
                foreach ($metadata as $meta) {
                    $metadata_values[$meta->key] = $meta->value;
                }
                error_log('[DEBUG ORDINE] Metadati dell\'ordine #' . $order->get_id() . ': ' . json_encode($metadata_values));
            }, 10, 2);
            
            error_log('!!!!! HOOK REGISTRATO !!!!! Hook per applicare piano di pagamento ' . $payment_plan_id . ' registrato');
        } else {
            error_log('!!!!! ATTENZIONE !!!!! Nessun piano di pagamento da applicare all\'ordine (valore vuoto)');
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'checkout_url' => wc_get_checkout_url(),
            'payment_plan_id' => $payment_plan_id // Restituisci l'ID del piano per conferma
        ), 200);
    }
    
    /**
     * Crea un ordine con acconti direttamente dal frontend Next.js
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function create_order_with_deposits($request) {
        $params = $request->get_params();
        
        try {
            // Verifica che ci siano tutti i dati necessari
            if (empty($params['billing']) || empty($params['line_items'])) {
                return new WP_REST_Response(array(
                    'success' => false,
                    'message' => 'Dati mancanti per la creazione dell\'ordine'
                ), 400);
            }
            
            // Crea un nuovo ordine
            $order = wc_create_order();
            
            // Imposta i dati dell'ordine
            if (!empty($params['customer_id'])) {
                $order->set_customer_id($params['customer_id']);
            } else {
                // Se non è specificato un customer_id, usiamo l'utente corrente
                $current_user_id = get_current_user_id();
                if ($current_user_id) {
                    $order->set_customer_id($current_user_id);
                }
            }
            
            // Aggiungi gli articoli con metadati per gli acconti
            foreach ($params['line_items'] as $item) {
                $product_id = isset($item['product_id']) ? $item['product_id'] : 0;
                $variation_id = isset($item['variation_id']) ? $item['variation_id'] : 0;
                $quantity = isset($item['quantity']) ? $item['quantity'] : 1;
                
                // Seleziona l'ID del prodotto corretto (variazione o prodotto principale)
                $final_product_id = $variation_id ? $variation_id : $product_id;
                $product = wc_get_product($final_product_id);
                
                if (!$product) {
                    continue;
                }
                
                // Aggiungi l'articolo all'ordine
                $item_id = $order->add_product($product, $quantity);
                
                // Verifica se ci sono metadati per gli acconti
                if (isset($item['meta_data']) && is_array($item['meta_data'])) {
                    $convert_to_deposit = false;
                    $deposit_type = 'percent';
                    $deposit_amount = '40';
                    $payment_plan = '';
                    
                    // Estrai i metadati di acconto
                    foreach ($item['meta_data'] as $meta) {
                        if (isset($meta['key']) && $meta['key'] === '_wc_convert_to_deposit' && $meta['value'] === 'yes') {
                            $convert_to_deposit = true;
                        }
                        if (isset($meta['key']) && $meta['key'] === '_wc_deposit_type') {
                            $deposit_type = $meta['value'];
                        }
                        if (isset($meta['key']) && $meta['key'] === '_wc_deposit_amount') {
                            $deposit_amount = $meta['value'];
                        }
                        if (isset($meta['key']) && $meta['key'] === '_wc_payment_plan') {
                            $payment_plan = $meta['value'];
                        }
                    }
                    
                    // Log per il debug
                    error_log("[INFO] Elaborazione prodotto ID: {$final_product_id} per ordine con acconto. Convert: {$convert_to_deposit}, Tipo: {$deposit_type}, Importo: {$deposit_amount}");
                    
                    if ($convert_to_deposit) {
                        // Verifica se il prodotto supporta gli acconti
                        $has_deposit = get_post_meta($product_id, '_wc_deposit_enabled', true);
                        
                        if ($has_deposit === 'yes' || $has_deposit === 'optional') {
                            $product_price = $product->get_price();
                            
                            // Calcola l'importo dell'acconto
                            if ($deposit_type === 'percent') {
                                $deposit_value = ($product_price * floatval($deposit_amount)) / 100;
                            } else {
                                $deposit_value = floatval($deposit_amount);
                            }
                            
                            // Arrotonda a 2 decimali
                            $deposit_value = round($deposit_value, 2);
                            
                            // Aggiungi metadati necessari per WooCommerce Deposits (con doppia notazione per sicurezza)
                            // Usa sia i nostri nomi di chiave che quelli standard di WooCommerce Deposits
                            
                            // Metadati fondamentali per il rilevamento dell'acconto
                            wc_add_order_item_meta($item_id, 'is_deposit', 'yes');
                            wc_add_order_item_meta($item_id, 'wc_deposit_option', 'yes'); // Chiave standard WC Deposits
                            
                            // Informazioni sull'importo dell'acconto
                            wc_add_order_item_meta($item_id, 'deposit_amount', $deposit_value);
                            wc_add_order_item_meta($item_id, '_deposit_amount', $deposit_value); // Chiave standard WC Deposits
                            
                            // Importo totale del prodotto
                            wc_add_order_item_meta($item_id, 'full_amount', $product_price);
                            wc_add_order_item_meta($item_id, '_original_amount', $product_price); // Chiave standard WC Deposits
                            
                            // Importi al netto delle tasse
                            wc_add_order_item_meta($item_id, '_deposit_deposit_amount_ex_tax', wc_get_price_excluding_tax($product, ['price' => $deposit_value]));
                            wc_add_order_item_meta($item_id, '_deposit_full_amount_ex_tax', wc_get_price_excluding_tax($product));
                            
                            // Tipo di deposito (percentuale o importo fisso)
                            wc_add_order_item_meta($item_id, '_deposit_type', $deposit_type);
                            
                            // Piano di pagamento
                            if (!empty($payment_plan)) {
                                wc_add_order_item_meta($item_id, 'payment_plan', $payment_plan);
                                wc_add_order_item_meta($item_id, '_payment_plan', $payment_plan); // Chiave standard WC Deposits
                            }
                            
                            error_log("[INFO] Metadati completi aggiunti per l'articolo #{$item_id}. Tipo: {$deposit_type}, Importo: {$deposit_value}, Piano: {$payment_plan}");
                            
                            error_log("[INFO] Metadati per acconto aggiunti all'articolo dell'ordine ID: {$item_id}");
                        } else {
                            error_log("[WARNING] Il prodotto ID: {$product_id} non supporta acconti. Valore _wc_deposit_enabled: {$has_deposit}");
                        }
                    }
                }
            }
            
            // Imposta gli indirizzi di fatturazione e spedizione
            if (!empty($params['billing'])) {
                $order->set_address($params['billing'], 'billing');
            }
            
            if (!empty($params['shipping'])) {
                $order->set_address($params['shipping'], 'shipping');
            } else if (!empty($params['billing'])) {
                // Se l'indirizzo di spedizione non è fornito, usa quello di fatturazione
                $order->set_address($params['billing'], 'shipping');
            }
            
            // Imposta il metodo di pagamento
            if (!empty($params['payment_method'])) {
                $order->set_payment_method($params['payment_method']);
                if (!empty($params['payment_method_title'])) {
                    $order->set_payment_method_title($params['payment_method_title']);
                }
            }
            
            // Imposta i totali dell'ordine (opzionale)
            if (!empty($params['shipping_total'])) {
                $order->set_shipping_total($params['shipping_total']);
            }
            
            if (!empty($params['shipping_tax'])) {
                $order->set_shipping_tax($params['shipping_tax']);
            }
            
            // Note dell'ordine
            if (!empty($params['customer_note'])) {
                $order->set_customer_note($params['customer_note']);
            }
            
            // Calcola i totali
            $order->calculate_totals();
            
            // Verifica la presenza di acconti
            $has_deposit = false;
            foreach ($order->get_items() as $item) {
                if ($item->get_meta('is_deposit') === 'yes') {
                    $has_deposit = true;
                    break;
                }
            }
            
            // Imposta lo stato dell'ordine e i metadati per gli acconti
            if ($has_deposit) {
                // Imposta i metadati a livello di ordine richiesti da WooCommerce Deposits
                update_post_meta($order->get_id(), '_wc_deposits_order_has_deposit', 'yes');
                update_post_meta($order->get_id(), '_wc_deposits_payment_schedule', 'yes'); // Indica che l'ordine ha una schedule di pagamento
                
                // Calcola e salva gli importi totali dell'acconto e del saldo
                $deposit_total = 0;
                $second_payment_total = 0;
                
                foreach ($order->get_items() as $item_id => $item) {
                    $deposit_amount = floatval($item->get_meta('deposit_amount'));
                    $full_amount = floatval($item->get_meta('full_amount'));
                    
                    if ($deposit_amount > 0) {
                        $deposit_total += $deposit_amount * $item->get_quantity();
                        $second_payment_total += ($full_amount - $deposit_amount) * $item->get_quantity();
                    }
                }
                
                update_post_meta($order->get_id(), '_wc_deposits_deposit_amount', $deposit_total);
                update_post_meta($order->get_id(), '_wc_deposits_second_payment', $second_payment_total);
                
                error_log("[INFO] Metadati ordine impostati. Deposit total: {$deposit_total}, Second payment: {$second_payment_total}");
                
                // IMPORTANTE: Imposta il totale dell'ordine principale pari all'importo dell'acconto
                // In questo modo l'ordine principale rifletterà solo l'importo effettivamente pagato
                $order->set_total($deposit_total);
                error_log("[INFO] Totale ordine principale aggiornato a: {$deposit_total} (importo acconto)");
                
                // Imposta lo stato a pagamento parziale
                $order->update_status('partial-payment', 'Ordine creato come pagamento parziale via API');
            } else {
                $order->update_status('pending', 'Ordine creato via API');
            }
            
            // Salva l'ordine
            $order->save();
            
            // Processa gli acconti se necessario
            if ($has_deposit) {
                $this->ensure_deposits_processing($order);
            }
            
            // Restituisci i dati dell'ordine
            return new WP_REST_Response([
                'success' => true,
                'order_id' => $order->get_id(),
                'order_key' => $order->get_order_key(),
                'payment_url' => $order->get_checkout_payment_url()
            ], 200);
            
        } catch (Exception $e) {
            error_log("[ERROR] Creazione ordine con acconti fallita: " . $e->getMessage());
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Errore durante la creazione dell\'ordine: ' . $e->getMessage()
            ], 500);
        }
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
     * Ottiene le impostazioni di un piano di pagamento rateale
     * 
     * @param string $plan_id ID o nome del piano di pagamento
     * @return array Impostazioni del piano con le rate configurate
     */
    /**
     * Ottiene le impostazioni di un piano di pagamento dal database
     * 
     * @param string $plan_id ID del piano o nome del piano
     * @return array|false Impostazioni del piano o false se non trovato
     */
    private function get_payment_plan_settings($plan_id) {
        
        // Se non abbiamo un ID, non possiamo procedere
        if (empty($plan_id)) {
            return false;
        }
        
        // Normalizza l'ID del piano
        $original_plan_id = $plan_id;
        $plan_id = trim(strtolower($plan_id));
        
        // NUOVO: Gestione piani numerici - Se l'ID è numerico, recupera dalla tabella wc_deposits_payment_plans
        if (is_numeric($original_plan_id)) {
            error_log("[INFO] ID piano numerico ({$original_plan_id}), tentativo di recupero dal database");
            
            global $wpdb;
            $table_name = $wpdb->prefix . 'wc_deposits_payment_plans';
            
            // Verifica se la tabella esiste
            $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$table_name}'");
            if (!$table_exists) {
                error_log("[ERROR] La tabella {$table_name} non esiste nel database");
                // Se la tabella non esiste, usiamo il piano standard basato sulla percentuale
                return $this->get_luffy_gear_fourth_plan();
            }
            
            // Recupera il piano dal database
            $query = $wpdb->prepare(
                "SELECT * FROM {$table_name} WHERE ID = %d",
                intval($original_plan_id)
            );
            
            $plan_data = $wpdb->get_row($query, ARRAY_A);
            
            if ($plan_data) {
                error_log("[INFO] Trovato piano di pagamento nel database: " . var_export($plan_data, true));
                
                // Crea la configurazione del piano nel formato atteso
                $plan_settings = array(
                    'name' => isset($plan_data['name']) ? $plan_data['name'] : 'Piano #' . $original_plan_id,
                    'deposit_percent' => 40, // Percentuale di default per l'acconto
                    'installments' => array()
                );
                
                // Ottieni la pianificazione delle rate dalla tabella wc_deposits_payment_plans_schedule
                $schedule_table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$wpdb->prefix}wc_deposits_payment_plans_schedule'");
                
                if ($schedule_table_exists) {
                    error_log("[INFO] Tabella schedule trovata, recupero rate dal database");
                    
                    $schedule = $wpdb->get_results($wpdb->prepare(
                        "SELECT * FROM {$wpdb->prefix}wc_deposits_payment_plans_schedule WHERE plan_id = %d ORDER BY schedule_index ASC",
                        intval($original_plan_id)
                    ));
                    
                    if ($schedule && count($schedule) > 0) {
                        
                        // Le rate trovate vengono aggiunte alla configurazione
                        foreach ($schedule as $payment) {
                            // Salta l'indice 0 che di solito rappresenta l'acconto iniziale
                            if ($payment->schedule_index > 0) {
                                $payment_percentage = 10; // Default 10%
                                
                                // Cerca di determinare la percentuale dalla descrizione o dall'importo
                                if (isset($payment->amount)) {
                                    if (strpos($payment->amount, '%') !== false) {
                                        // È esplicitamente una percentuale
                                        $payment_percentage = floatval(str_replace('%', '', $payment->amount));
                                    } else {
                                        // Verifica se è un numero semplice (tipicamente percentuale)
                                        $cleaned_value = preg_replace('/[^0-9.,]/', '', $payment->amount);
                                        $numeric_value = floatval(str_replace(',', '.', $cleaned_value));
                                        
                                        // Se è un numero ragionevole, assumiamo sia una percentuale
                                        if ($numeric_value > 0 && $numeric_value <= 100) {
                                            $payment_percentage = $numeric_value;
                                        }
                                    }
                                }
                                
                                // Aggiungi questa rata alla configurazione
                                $plan_settings['installments'][] = array(
                                    'percent' => $payment_percentage,
                                    'amount' => 0, // Calcolato in base alla percentuale
                                    'months' => $payment->schedule_index,
                                    'description' => "Rata {$payment->schedule_index} di " . (count($schedule) - 1)
                                );
                                
                            }
                        }
                        
                        error_log("[INFO] Aggiunte " . count($plan_settings['installments']) . " rate alla configurazione");
                    } else {
                        error_log("[WARN] Nessuna rata trovata nella tabella schedule per il piano {$original_plan_id}");
                    }
                } else {
                    error_log("[WARN] Tabella wc_deposits_payment_plans_schedule non trovata");
                }
                
                // Se non abbiamo trovato rate nella tabella schedule, controlliamo se è un piano specifico con ID noto
                if (empty($plan_settings['installments']) && ($original_plan_id == '808' || (isset($plan_data['name']) && $plan_data['name'] == 'Gear Fourth Luffy LX Studio'))) {
                    error_log("[INFO] Piano specifico riconosciuto: Gear Fourth Luffy LX Studio. Applico la configurazione standard a 6 rate.");
                    
                    // Configurazione per il piano Gear Fourth Luffy LX Studio basata sui dati del frontend
                    $plan_settings['installments'] = [
                        // Le percentuali sono prese direttamente dall'output API del frontend che hai mostrato
                        ['percent' => 10, 'amount' => 0, 'months' => 1, 'description' => 'Rata 1 di 6'],
                        ['percent' => 10, 'amount' => 0, 'months' => 2, 'description' => 'Rata 2 di 6'],
                        ['percent' => 10, 'amount' => 0, 'months' => 3, 'description' => 'Rata 3 di 6'],
                        ['percent' => 5, 'amount' => 0, 'months' => 4, 'description' => 'Rata 4 di 6'],
                        ['percent' => 20, 'amount' => 0, 'months' => 5, 'description' => 'Rata 5 di 6'],
                        ['percent' => 5, 'amount' => 0, 'months' => 6, 'description' => 'Rata 6 di 6']
                    ];
                }
                // Se ancora non abbiamo rate, creiamo una rata singola per il saldo
                else if (empty($plan_settings['installments'])) {
                    error_log("[INFO] Nessuna rata trovata, creazione rata singola per il saldo");
                    $plan_settings['installments'][] = array(
                        'percent' => 60, // Assumiamo che l'acconto sia il 40%
                        'amount' => 0,
                        'months' => 1,
                        'description' => 'Saldo'
                    );
                }
                
                error_log("[INFO] Configurazione piano creata: " . var_export($plan_settings, true));
                return $plan_settings;
            } else {
                error_log("[WARN] Nessun piano di pagamento trovato nel database con ID: {$original_plan_id}");
                
                // Se non troviamo il piano specifico, usiamo quello standard basato sulla percentuale di acconto del 40%
                error_log("[INFO] Utilizzo piano Luffy Gear Fourth come fallback per acconto 40%");
                return $this->get_luffy_gear_fourth_plan();
            }
        }
        
        // Cerca nelle opzioni di WordPress
        $all_plans = get_option('wc_deposits_payment_plans', array());
        
        // Cerca corrispondenza esatta
        if (isset($all_plans[$plan_id])) {
            error_log("[INFO] Piano trovato nelle opzioni WordPress con ID esatto: {$plan_id}");
            return $all_plans[$plan_id];
        }
        
        // Se è pianoprova e non abbiamo trovato corrispondenza, restituisci la configurazione hardcoded
        if ($plan_id === 'pianoprova' || $plan_id === 'piano-prova') {
            error_log("[INFO] Restituisco configurazione predefinita per Piano Prova");
            return $this->get_piano_prova_plan();
        }
        
        // Se è gear fourth luffy e non abbiamo trovato corrispondenza, restituisci la configurazione hardcoded
        if ($plan_id === 'luffy-gear-fourth' || $plan_id === 'gear-fourth-luffy') {
            error_log("[INFO] Restituisco configurazione predefinita per Gear Fourth Luffy");
            return $this->get_luffy_gear_fourth_plan();
        }
        
        // Riconosci plan-default e mappalo al piano appropriato in base ai metadati dell'ordine
        if ($plan_id === 'plan-default') {
            // Determina quale piano usare in base ai metadati (deposit_percent o altre informazioni)
            $order_id = isset($_REQUEST['order_id']) ? intval($_REQUEST['order_id']) : 0;
            
            if ($order_id > 0) {
                $order = wc_get_order($order_id);
                if ($order) {
                    // Cerca di determinare l'acconto percentuale dagli item
                    $deposit_percent = 0;
                    foreach ($order->get_items() as $item) {
                        $deposit_amount = $item->get_meta('_deposit_deposit_amount');
                        $full_amount = $item->get_meta('_deposit_full_amount');
                        
                        if (!empty($deposit_amount) && !empty($full_amount) && $full_amount > 0) {
                            $deposit_percent = ($deposit_amount / $full_amount) * 100;
                            break;
                        }
                    }
                    
                    error_log("[INFO] Per plan-default, percentuale di acconto rilevata: {$deposit_percent}%");
                    
                    // Mappa in base alla percentuale di acconto
                    if ($deposit_percent >= 20 && $deposit_percent <= 30) {
                        error_log("[INFO] plan-default mappato a pianoprova per acconto del {$deposit_percent}%");
                        return $this->get_piano_prova_plan();
                    } else if ($deposit_percent >= 35 && $deposit_percent <= 45) {
                        error_log("[INFO] plan-default mappato a luffy-gear-fourth per acconto del {$deposit_percent}%");
                        return $this->get_luffy_gear_fourth_plan();
                    }
                }
            }
            
            // Se non siamo riusciti a determinare il piano, usa pianoprova come default
            error_log("[INFO] plan-default mappato a pianoprova (fallback)");
            return $this->get_piano_prova_plan();
        }
        
        // Nessun piano corrispondente trovato
        error_log("[WARN] Nessun piano trovato per ID: {$original_plan_id}");
        return false;
    }
    
    /**
     * Restituisce la configurazione del piano Gear Fourth Luffy
     * 
     * @return array Configurazione del piano
     */
    private function get_luffy_gear_fourth_plan() {
        return array(
            'name' => 'Gear Fourth Luffy LX Studio',
            'deposit_percent' => 40,
            'installments' => array(
                array('percent' => 10, 'months' => 1, 'description' => 'Rata 1 di 6'),
                array('percent' => 10, 'months' => 2, 'description' => 'Rata 2 di 6'),
                array('percent' => 10, 'months' => 3, 'description' => 'Rata 3 di 6'),
                array('percent' => 10, 'months' => 4, 'description' => 'Rata 4 di 6'),
                array('percent' => 10, 'months' => 5, 'description' => 'Rata 5 di 6'),
                array('percent' => 10, 'months' => 6, 'description' => 'Rata 6 di 6')
            )
        );
    }
    
    /**
     * Restituisce la configurazione del piano prova
     * 
     * @return array Configurazione del piano
     */
    private function get_piano_prova_plan() {
        return array(
            'name' => 'Piano Prova',
            'deposit_percent' => 25,  // Aggiornato al 25% come mostrato nel frontend
            'installments' => array(
                array('percent' => 35, 'months' => 1, 'description' => 'Rata 1 di 2'),  // Convertito da importo fisso a percentuale
                array('percent' => 40, 'months' => 2, 'description' => 'Rata 2 di 2')   // Convertito da importo fisso a percentuale
            )
        );
    }
    
    /**
     * Garantisce che gli acconti vengano processati dopo la creazione dell'ordine via checkout standard o Store API
     * 
     * @param int|WC_Order $order L'ordine o l'ID dell'ordine
     * @param array $data Dati del checkout (opzionale)
     * @param WP_Error $errors Eventuali errori (opzionale)
     * @return void
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
        
        // OPZIONE B: Controlla se ci sono punti riscattati da applicare automaticamente come coupon
        $this->apply_points_coupon_automatically($order);
        
        // Controlla se l'ordine contiene articoli con acconto
        $has_deposit = false;
        
        foreach ($order->get_items() as $item_id => $item) {
            // Log di tutti i metadati dell'item per debug
            $meta_data = $item->get_meta_data();
            $meta_values = [];
            foreach ($meta_data as $meta) {
                $meta_values[$meta->key] = $meta->value;
            }
            
            // Verifica i diversi metadati possibili per gli acconti
            $is_deposit = $item->get_meta('is_deposit');
            $wc_deposit_option = $item->get_meta('wc_deposit_option');
            $wc_convert_to_deposit = $item->get_meta('_wc_convert_to_deposit');
            
            if ($is_deposit === 'yes' || $wc_deposit_option === 'yes' || $wc_convert_to_deposit === 'yes') {
                $has_deposit = true;
                
                // Assicurati che tutti i metadati necessari siano impostati correttamente
                if ($wc_convert_to_deposit === 'yes') {
                    $deposit_type = $item->get_meta('_wc_deposit_type');
                    $deposit_amount = $item->get_meta('_wc_deposit_amount');
                    
                    // Recupera il prezzo e la quantità dell'item per calcoli corretti
                    $product_id = $item->get_product_id();
                    $product = wc_get_product($product_id);
                    $quantity = $item->get_quantity();
                    $product_price = $product ? $product->get_price() : $item->get_total() / $quantity;
                    $line_total = $item->get_total();
                    
                    // CORREZIONE: Calcola le rate sul prezzo originale (senza sconti)
                    // poi applica gli sconti solo alla prima rata (acconto)
                    $original_line_total = $product_price * $quantity;
                    $points_discount = $line_total < $original_line_total ? ($original_line_total - $line_total) : 0;
                    
                    // CORREZIONE iOS: Controlla anche i metadati dell'ordine per lo sconto punti
                    $order_points_discount = floatval($order->get_meta('_points_discount_value'));
                    if ($order_points_discount > 0 && $points_discount == 0) {
                        $points_discount = $order_points_discount;
                        error_log("CORREZIONE iOS: Sconto punti rilevato dai metadati dell'ordine: €{$points_discount}");
                    }
                    
                    // Calcola l'importo effettivo dell'acconto in base al tipo SUL PREZZO ORIGINALE
                    $deposit_value = 0;
                    if ($deposit_type === 'percent') {
                        // Converti la percentuale in decimale e calcola sul prezzo ORIGINALE
                        $deposit_percentage = floatval($deposit_amount) / 100;
                        $deposit_value = $original_line_total * $deposit_percentage;
                        
                        // Applica lo sconto SOLO alla prima rata (acconto)
                        $deposit_value = $deposit_value - $points_discount;
                        
                        // Assicurati che l'acconto non sia negativo
                        $deposit_value = max(0, $deposit_value);
                    } else {
                        // Importo fisso moltiplicato per quantità
                        $deposit_value = floatval($deposit_amount) * $quantity;
                        
                        // Applica lo sconto SOLO alla prima rata (acconto)
                        $deposit_value = $deposit_value - $points_discount;
                        
                        // Assicurati che l'acconto non sia negativo
                        $deposit_value = max(0, $deposit_value);
                    }
                    
                    // Calcola l'importo futuro (saldo) SUL PREZZO ORIGINALE (senza sconto)
                    $future_amount = $original_line_total - ($deposit_value + $points_discount);
                    
                    error_log("CORREZIONE CALCOLO RATE - Prodotto #{$product_id}: Prezzo originale: {$original_line_total}, Sconto punti: {$points_discount}, Acconto: {$deposit_value}, Saldo: {$future_amount}");
                    
                    // Imposta i metadati nel formato atteso da WooCommerce Deposits
                    $item->update_meta_data('is_deposit', 'yes');
                    $item->update_meta_data('wc_deposit_option', 'yes');
                    $item->update_meta_data('deposit_type', $deposit_type);
                    $item->update_meta_data('deposit_amount', $deposit_amount);
                    
                    // Aggiungi i metadati aggiuntivi necessari per il funzionamento completo
                    // CORREZIONE: Usa il prezzo originale come full_amount
                    $item->update_meta_data('_deposit_full_amount', $original_line_total);
                    $item->update_meta_data('_deposit_deposit_amount', $deposit_value);
                    $item->update_meta_data('_deposit_future_amount', $future_amount);
                    // NUOVO APPROCCIO: Determinare il piano di pagamento direttamente dal prodotto
                    $product_id = $item->get_product_id();
                    $product = wc_get_product($product_id);
                    
                    error_log("!!!!!!! NUOVO APPROCCIO !!!!!!!! Determinazione piano pagamento per prodotto #{$product_id}");
                    
                    // Prova a ottenere i piani di pagamento configurati per questo prodotto
                    $payment_plans = get_post_meta($product_id, '_wc_deposit_payment_plans', true);
                    
                    // Log dei piani trovati per il prodotto
                    error_log("!!!!!!! DEBUG PIANI !!!!!!!! Piani disponibili per prodotto #{$product_id}: " . var_export($payment_plans, true));
                    
                    $payment_plan_id = '';
                    
                    // Se il prodotto ha un piano di pagamento configurato, usa il primo
                    if (is_array($payment_plans) && !empty($payment_plans)) {
                        $payment_plan_id = reset($payment_plans); // Prende il primo elemento dell'array
                        error_log("!!!!!!! TROVATO PIANO !!!!!!!! Piano trovato nei metadati del prodotto: {$payment_plan_id}");
                    } 
                    
                    // Se non è stato trovato nei metadati del prodotto, controlla se esiste già nei metadati dell'item
                    if (empty($payment_plan_id)) {
                        $existing_plan = $item->get_meta('_deposit_payment_plan');
                        if (!empty($existing_plan)) {
                            $payment_plan_id = $existing_plan;
                            error_log("!!!!!!! RECUPERO DA ITEM !!!!!!!! Piano trovato nei metadati dell'articolo: {$payment_plan_id}");
                        }
                    }
                    
                    // Se ancora non è stato trovato, prova a recuperarlo dalla sessione
                    if (empty($payment_plan_id) && function_exists('WC')) {
                        if (WC()->session && WC()->session->get('deposit_payment_plan_id')) {
                            $payment_plan_id = WC()->session->get('deposit_payment_plan_id');
                            error_log("!!!!!!! RECUPERO DA SESSIONE !!!!!!!! Piano trovato nella sessione: {$payment_plan_id}");
                        }
                    }
                    
                    // Se ancora non è stato trovato, controlla se c'è nei metadati dell'ordine
                    if (empty($payment_plan_id)) {
                        $order_payment_plan = $order->get_meta('_deposit_payment_plan');
                        if (!empty($order_payment_plan)) {
                            $payment_plan_id = $order_payment_plan;
                            error_log("!!!!!!! RECUPERO DA ORDINE !!!!!!!! Piano trovato nei metadati dell'ordine: {$payment_plan_id}");
                        }
                    }
                    
                    // Se ancora non è stato trovato, usa il piano di default
                    if (empty($payment_plan_id)) {
                        $payment_plan_id = 'plan-default';
                        error_log("!!!!!!! PIANO DEFAULT !!!!!!!! Nessun piano trovato, utilizzo default: plan-default");
                    }
                    
                    // Applica il piano di pagamento all'articolo
                    $item->update_meta_data('_deposit_payment_plan', $payment_plan_id);
                    error_log("!!!!!!! APPLICAZIONE PIANO !!!!!!!! Piano applicato all'articolo #{$item_id}: {$payment_plan_id}");
                    
                    // Aggiungi i metadati originali per compatibilità
                    $item->update_meta_data('_original_deposit_full_amount_meta', '_deposit_full_amount');
                    $item->update_meta_data('_original_deposit_deposit_amount_meta', '_deposit_deposit_amount');
                    $item->update_meta_data('_original_deposit_future_amount_meta', '_deposit_future_amount');
                    
                    $item->save();
                    error_log("[INFO] Metadati aggiornati per compatibilità con WooCommerce Deposits. Acconto: {$deposit_value}, Totale: {$line_total}");
                }
                
                break;
            }
        }
        
        if ($has_deposit) {
            error_log("[INFO] L'ordine #{$order->get_id()} contiene acconti, avvio processamento");
            
            // Calcola gli importi totali dell'ordine
            $order_total = $order->get_total();
            $deposit_total = 0;
            $future_total = 0;
            
            // Calcola gli importi di acconto e saldo per ogni item
            foreach ($order->get_items() as $item_id => $item) {
                // Controlla se questo item ha un acconto
                $is_deposit = $item->get_meta('is_deposit');
                $wc_deposit_option = $item->get_meta('wc_deposit_option');
                $wc_convert_to_deposit = $item->get_meta('_wc_convert_to_deposit');
                
                if ($is_deposit === 'yes' || $wc_deposit_option === 'yes' || $wc_convert_to_deposit === 'yes') {
                    $deposit_amount_item = $item->get_meta('_deposit_deposit_amount');
                    $future_amount_item = $item->get_meta('_deposit_future_amount');
                    
                    if ($deposit_amount_item && $future_amount_item) {
                        $deposit_total += floatval($deposit_amount_item);
                        $future_total += floatval($future_amount_item);
                    }
                }
            }
            
            
            // Imposta i metadati a livello di ordine per gli acconti
            update_post_meta($order->get_id(), '_wc_deposits_order_has_deposit', 'yes');
            update_post_meta($order->get_id(), '_wc_deposits_deposit_paid', 'no'); // Inizialmente non è stato pagato
            update_post_meta($order->get_id(), '_wc_deposits_deposit_amount', $deposit_total);
            update_post_meta($order->get_id(), '_wc_deposits_second_payment', $future_total);
            update_post_meta($order->get_id(), '_wc_deposits_deposit_payment_time', current_time('timestamp'));
            update_post_meta($order->get_id(), '_wc_deposits_payment_schedule', 'schedule-default');
            
            // IMPORTANTE: Non modifichiamo direttamente il totale dell'ordine perché causa problemi
            // Imposta solo i metadati necessari per WooCommerce Deposits
            error_log("[INFO] Impostazione metadati per acconto: {$deposit_total} di totale {$order->get_total()}");
            
            // I metadati sono sufficienti, WooCommerce Deposits gestirà il resto
            
            // Imposta lo stato dell'ordine come pagamento parziale usando l'API diretta per evitare problemi
            error_log("[INFO] Aggiorno lo stato dell'ordine #{$order->get_id()} a 'partial-payment' usando wp_update_post");
            
            // Imposta prima lo stato dell'ordine usando wp_update_post per aggirare problemi con set_status
            wp_update_post(array(
                'ID'          => $order->get_id(),
                'post_status' => 'wc-partial-payment'
            ));
            
            // Imposta anche lo status nell'oggetto ordine per coerenza
            try {
                $order->set_status('partial-payment');
            } catch (Exception $e) {
                error_log("[WARN] Impossibile aggiornare lo stato nell'oggetto ordine: " . $e->getMessage());
            }
            
            // Imposta un meta chiave aggiuntivo che indica che l'ordine è parziale
            update_post_meta($order->get_id(), '_payment_status', 'partial');
            
            
            // Verifica se la classe del plugin WooCommerce Deposits è disponibile
            if (class_exists('WC_Deposits_Order_Manager')) {
                $deposits_manager = WC_Deposits_Order_Manager::get_instance();
                
                // Log di tutti i metadati dell'ordine per debug
                $order_meta = get_post_meta($order->get_id());
                
                
                try {
                    // Recupera informazioni dell'ordine originale
                    $order_data = $order->get_data();
                    $customer_id = $order->get_customer_id();
                    $billing_address = $order->get_address('billing');
                    $shipping_address = $order->get_address('shipping');
                    $total_price = $order->get_total();
                    
                    // Recupera l'acconto pagato
                    $deposit_amount = get_post_meta($order->get_id(), '_wc_deposits_deposit_amount', true);
                    if (!$deposit_amount) {
                        $deposit_amount = 0;
                        foreach ($order->get_items() as $item_id => $item) {
                            $item_deposit = $item->get_meta('_deposit_deposit_amount');
                            if ($item_deposit) {
                                $deposit_amount += floatval($item_deposit);
                            }
                        }
                    }
                    
                    // IMPORTANTE: Aggiorniamo il totale dell'ordine principale per riflettere solo l'acconto
                    // Questo risolve il problema dell'ordine visualizzato a prezzo pieno invece che al solo importo dell'acconto
                    if ($deposit_amount > 0) {
                        $original_total = $order->get_total();
                        $order->set_total($deposit_amount);
                        $order->save();
                    }
                    
                    // Controlla quale piano di pagamento è stato selezionato
                    $payment_plan = '';
                    $payment_plan_name = '';
                    $deposit_percentage = 0;
                    $installment_meta_data = null;
                    
                    
                    // Cerca nei metadati degli item il piano di pagamento e le sue caratteristiche
                    foreach ($order->get_items() as $item_id => $item) {
                        // Log dei metadati più importanti
                        $plan = $item->get_meta('_deposit_payment_plan');
                        $plan_name = $item->get_meta('_deposit_payment_plan_name');
                        $deposit_percent = $item->get_meta('_deposit_percentage');
                        
                        
                        // Per debug stampiamo anche tutti i metadati dell'item
                        $meta_data = $item->get_meta_data();
                        foreach ($meta_data as $meta) {
                            
                            // Cerca informazioni sulle rate direttamente nei metadati
                            if ($meta->key === '_deposit_installments' && is_array($meta->value)) {
                                $installment_meta_data = $meta->value;
                            }
                        }
                        
                        // Determina il piano da usare - usa solo quello specificato nel prodotto
                        if (!empty($plan)) {
                            $payment_plan = $plan;
                            $payment_plan_name = $plan_name;
                        } elseif (!empty($plan_name)) {
                            $payment_plan_name = $plan_name;
                            $payment_plan = sanitize_title($plan_name);
                        }
                        
                        // Recupera percentuale e schedule se disponibili
                        if (!empty($deposit_percent)) {
                            $deposit_percentage = floatval($deposit_percent);
                        }
                        
                        // Se abbiamo un piano, interrompi la ricerca
                        if (!empty($payment_plan)) {
                            break;
                        }
                    }
                    
                    error_log("[INFO] Piano di pagamento finale: {$payment_plan}, Nome: {$payment_plan_name}");
                    
                    // Definisci le rate in base al piano
                    $installments = array();
                    
                    // Prima prova a usare i metadati dell'installment se disponibili
                    if (!empty($installment_meta_data) && is_array($installment_meta_data)) {
                        $installments = $installment_meta_data;
                        error_log("[INFO] Utilizzo configurazione rate dai metadati dell'ordine");
                    } else {
                        // Altrimenti cerca la configurazione del piano
                        $plan_settings = false;
                        
                        if (!empty($payment_plan)) {
                            $plan_settings = $this->get_payment_plan_settings($payment_plan);
                        }
                        
                        if (!empty($plan_settings) && isset($plan_settings['installments']) && is_array($plan_settings['installments'])) {
                            // Usa le impostazioni del piano dal database
                            error_log("[INFO] Utilizzo configurazione piano dal database: {$payment_plan}");
                            $installments = $plan_settings['installments'];
                        } else {
                            // Non abbiamo trovato nessun dato, creiamo una singola rata con il saldo residuo
                            $future_amount = $total_price - $deposit_amount;
                            if ($future_amount <= 0) {
                                $future_amount = round($total_price * 0.6, 2); // 60% come saldo se il calcolo fallisce
                            }
                            
                            $installments[] = array(
                                'amount' => $future_amount,
                                'months' => 1,
                                'description' => 'Saldo'
                            );
                            
                            error_log("[INFO] Configurazione piano fallback: 1 rata di {$future_amount}€");
                        }
                    }
                    
                    // Calcola gli importi delle rate in base alla percentuale o importo fisso
                    foreach ($installments as $key => $installment) {
                        $amount = 0;
                        $has_percent = isset($installment['percent']) && floatval($installment['percent']) > 0;
                        
                        // Priorità 1: Usa la percentuale se è specificata, anche se amount è presente
                        if ($has_percent) {
                            $percent = floatval($installment['percent']);
                            $amount = round(($total_price * $percent) / 100, 2);
                        } 
                        // Priorità 2: Usa importi fissi se definiti e maggiori di zero
                        else if (isset($installment['amount']) && floatval($installment['amount']) > 0) {
                            $amount = floatval($installment['amount']);
                        }
                        // Priorità 3: Fallback se né percentuale né importo sono validi
                        else {
                            // Calcola un importo predefinito del 10% del totale
                            $amount = round($total_price * 0.10, 2);
                            
                            // Log più dettagliato per capire perché si è arrivati al fallback
                            if (isset($installment['percent'])) {
                                error_log("[WARN] Percentuale non valida ({$installment['percent']}), uso fallback 10%: {$amount}");
                            } else if (isset($installment['amount'])) {
                                error_log("[WARN] Importo non valido ({$installment['amount']}), uso fallback 10%: {$amount}");
                            } else {
                                error_log("[WARN] Nessun importo/percentuale specificato per la rata #{$key}, uso fallback 10%: {$amount}");
                            }
                        }
                        
                        $installments[$key]['amount'] = $amount;
                        error_log("[INFO] Rata #{$key} configurata con importo: {$amount}");
                    }
                    
                    error_log("[INFO] Creazione di " . count($installments) . " rate future");
                    
                    $order_ids = array();
                    $current_time = current_time('timestamp');
                    
                    // Crea un ordine per ogni rata
                    foreach ($installments as $index => $installment) {
                        // Verifica che l'importo sia valido - a questo punto dovrebbe sempre essere valido
                        // grazie ai controlli precedenti, ma per sicurezza controlliamo di nuovo
                        $installment_amount = floatval($installment['amount']);
                        if ($installment_amount <= 0) {
                            error_log("[ERROR] Importo non valido per la rata #{$index}: {$installment_amount}, saltata");
                            continue;
                        }
                    
                        // Calcola la data di scadenza
                        $months = isset($installment['months']) ? intval($installment['months']) : ($index + 1);
                        if ($months <= 0) $months = 1;
                        $payment_date = date('Y-m-d', strtotime("+{$months} month", $current_time));
                        $payment_date_formatted = date('d F Y', strtotime($payment_date));
                        
                        // Descrizione della rata
                        $rata_description = !empty($installment['description']) ? 
                                        $installment['description'] : 
                                        'Rata ' . ($index + 1) . ' di ' . count($installments);
                        
                        error_log("[INFO] Creazione rata #{$index}: {$installment_amount}€, scadenza: {$payment_date}, desc: {$rata_description}");
                        
                        try {
                            // Crea un nuovo ordine per questa rata
                            $installment_order = wc_create_order(array(
                                'status'        => 'scheduled-payment',
                                'customer_id'    => $customer_id,
                                'customer_note'  => $rata_description . ' per ordine #' . $order->get_id(),
                                'created_via'    => 'wc_deposits',
                            ));
                            
                            if (!$installment_order) {
                                throw new Exception("Creazione ordine fallita");
                            }
                            
                            $installment_order_id = $installment_order->get_id();
                            $order_ids[] = $installment_order_id;
                            error_log("[INFO] Ordine rata #{$installment_order_id} creato con successo");
                            
                            // Imposta indirizzi di fatturazione e spedizione
                            $installment_order->set_address($billing_address, 'billing');
                            $installment_order->set_address($shipping_address, 'shipping');
                            
                            // Cerca un prodotto valido da usare come placeholder
                            $product = null;
                            
                            // Prima prova con l'ID 1
                            $product = wc_get_product(1);
                            
                            // Se non esiste, cerca un qualsiasi prodotto pubblicato
                            if (!$product) {
                                $products = wc_get_products(array('limit' => 1, 'status' => 'publish'));
                                if (!empty($products)) {
                                    $product = $products[0];
                                }
                            }
                            
                            // Ultimo tentativo: cerca qualsiasi prodotto
                            if (!$product) {
                                $products = wc_get_products(array('limit' => 1));
                                if (!empty($products)) {
                                    $product = $products[0];
                                }
                            }
                            
                            if (!$product) {
                                throw new Exception("Nessun prodotto disponibile per l'ordine rata");
                            }
                            
                            // Crea un item per questa rata
                            $item_id = $installment_order->add_product(
                                $product,
                                1,
                                array(
                                    'name' => $rata_description . ' per ordine #' . $order->get_id() . ' - Scadenza ' . $payment_date_formatted,
                                    'total' => $installment_amount,
                                    'subtotal' => $installment_amount
                                )
                            );
                            
                            if (!$item_id) {
                                throw new Exception("Impossibile aggiungere il prodotto all'ordine");
                            }
                            
                            // Imposta i metadati dell'ordine
                            $installment_order->set_total($installment_amount);
                            $installment_order->update_meta_data('_wc_deposits_payment_type', 'installment_' . ($index + 1));
                            $installment_order->update_meta_data('_wc_deposits_parent_order', $order->get_id());
                            $installment_order->update_meta_data('_wc_deposits_payment_date', $payment_date);
                            $installment_order->update_meta_data('_wc_deposits_payment_number', ($index + 1));
                            $installment_order->update_meta_data('_wc_deposits_payment_description', $rata_description);
                            
                            // Aggiungi metadati dell'ordine originale per riferimento
                            $installment_order->update_meta_data('_wc_deposits_original_order', $order->get_id());
                            
                            // Salva l'ordine
                            $installment_order->calculate_totals();
                            $installment_order->save();
                            
                            // Aggiorna il post_parent e post_date direttamente nel database
                            global $wpdb;
                            
                            // Formatta la data di scadenza nel formato corretto per MySQL (Y-m-d H:i:s)
                            $mysql_date = date('Y-m-d 12:00:00', strtotime($payment_date));
                            
                            $wpdb->update(
                                $wpdb->posts,
                                array(
                                    'post_parent' => $order->get_id(),
                                    'post_date' => $mysql_date,
                                    'post_date_gmt' => get_gmt_from_date($mysql_date),
                                ),
                                array('ID' => $installment_order_id),
                                array('%d', '%s', '%s'),
                                array('%d')
                            );
                            
                            error_log("[INFO] Ordine rata #{$installment_order_id} salvato con importo {$installment_amount}€, scadenza {$payment_date} (data MySQL: {$mysql_date}), e post_parent {$order->get_id()}");
                        } catch (Exception $e) {
                            error_log("[ERROR] Errore nella creazione della rata #{$index}: " . $e->getMessage());
                            continue;
                        }
                    }
                    
                    // Salva gli ID degli ordini delle rate nell'ordine principale
                    if (!empty($order_ids)) {
                        // Calcola l'importo totale delle rate
                        $total_installments = 0;
                        foreach ($installments as $installment) {
                            if (isset($installment['amount'])) {
                                $total_installments += floatval($installment['amount']);
                            }
                        }
                        
                        // Aggiorna i metadati dell'ordine principale
                        update_post_meta($order->get_id(), '_wc_deposits_payment_schedule_orders', $order_ids);
                        update_post_meta($order->get_id(), '_wc_deposits_second_payment_order', $order_ids[0]); // Per compatibilità con vecchio codice
                        update_post_meta($order->get_id(), '_wc_deposits_second_payment_reminder_email_sent', 'no');
                        update_post_meta($order->get_id(), '_wc_deposits_payment_schedule_count', count($order_ids)); // Numero di rate
                        update_post_meta($order->get_id(), '_wc_deposits_payment_schedule_total', $total_installments); // Importo totale delle rate
                        
                        error_log("[INFO] Metadati degli ordini aggiornati nell'ordine principale #{$order->get_id()}: " . count($order_ids) . " rate per un totale di {$total_installments}€");
                        
                        // Se questo è un piano Gear Fourth Luffy, salviamo un flag specifico
                        if (strpos(strtolower($payment_plan), 'luffy') !== false || strpos(strtolower($payment_plan_name), 'luffy') !== false) {
                            update_post_meta($order->get_id(), '_wc_deposits_gear_fourth_plan', 'yes');
                            error_log("[INFO] Piano Gear Fourth Luffy confermato per l'ordine #{$order->get_id()}");
                        }
                    } else {
                        error_log("[WARN] Nessuna rata creata per l'ordine #{$order->get_id()}");
                    }
                    
                } catch (Exception $e) {
                    error_log("[ERROR] Errore nella creazione delle rate future: " . $e->getMessage());
                }
                
                // Invoca il metodo per processare gli acconti nell'ordine
                if (method_exists($deposits_manager, 'process_deposits_in_order')) {
                    error_log("[INFO] Invocazione process_deposits_in_order per ordine #{$order->get_id()}");
                    try {
                        $deposits_manager->process_deposits_in_order($order->get_id());
                        error_log("[INFO] Processamento acconti completato per ordine #{$order->get_id()}");
                    } catch (Exception $e) {
                        error_log("[ERROR] Errore nel processare gli acconti per l'ordine #{$order->get_id()}: " . $e->getMessage());
                    }
                    
                    // Log di tutti i metadati dell'ordine dopo il processamento
                    $order_meta_after = get_post_meta($order->get_id());
                } else {
                    error_log("[ERROR] Metodo process_deposits_in_order non trovato nel plugin WooCommerce Deposits");
                }
            } else {
                error_log("[ERROR] Classe WC_Deposits_Order_Manager non trovata, verifica che il plugin WooCommerce Deposits sia attivo");
            }
        }
        
        // Salva l'ordine dopo il processamento degli acconti
        $order->save();
    }
    
    /**
     * Assicura che gli acconti vengano processati dopo la creazione dell'ordine via REST API
     * 
     * @param mixed $response La risposta originale
     * @param WP_REST_Request|WP_Post $post La richiesta o il post/ordine
     * @param WP_REST_Request $request La richiesta originale
     * @return mixed La risposta originale
     */
    public function ensure_deposits_processing_api($response, $post, $request) {
        // Controllo preliminare
        if (!$response || is_wp_error($response)) {
            return $response;
        }

        // Identifica l'ordine in modo diverso in base al tipo di oggetto ricevuto
        $order_id = null;
        
        if (is_object($post) && isset($post->ID)) {
            // Se è un oggetto WP_Post
            if (isset($post->post_type) && $post->post_type === 'shop_order') {
                $order_id = $post->ID;
            } else {
                return $response; // Non è un ordine, esci
            }
        } else if (is_object($post) && method_exists($post, 'get_params')) {
            // Se è un oggetto WP_REST_Request
            $params = $post->get_params();
            if (isset($params['id'])) {
                $order_id = $params['id'];
                // Verifica che sia un ordine
                $post_type = get_post_type($order_id);
                if ($post_type !== 'shop_order') {
                    return $response;
                }
            } else {
                return $response;
            }
        } else {
            // Non possiamo determinare l'ordine
            return $response;
        }
        
        try {
            $order = wc_get_order($order_id);
            if ($order) {
                $this->ensure_deposits_processing($order);
            }
        } catch (Exception $e) {
            error_log("Errore nell'elaborazione dell'acconto per l'ordine {$order_id}: " . $e->getMessage());
        }
        
        return $response;
    }
    
    /**
     * Forza l'elaborazione degli acconti per un ordine specifico
     * 
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function force_deposits_processing($request) {
        $order_id = $request->get_param('order_id');
        
        error_log("[FORCE DEPOSITS] Richiesta forzatura elaborazione acconti per ordine #{$order_id}");
        
        if (!$order_id) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'ID ordine mancante'
            ), 400);
        }
        
        $order = wc_get_order($order_id);
        if (!$order) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Ordine non trovato'
            ), 404);
        }
        
        try {
            error_log("[FORCE DEPOSITS] Inizio elaborazione forzata per ordine #{$order_id}");
            
            // Chiama direttamente il metodo di elaborazione degli acconti
            $this->ensure_deposits_processing($order);
            
            error_log("[FORCE DEPOSITS] Elaborazione completata per ordine #{$order_id}");
            
            return new WP_REST_Response(array(
                'success' => true,
                'message' => 'Elaborazione acconti completata',
                'order_id' => $order_id
            ), 200);
            
        } catch (Exception $e) {
            error_log("[FORCE DEPOSITS] Errore durante l'elaborazione per ordine #{$order_id}: " . $e->getMessage());
            
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Errore durante l\'elaborazione: ' . $e->getMessage()
            ), 500);
        }
    }
    
    /**
     * OPZIONE B: Applica automaticamente il coupon dei punti all'ordine se sono presenti i metadati
     *
     * @param WC_Order $order L'ordine da processare
     */
    private function apply_points_coupon_automatically($order) {
        // Controlla se ci sono metadati dei punti riscattati
        $points_redeemed = $order->get_meta('_points_redeemed');
        $points_discount_value = $order->get_meta('_points_discount_value');
        $points_coupon_code = $order->get_meta('_points_coupon_applied');
        
        if (!$points_redeemed || !$points_discount_value || !$points_coupon_code) {
            error_log("[OPZIONE B] Nessun metadato punti trovato per l'ordine #{$order->get_id()}");
            return;
        }
        
        error_log("[OPZIONE B] Trovati metadati punti per l'ordine #{$order->get_id()}: {$points_redeemed} punti, sconto €{$points_discount_value}, coupon: {$points_coupon_code}");
        
        // Controlla se il coupon è già applicato
        $existing_coupons = $order->get_coupon_codes();
        if (in_array($points_coupon_code, $existing_coupons)) {
            error_log("[OPZIONE B] Coupon {$points_coupon_code} già applicato all'ordine #{$order->get_id()}");
            return;
        }
        
        // Applica il coupon all'ordine
        try {
            // Verifica che il coupon esista
            $coupon = new WC_Coupon($points_coupon_code);
            if (!$coupon->get_id()) {
                error_log("[OPZIONE B] Coupon {$points_coupon_code} non trovato per l'ordine #{$order->get_id()}");
                return;
            }
            
            // Applica il coupon all'ordine
            $order->apply_coupon($points_coupon_code);
            
            // Ricalcola i totali
            $order->calculate_totals();
            $order->save();
            
            error_log("[OPZIONE B] Coupon {$points_coupon_code} applicato con successo all'ordine #{$order->get_id()}");
            
        } catch (Exception $e) {
            error_log("[OPZIONE B] Errore nell'applicazione del coupon {$points_coupon_code} all'ordine #{$order->get_id()}: " . $e->getMessage());
        }
    }
    
    /**
     * Controlla quando una rata viene pagata e aggiorna l'ordine principale se tutte le rate sono pagate
     * 
     * @param int $order_id ID dell'ordine
     * @param string $old_status Vecchio status
     * @param string $new_status Nuovo status
     * @param WC_Order $order Oggetto ordine
     */
    public function check_installment_completion($order_id, $old_status, $new_status, $order) {
        // Controlla se il nuovo status indica che la rata è stata pagata
        if (!in_array($new_status, array('processing', 'completed'))) {
            return;
        }
        
        // Controlla se questo ordine è una rata (ha un parent_id)
        $parent_order_id = $order->get_parent_id();
        if (!$parent_order_id || $parent_order_id <= 0) {
            return;
        }
        
        error_log("[DEPOSITS] Rata #{$order_id} pagata per ordine principale #{$parent_order_id}, controllo se tutte le rate sono pagate");
        
        // Recupera tutte le rate dell'ordine principale
        $installments = wc_get_orders(array(
            'parent' => $parent_order_id,
            'limit' => -1,
            'status' => array('scheduled-payment', 'pending-deposit', 'processing', 'completed')
        ));
        
        if (empty($installments)) {
            error_log("[DEPOSITS] Nessuna rata trovata per ordine principale #{$parent_order_id}");
            return;
        }
        
        error_log("[DEPOSITS] Trovate " . count($installments) . " rate per ordine principale #{$parent_order_id}");
        
        // Controlla se tutte le rate sono pagate (processing o completed)
        $all_paid = true;
        $paid_count = 0;
        $total_count = count($installments);
        
        foreach ($installments as $installment) {
            $status = $installment->get_status();
            if (in_array($status, array('processing', 'completed'))) {
                $paid_count++;
            } else {
                $all_paid = false;
                error_log("[DEPOSITS] Rata #{$installment->get_id()} non ancora pagata (status: {$status})");
            }
        }
        
        error_log("[DEPOSITS] Rate pagate: {$paid_count}/{$total_count}");
        
        if ($all_paid && $total_count > 0) {
            // Tutte le rate sono pagate, aggiorna l'ordine principale e tutte le rate
            $parent_order = wc_get_order($parent_order_id);
            if ($parent_order) {
                $current_parent_status = $parent_order->get_status();
                
                // Aggiorna solo se l'ordine principale è in stato "partial-payment"
                if ($current_parent_status === 'partial-payment') {
                    error_log("[DEPOSITS] Tutte le rate pagate per ordine #{$parent_order_id}, aggiorno da {$current_parent_status} a completed");
                    
                    $parent_order->set_status('completed', 'Tutte le rate sono state pagate.');
                    $parent_order->save();
                    
                    error_log("[DEPOSITS] Ordine principale #{$parent_order_id} aggiornato a completed");
                    
                    // Aggiorna anche tutte le rate a "completed" se sono solo in "processing"
                    foreach ($installments as $installment) {
                        if ($installment->get_status() === 'processing') {
                            error_log("[DEPOSITS] Aggiorno rata #{$installment->get_id()} da processing a completed");
                            $installment->set_status('completed', 'Tutte le rate completate.');
                            $installment->save();
                        }
                    }
                    
                    error_log("[DEPOSITS] Tutte le rate aggiornate a completed");
                } else {
                    error_log("[DEPOSITS] Ordine principale #{$parent_order_id} già in status {$current_parent_status}, non aggiorno");
                }
            }
        }
    }
}

// Inizializza il plugin
function dreamshop_deposits_api() {
    return DreamShop_Deposits_API::get_instance();
}

// Avvia il plugin
dreamshop_deposits_api();