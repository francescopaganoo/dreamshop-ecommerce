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

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly.
}

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
}

// Inizializza il plugin
function dreamshop_deposits_api() {
    return DreamShop_Deposits_API::get_instance();
}

// Avvia il plugin
dreamshop_deposits_api();
