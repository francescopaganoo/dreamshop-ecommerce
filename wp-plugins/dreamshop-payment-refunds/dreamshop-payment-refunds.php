<?php
/**
 * Plugin Name: DreamShop Payment Refunds
 * Plugin URI: https://planstudios.it
 * Description: Gestisce i rimborsi per ordini Stripe e PayPal creati dal frontend
 * Version: 1.0.0
 * Author: Plan Studios Group - FP
 * Author URI: https://planstudios.it
 * Text Domain: dreamshop-refunds
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 */

// Previeni accesso diretto
if (!defined('ABSPATH')) {
    exit;
}

// Definisci costanti del plugin
define('DREAMSHOP_REFUNDS_VERSION', '1.0.0');
define('DREAMSHOP_REFUNDS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('DREAMSHOP_REFUNDS_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Classe principale del plugin
 */
class DreamShop_Payment_Refunds {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // Hook di inizializzazione
        add_action('plugins_loaded', array($this, 'init'));
        add_action('admin_menu', array($this, 'add_settings_page'));
        add_action('admin_init', array($this, 'register_settings'));

        // Hook per ordini WooCommerce
        add_action('woocommerce_order_item_add_action_buttons', array($this, 'add_refund_button'), 10, 1);

        // AJAX handlers
        add_action('wp_ajax_dreamshop_process_refund', array($this, 'ajax_process_refund'));
        add_action('wp_ajax_dreamshop_test_stripe', array($this, 'ajax_test_stripe'));
        add_action('wp_ajax_dreamshop_test_paypal', array($this, 'ajax_test_paypal'));

        // Enqueue scripts
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
    }

    /**
     * Inizializza il plugin
     */
    public function init() {
        // Carica traduzioni
        load_plugin_textdomain('dreamshop-refunds', false, dirname(plugin_basename(__FILE__)) . '/languages');

        // Verifica che WooCommerce sia attivo
        if (!class_exists('WooCommerce')) {
            add_action('admin_notices', array($this, 'woocommerce_missing_notice'));
            return;
        }
    }

    /**
     * Avviso se WooCommerce non è attivo
     */
    public function woocommerce_missing_notice() {
        ?>
        <div class="notice notice-error">
            <p><?php _e('DreamShop Payment Refunds richiede WooCommerce per funzionare.', 'dreamshop-refunds'); ?></p>
        </div>
        <?php
    }

    /**
     * Aggiungi pagina impostazioni
     */
    public function add_settings_page() {
        add_submenu_page(
            'woocommerce',
            __('Impostazioni Rimborsi', 'dreamshop-refunds'),
            __('Rimborsi Payment', 'dreamshop-refunds'),
            'manage_woocommerce',
            'dreamshop-refunds-settings',
            array($this, 'render_settings_page')
        );
    }

    /**
     * Registra le impostazioni
     */
    public function register_settings() {
        // Sezione Stripe
        add_settings_section(
            'dreamshop_refunds_stripe',
            __('Impostazioni Stripe', 'dreamshop-refunds'),
            array($this, 'stripe_section_callback'),
            'dreamshop-refunds-settings'
        );

        register_setting('dreamshop_refunds_settings', 'dreamshop_stripe_publishable_key');
        register_setting('dreamshop_refunds_settings', 'dreamshop_stripe_secret_key');

        add_settings_field(
            'dreamshop_stripe_publishable_key',
            __('Stripe Publishable Key', 'dreamshop-refunds'),
            array($this, 'stripe_publishable_key_callback'),
            'dreamshop-refunds-settings',
            'dreamshop_refunds_stripe'
        );

        add_settings_field(
            'dreamshop_stripe_secret_key',
            __('Stripe Secret Key', 'dreamshop-refunds'),
            array($this, 'stripe_secret_key_callback'),
            'dreamshop-refunds-settings',
            'dreamshop_refunds_stripe'
        );

        // Sezione PayPal
        add_settings_section(
            'dreamshop_refunds_paypal',
            __('Impostazioni PayPal', 'dreamshop-refunds'),
            array($this, 'paypal_section_callback'),
            'dreamshop-refunds-settings'
        );

        register_setting('dreamshop_refunds_settings', 'dreamshop_paypal_client_id');
        register_setting('dreamshop_refunds_settings', 'dreamshop_paypal_client_secret');
        register_setting('dreamshop_refunds_settings', 'dreamshop_paypal_mode');

        add_settings_field(
            'dreamshop_paypal_client_id',
            __('PayPal Client ID', 'dreamshop-refunds'),
            array($this, 'paypal_client_id_callback'),
            'dreamshop-refunds-settings',
            'dreamshop_refunds_paypal'
        );

        add_settings_field(
            'dreamshop_paypal_client_secret',
            __('PayPal Client Secret', 'dreamshop-refunds'),
            array($this, 'paypal_client_secret_callback'),
            'dreamshop-refunds-settings',
            'dreamshop_refunds_paypal'
        );

        add_settings_field(
            'dreamshop_paypal_mode',
            __('Modalità PayPal', 'dreamshop-refunds'),
            array($this, 'paypal_mode_callback'),
            'dreamshop-refunds-settings',
            'dreamshop_refunds_paypal'
        );
    }

    /**
     * Callback sezioni
     */
    public function stripe_section_callback() {
        echo '<p>' . __('Inserisci le credenziali Stripe per processare i rimborsi.', 'dreamshop-refunds') . '</p>';
    }

    public function paypal_section_callback() {
        echo '<p>' . __('Inserisci le credenziali PayPal per processare i rimborsi.', 'dreamshop-refunds') . '</p>';
    }

    /**
     * Callback campi Stripe
     */
    public function stripe_publishable_key_callback() {
        $value = get_option('dreamshop_stripe_publishable_key', '');
        echo '<input type="text" name="dreamshop_stripe_publishable_key" value="' . esc_attr($value) . '" class="regular-text" />';
        echo '<p class="description">' . __('La tua Stripe Publishable Key (pk_live_... o pk_test_...)', 'dreamshop-refunds') . '</p>';
    }

    public function stripe_secret_key_callback() {
        $value = get_option('dreamshop_stripe_secret_key', '');
        echo '<input type="password" name="dreamshop_stripe_secret_key" value="' . esc_attr($value) . '" class="regular-text" />';
        echo '<p class="description">' . __('La tua Stripe Secret Key (sk_live_... o sk_test_...)', 'dreamshop-refunds') . '</p>';
    }

    /**
     * Callback campi PayPal
     */
    public function paypal_client_id_callback() {
        $value = get_option('dreamshop_paypal_client_id', '');
        echo '<input type="text" name="dreamshop_paypal_client_id" value="' . esc_attr($value) . '" class="regular-text" />';
        echo '<p class="description">' . __('Il tuo PayPal Client ID', 'dreamshop-refunds') . '</p>';
    }

    public function paypal_client_secret_callback() {
        $value = get_option('dreamshop_paypal_client_secret', '');
        echo '<input type="password" name="dreamshop_paypal_client_secret" value="' . esc_attr($value) . '" class="regular-text" />';
        echo '<p class="description">' . __('Il tuo PayPal Client Secret', 'dreamshop-refunds') . '</p>';
    }

    public function paypal_mode_callback() {
        $value = get_option('dreamshop_paypal_mode', 'live');
        ?>
        <select name="dreamshop_paypal_mode">
            <option value="sandbox" <?php selected($value, 'sandbox'); ?>><?php _e('Sandbox (Test)', 'dreamshop-refunds'); ?></option>
            <option value="live" <?php selected($value, 'live'); ?>><?php _e('Live (Produzione)', 'dreamshop-refunds'); ?></option>
        </select>
        <?php
    }

    /**
     * Render pagina impostazioni
     */
    public function render_settings_page() {
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <form method="post" action="options.php">
                <?php
                settings_fields('dreamshop_refunds_settings');
                do_settings_sections('dreamshop-refunds-settings');
                submit_button();
                ?>
            </form>

            <hr>

            <h2><?php _e('Test Connessione', 'dreamshop-refunds'); ?></h2>
            <p><?php _e('Verifica che le tue chiavi API siano configurate correttamente.', 'dreamshop-refunds'); ?></p>
            <button type="button" class="button" id="test-stripe-connection"><?php _e('Test Stripe', 'dreamshop-refunds'); ?></button>
            <button type="button" class="button" id="test-paypal-connection"><?php _e('Test PayPal', 'dreamshop-refunds'); ?></button>
            <div id="test-results" style="margin-top: 10px;"></div>
        </div>
        <?php
    }

    /**
     * Aggiungi bottone rimborso nella pagina ordine
     */
    public function add_refund_button($order) {
        // Verifica che sia un oggetto ordine valido
        if (!$order instanceof WC_Order) {
            return;
        }

        // Ottieni il metodo di pagamento
        $payment_method = $order->get_payment_method();

        // Verifica se l'ordine è stato pagato con Stripe, Klarna, Satispay o PayPal
        if (!in_array($payment_method, array('stripe', 'klarna', 'satispay', 'paypal'))) {
            return;
        }

        // Verifica che l'ordine sia pagato e non già rimborsato
        if (!$order->is_paid() || $order->get_status() === 'refunded') {
            return;
        }

        // Determina il gateway di pagamento effettivo (stripe, klarna e satispay usano Stripe)
        $payment_gateway = in_array($payment_method, array('stripe', 'klarna', 'satispay')) ? 'stripe' : 'paypal';

        // Ottieni l'ID della transazione
        $transaction_id = '';
        if ($payment_gateway === 'stripe') {
            // Prova tutti i possibili meta_key per Stripe/Klarna/Satispay
            $transaction_id = $order->get_meta('_stripe_payment_intent_id');
            if (empty($transaction_id)) {
                $transaction_id = $order->get_meta('_stripe_payment_intent');
            }
        } elseif ($payment_gateway === 'paypal') {
            $transaction_id = $order->get_meta('_paypal_transaction_id');
            if (empty($transaction_id)) {
                $transaction_id = $order->get_meta('_paypal_order_id');
            }
        }

        if (empty($transaction_id)) {
            return;
        }

        // Determina il label del bottone
        $button_label = '';
        if ($payment_method === 'klarna') {
            $button_label = 'Klarna (Stripe)';
        } elseif ($payment_method === 'satispay') {
            $button_label = 'Satispay (Stripe)';
        } else {
            $button_label = ucfirst($payment_method);
        }

        ?>
        <button type="button" class="button dreamshop-refund-button"
                data-order-id="<?php echo esc_attr($order->get_id()); ?>"
                data-payment-method="<?php echo esc_attr($payment_method); ?>"
                data-payment-gateway="<?php echo esc_attr($payment_gateway); ?>"
                data-transaction-id="<?php echo esc_attr($transaction_id); ?>"
                data-order-total="<?php echo esc_attr($order->get_total()); ?>">
            <?php _e('Rimborsa via', 'dreamshop-refunds'); ?> <?php echo esc_html($button_label); ?>
        </button>
        <?php
    }

    /**
     * Processa il rimborso via AJAX
     */
    public function ajax_process_refund() {
        check_ajax_referer('dreamshop-refund-nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Permessi insufficienti', 'dreamshop-refunds')));
        }

        $order_id = isset($_POST['order_id']) ? intval($_POST['order_id']) : 0;
        $payment_method = isset($_POST['payment_method']) ? sanitize_text_field($_POST['payment_method']) : '';
        $payment_gateway = isset($_POST['payment_gateway']) ? sanitize_text_field($_POST['payment_gateway']) : '';
        $amount = isset($_POST['amount']) ? floatval($_POST['amount']) : 0;
        $reason = isset($_POST['reason']) ? sanitize_text_field($_POST['reason']) : '';

        if (!$order_id || !$payment_method) {
            wp_send_json_error(array('message' => __('Dati mancanti', 'dreamshop-refunds')));
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            wp_send_json_error(array('message' => __('Ordine non trovato', 'dreamshop-refunds')));
        }

        // Se payment_gateway non è specificato, determinalo dal payment_method
        if (empty($payment_gateway)) {
            $payment_gateway = in_array($payment_method, array('stripe', 'klarna', 'satispay')) ? 'stripe' : 'paypal';
        }

        // Processa il rimborso in base al gateway di pagamento
        if ($payment_gateway === 'stripe') {
            $result = $this->process_stripe_refund($order, $amount, $reason, $payment_method);
        } elseif ($payment_gateway === 'paypal') {
            $result = $this->process_paypal_refund($order, $amount, $reason);
        } else {
            wp_send_json_error(array('message' => __('Gateway di pagamento non supportato', 'dreamshop-refunds')));
        }

        if ($result['success']) {
            wp_send_json_success($result);
        } else {
            wp_send_json_error($result);
        }
    }

    /**
     * Processa rimborso Stripe (include anche Klarna e Satispay)
     */
    private function process_stripe_refund($order, $amount, $reason, $payment_method = 'stripe') {
        $secret_key = get_option('dreamshop_stripe_secret_key');

        if (empty($secret_key)) {
            return array('success' => false, 'message' => __('Stripe Secret Key non configurata', 'dreamshop-refunds'));
        }

        // Prova a recuperare il Payment Intent ID da diversi meta_key
        $payment_intent_id = $order->get_meta('_stripe_payment_intent_id');
        if (empty($payment_intent_id)) {
            $payment_intent_id = $order->get_meta('_stripe_payment_intent');
        }

        if (empty($payment_intent_id)) {
            return array('success' => false, 'message' => __('Payment Intent ID non trovato nei meta dell\'ordine', 'dreamshop-refunds'));
        }

        // Determina il nome del metodo di pagamento per i log
        $payment_method_name = 'Stripe';
        if ($payment_method === 'klarna') {
            $payment_method_name = 'Klarna (Stripe)';
        } elseif ($payment_method === 'satispay') {
            $payment_method_name = 'Satispay (Stripe)';
        }

        // Determina l'importo del rimborso
        $order_total = floatval($order->get_total());
        $is_partial = $amount > 0 && $amount < $order_total;
        $refund_amount = $is_partial ? $amount : $order_total;

        // Converti in centesimi per Stripe
        $refund_amount_cents = intval($refund_amount * 100);

        // Effettua la richiesta a Stripe
        $response = wp_remote_post('https://api.stripe.com/v1/refunds', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $secret_key,
                'Content-Type' => 'application/x-www-form-urlencoded',
            ),
            'body' => array(
                'payment_intent' => $payment_intent_id,
                'amount' => $refund_amount_cents,
                'reason' => 'requested_by_customer',
                'metadata' => array(
                    'order_id' => $order->get_id(),
                    'reason' => $reason,
                )
            ),
            'timeout' => 30,
        ));

        if (is_wp_error($response)) {
            return array('success' => false, 'message' => $response->get_error_message());
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        // Log per debug
        error_log('Stripe Refund Response Code: ' . $code);
        error_log('Stripe Refund Response Body: ' . print_r($body, true));

        if (isset($body['error'])) {
            return array('success' => false, 'message' => $body['error']['message']);
        }

        // Stripe può restituire diversi stati: succeeded, pending, failed, canceled, requires_action
        // Per Klarna e altri metodi, il rimborso può essere 'pending' ma comunque valido
        if (isset($body['id']) && isset($body['status'])) {
            $valid_statuses = array('succeeded', 'pending');

            if (in_array($body['status'], $valid_statuses)) {
                // Crea il rimborso in WooCommerce
                $refund_id = wc_create_refund(array(
                    'order_id' => $order->get_id(),
                    'amount' => $refund_amount,
                    'reason' => $reason,
                    'refund_payment' => false, // Già rimborsato tramite Stripe
                ));

                if (is_wp_error($refund_id)) {
                    return array('success' => false, 'message' => $refund_id->get_error_message());
                }

                // Messaggio differente in base allo stato
                $status_message = '';
                if ($body['status'] === 'pending') {
                    $status_message = __(' (In elaborazione)', 'dreamshop-refunds');
                }

                // Aggiungi nota all'ordine
                $order->add_order_note(
                    sprintf(
                        __('Rimborso %s processato con successo%s. Importo: %s. ID Rimborso: %s. Stato: %s. Motivo: %s', 'dreamshop-refunds'),
                        $payment_method_name,
                        $status_message,
                        wc_price($refund_amount),
                        $body['id'],
                        $body['status'],
                        $reason
                    )
                );

                return array(
                    'success' => true,
                    'message' => sprintf(__('Rimborso %s completato con successo%s', 'dreamshop-refunds'), $payment_method_name, $status_message),
                    'refund_id' => $body['id'],
                    'status' => $body['status']
                );
            } elseif ($body['status'] === 'failed') {
                return array('success' => false, 'message' => __('Il rimborso Stripe è fallito', 'dreamshop-refunds'));
            } else {
                return array('success' => false, 'message' => sprintf(__('Stato rimborso non valido: %s', 'dreamshop-refunds'), $body['status']));
            }
        }

        return array('success' => false, 'message' => __('Risposta non valida da Stripe. Verifica nella dashboard Stripe se il rimborso è stato processato.', 'dreamshop-refunds'));
    }

    /**
     * Processa rimborso PayPal
     */
    private function process_paypal_refund($order, $amount, $reason) {
        $client_id = get_option('dreamshop_paypal_client_id');
        $client_secret = get_option('dreamshop_paypal_client_secret');
        $mode = get_option('dreamshop_paypal_mode', 'live');

        if (empty($client_id) || empty($client_secret)) {
            return array('success' => false, 'message' => __('Credenziali PayPal non configurate', 'dreamshop-refunds'));
        }

        $transaction_id = $order->get_meta('_paypal_transaction_id');
        if (empty($transaction_id)) {
            $transaction_id = $order->get_meta('_paypal_order_id');
        }

        if (empty($transaction_id)) {
            return array('success' => false, 'message' => __('Transaction ID PayPal non trovato', 'dreamshop-refunds'));
        }

        // Determina l'endpoint PayPal
        $api_url = $mode === 'sandbox'
            ? 'https://api-m.sandbox.paypal.com'
            : 'https://api-m.paypal.com';

        // Ottieni access token
        $token_response = wp_remote_post($api_url . '/v1/oauth2/token', array(
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($client_id . ':' . $client_secret),
                'Content-Type' => 'application/x-www-form-urlencoded',
            ),
            'body' => 'grant_type=client_credentials',
            'timeout' => 30,
        ));

        if (is_wp_error($token_response)) {
            return array('success' => false, 'message' => $token_response->get_error_message());
        }

        $token_body = json_decode(wp_remote_retrieve_body($token_response), true);

        if (!isset($token_body['access_token'])) {
            return array('success' => false, 'message' => __('Impossibile ottenere access token PayPal', 'dreamshop-refunds'));
        }

        $access_token = $token_body['access_token'];

        // Determina l'importo del rimborso
        $order_total = floatval($order->get_total());
        $is_partial = $amount > 0 && $amount < $order_total;
        $refund_amount = $is_partial ? $amount : $order_total;

        // Prepara il body del rimborso
        $refund_body = array(
            'note_to_payer' => $reason,
        );

        if ($is_partial) {
            $refund_body['amount'] = array(
                'value' => number_format($refund_amount, 2, '.', ''),
                'currency_code' => $order->get_currency(),
            );
        }

        // Effettua il rimborso
        $refund_response = wp_remote_post($api_url . '/v2/payments/captures/' . $transaction_id . '/refund', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $access_token,
                'Content-Type' => 'application/json',
            ),
            'body' => json_encode($refund_body),
            'timeout' => 30,
        ));

        if (is_wp_error($refund_response)) {
            return array('success' => false, 'message' => $refund_response->get_error_message());
        }

        $refund_result = json_decode(wp_remote_retrieve_body($refund_response), true);

        if (isset($refund_result['status']) && $refund_result['status'] === 'COMPLETED') {
            // Crea il rimborso in WooCommerce
            $refund_id = wc_create_refund(array(
                'order_id' => $order->get_id(),
                'amount' => $refund_amount,
                'reason' => $reason,
                'refund_payment' => false, // Già rimborsato tramite PayPal
            ));

            if (is_wp_error($refund_id)) {
                return array('success' => false, 'message' => $refund_id->get_error_message());
            }

            // Aggiungi nota all'ordine
            $order->add_order_note(
                sprintf(
                    __('Rimborso PayPal processato con successo. Importo: %s. ID Rimborso: %s. Motivo: %s', 'dreamshop-refunds'),
                    wc_price($refund_amount),
                    $refund_result['id'],
                    $reason
                )
            );

            return array(
                'success' => true,
                'message' => __('Rimborso PayPal completato con successo', 'dreamshop-refunds'),
                'refund_id' => $refund_result['id']
            );
        }

        $error_message = isset($refund_result['message']) ? $refund_result['message'] : __('Errore durante il rimborso PayPal', 'dreamshop-refunds');
        return array('success' => false, 'message' => $error_message);
    }

    /**
     * Enqueue scripts e styles per admin
     */
    public function enqueue_admin_scripts($hook) {
        // Solo nelle pagine ordini e impostazioni
        if ($hook !== 'woocommerce_page_wc-orders' &&
            $hook !== 'shop_order' &&
            $hook !== 'woocommerce_page_dreamshop-refunds-settings') {
            return;
        }

        wp_enqueue_style(
            'dreamshop-refunds-admin',
            DREAMSHOP_REFUNDS_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            DREAMSHOP_REFUNDS_VERSION
        );

        wp_enqueue_script(
            'dreamshop-refunds-admin',
            DREAMSHOP_REFUNDS_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery'),
            DREAMSHOP_REFUNDS_VERSION,
            true
        );

        wp_localize_script('dreamshop-refunds-admin', 'dreamshopRefunds', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('dreamshop-refund-nonce'),
            'strings' => array(
                'confirm_refund' => __('Sei sicuro di voler rimborsare questo ordine?', 'dreamshop-refunds'),
                'processing' => __('Elaborazione rimborso in corso...', 'dreamshop-refunds'),
                'success' => __('Rimborso completato con successo!', 'dreamshop-refunds'),
                'error' => __('Errore durante il rimborso', 'dreamshop-refunds'),
                'partial_refund' => __('Rimborso parziale', 'dreamshop-refunds'),
                'full_refund' => __('Rimborso totale', 'dreamshop-refunds'),
                'amount' => __('Importo', 'dreamshop-refunds'),
                'reason' => __('Motivo', 'dreamshop-refunds'),
                'cancel' => __('Annulla', 'dreamshop-refunds'),
                'refund' => __('Rimborsa', 'dreamshop-refunds'),
            )
        ));
    }

    /**
     * Test connessione Stripe via AJAX
     */
    public function ajax_test_stripe() {
        check_ajax_referer('dreamshop-refund-nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Permessi insufficienti', 'dreamshop-refunds')));
        }

        $secret_key = get_option('dreamshop_stripe_secret_key');

        if (empty($secret_key)) {
            wp_send_json_error(array('message' => __('Stripe Secret Key non configurata', 'dreamshop-refunds')));
        }

        // Test chiamata API Stripe per recuperare il balance
        $response = wp_remote_get('https://api.stripe.com/v1/balance', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $secret_key,
            ),
            'timeout' => 15,
        ));

        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code === 200 && isset($body['object']) && $body['object'] === 'balance') {
            wp_send_json_success(array('message' => __('Connessione Stripe riuscita!', 'dreamshop-refunds')));
        } else {
            $error_message = isset($body['error']['message']) ? $body['error']['message'] : __('Errore sconosciuto', 'dreamshop-refunds');
            wp_send_json_error(array('message' => $error_message));
        }
    }

    /**
     * Test connessione PayPal via AJAX
     */
    public function ajax_test_paypal() {
        check_ajax_referer('dreamshop-refund-nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Permessi insufficienti', 'dreamshop-refunds')));
        }

        $client_id = get_option('dreamshop_paypal_client_id');
        $client_secret = get_option('dreamshop_paypal_client_secret');
        $mode = get_option('dreamshop_paypal_mode', 'live');

        if (empty($client_id) || empty($client_secret)) {
            wp_send_json_error(array('message' => __('Credenziali PayPal non configurate', 'dreamshop-refunds')));
        }

        // Determina l'endpoint PayPal
        $api_url = $mode === 'sandbox'
            ? 'https://api-m.sandbox.paypal.com'
            : 'https://api-m.paypal.com';

        // Ottieni access token
        $response = wp_remote_post($api_url . '/v1/oauth2/token', array(
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($client_id . ':' . $client_secret),
                'Content-Type' => 'application/x-www-form-urlencoded',
            ),
            'body' => 'grant_type=client_credentials',
            'timeout' => 15,
        ));

        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code === 200 && isset($body['access_token'])) {
            wp_send_json_success(array('message' => __('Connessione PayPal riuscita!', 'dreamshop-refunds')));
        } else {
            $error_message = isset($body['error_description']) ? $body['error_description'] : __('Errore sconosciuto', 'dreamshop-refunds');
            wp_send_json_error(array('message' => $error_message));
        }
    }
}

// Inizializza il plugin
function dreamshop_payment_refunds() {
    return DreamShop_Payment_Refunds::get_instance();
}

// Avvia il plugin
dreamshop_payment_refunds();
