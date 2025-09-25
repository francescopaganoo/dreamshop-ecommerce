<?php
/**
 * Plugin Name: Dreamshop Password Reset
 * Description: Custom password reset functionality for Dreamshop ecommerce with frontend integration
 * Version: 1.0.0
 * Author: Plan Studios Group | FP
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class DreamshopPasswordReset {

    public function __construct() {
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        add_filter('wp_mail_from', array($this, 'custom_wp_mail_from'));
        add_filter('wp_mail_from_name', array($this, 'custom_wp_mail_from_name'));
    }

    public function register_rest_routes() {
        // Endpoint per richiedere il reset password
        register_rest_route('custom/v1', '/password-reset', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_password_reset_request'),
            'permission_callback' => '__return_true'
        ));

        // Endpoint per verificare il token
        register_rest_route('custom/v1', '/verify-reset-token', array(
            'methods' => 'POST',
            'callback' => array($this, 'verify_reset_token'),
            'permission_callback' => '__return_true'
        ));

        // Endpoint per completare il reset password
        register_rest_route('custom/v1', '/reset-password', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_password_reset'),
            'permission_callback' => '__return_true'
        ));
    }

    /**
     * Gestisce la richiesta di reset password
     */
    public function handle_password_reset_request($request) {
        $email = sanitize_email($request->get_param('email'));
        $frontend_url = esc_url_raw($request->get_param('frontend_url'));

        if (empty($email)) {
            return new WP_Error('missing_email', 'Email is required', array('status' => 400));
        }

        if (empty($frontend_url)) {
            return new WP_Error('missing_frontend_url', 'Frontend URL is required', array('status' => 400));
        }

        // Verifica se l'utente esiste
        $user = get_user_by('email', $email);
        if (!$user) {
            // Non rivelare se l'email esiste o meno per motivi di sicurezza
            return new WP_REST_Response(array('success' => true), 200);
        }

        // Genera un token sicuro
        $token = wp_generate_password(32, false);
        $expiry = time() + (60 * 60 * 24); // 24 ore

        // Salva il token nel database
        update_user_meta($user->ID, 'password_reset_token', $token);
        update_user_meta($user->ID, 'password_reset_expiry', $expiry);

        // Crea il link di reset che punta al frontend
        $reset_url = rtrim($frontend_url, '/') . '/password-reset/' . $token;

        // Invia l'email
        $this->send_password_reset_email($user, $reset_url);

        return new WP_REST_Response(array('success' => true), 200);
    }

    /**
     * Verifica se il token è valido
     */
    public function verify_reset_token($request) {
        $token = sanitize_text_field($request->get_param('token'));

        if (empty($token)) {
            return new WP_Error('missing_token', 'Token is required', array('status' => 400));
        }

        $user = $this->get_user_by_reset_token($token);

        if (!$user) {
            return new WP_Error('invalid_token', 'Invalid or expired token', array('status' => 400));
        }

        return new WP_REST_Response(array('valid' => true), 200);
    }

    /**
     * Completa il reset della password
     */
    public function handle_password_reset($request) {
        $token = sanitize_text_field($request->get_param('token'));
        $password = $request->get_param('password');

        if (empty($token) || empty($password)) {
            return new WP_Error('missing_params', 'Token and password are required', array('status' => 400));
        }

        if (strlen($password) < 6) {
            return new WP_Error('weak_password', 'Password must be at least 6 characters long', array('status' => 400));
        }

        $user = $this->get_user_by_reset_token($token);

        if (!$user) {
            return new WP_Error('invalid_token', 'Invalid or expired token', array('status' => 400));
        }

        // Aggiorna la password
        wp_set_password($password, $user->ID);

        // Pulisci tutte le sessioni utente esistenti per forzare un nuovo login
        $sessions = WP_Session_Tokens::get_instance($user->ID);
        $sessions->destroy_all();

        // Rimuovi il token utilizzato
        delete_user_meta($user->ID, 'password_reset_token');
        delete_user_meta($user->ID, 'password_reset_expiry');

        // Rimuovi eventuali meta dati di cache che potrebbero causare problemi
        delete_user_meta($user->ID, 'session_tokens');

        return new WP_REST_Response(array('success' => true), 200);
    }

    /**
     * Trova un utente tramite il token di reset
     */
    private function get_user_by_reset_token($token) {
        $users = get_users(array(
            'meta_key' => 'password_reset_token',
            'meta_value' => $token,
            'number' => 1
        ));

        if (empty($users)) {
            return false;
        }

        $user = $users[0];

        // Verifica se il token è scaduto
        $expiry = get_user_meta($user->ID, 'password_reset_expiry', true);
        if ($expiry < time()) {
            // Token scaduto, rimuovilo
            delete_user_meta($user->ID, 'password_reset_token');
            delete_user_meta($user->ID, 'password_reset_expiry');
            return false;
        }

        return $user;
    }

    /**
     * Invia l'email di reset password
     */
    private function send_password_reset_email($user, $reset_url) {
        $site_name = get_bloginfo('name');
        $user_email = $user->user_email;
        $user_name = $user->display_name;

        $subject = sprintf('[%s] Reset della password', $site_name);

        $message = "Ciao {$user_name},\n\n";
        $message .= "Hai richiesto di reimpostare la password per il tuo account su {$site_name}.\n\n";
        $message .= "Clicca sul seguente link per reimpostare la tua password:\n";
        $message .= "{$reset_url}\n\n";
        $message .= "Questo link è valido per 24 ore.\n\n";
        $message .= "Se non hai richiesto tu questa operazione, ignora questa email.\n\n";
        $message .= "Cordiali saluti,\n";
        $message .= "Il team di {$site_name}";

        $headers = array('Content-Type: text/plain; charset=UTF-8');

        wp_mail($user_email, $subject, $message, $headers);
    }

    /**
     * Personalizza l'indirizzo email del mittente
     */
    public function custom_wp_mail_from($original_email_address) {
        // Usa l'email dell'admin del sito o un'email personalizzata
        $admin_email = get_option('admin_email');
        return $admin_email ? $admin_email : $original_email_address;
    }

    /**
     * Personalizza il nome del mittente
     */
    public function custom_wp_mail_from_name($original_email_from) {
        // Usa il nome del sito invece di "WordPress"
        $site_name = get_bloginfo('name');
        return $site_name ? $site_name : $original_email_from;
    }
}

// Inizializza il plugin
new DreamshopPasswordReset();