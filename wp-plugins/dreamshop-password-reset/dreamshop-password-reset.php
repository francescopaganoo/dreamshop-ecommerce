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
        $site_url = home_url();

        $subject = sprintf('[%s] Reset della password', $site_name);

        $message = $this->get_password_reset_email_template($user_name, $reset_url, $site_url, $site_name);

        $headers = array('Content-Type: text/html; charset=UTF-8');

        wp_mail($user_email, $subject, $message, $headers);
    }

    /**
     * Template HTML moderno per il reset password
     */
    private function get_password_reset_email_template($user_name, $reset_url, $site_url, $shop_name) {
        $html = '
        <div style="max-width: 600px; margin: 0 auto; font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #a2180e 0%, #8b1508 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🔐 RESET PASSWORD</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Reimposta la tua password</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px; background-color: #ffffff;">
                <h2 style="color: #333333; font-size: 24px; margin: 0 0 20px 0; text-align: center;">
                    Ciao ' . esc_html($user_name) . '! 👋
                </h2>

                <div style="background-color: #f8f9fa; padding: 25px; border-radius: 10px; border-left: 4px solid #a2180e; margin: 20px 0;">
                    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                        Hai richiesto di <strong style="color: #a2180e;">reimpostare la password</strong> per il tuo account su ' . esc_html($shop_name) . '.
                    </p>
                </div>

                <!-- Reset Button Section -->
                <div style="text-align: center; margin: 30px 0;">
                    <a href="' . esc_url($reset_url) . '" style="background: linear-gradient(135deg, #a2180e 0%, #8b1508 100%); color: white; padding: 15px 30px; border-radius: 25px; text-decoration: none; font-size: 18px; font-weight: bold; display: inline-block; box-shadow: 0 4px 15px rgba(162, 24, 14, 0.3);">
                        🔑 Reimposta Password
                    </a>
                </div>

                <!-- Instructions -->
                <div style="background-color: #f8f9fa; border-radius: 10px; padding: 25px; margin: 30px 0;">
                    <h4 style="margin: 0 0 15px 0; color: #a2180e; font-size: 18px; text-align: center;">
                        📋 Istruzioni
                    </h4>
                    <ol style="margin: 0; padding-left: 20px; color: #333333; line-height: 1.8;">
                        <li>Clicca sul pulsante "Reimposta Password" qui sopra</li>
                        <li>Verrai reindirizzato alla pagina di reset</li>
                        <li>Inserisci la tua nuova password</li>
                        <li>Conferma la nuova password</li>
                        <li>Salva le modifiche</li>
                    </ol>
                </div>

                <!-- Security Notice -->
                <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 1px solid #ffc107; padding: 20px; border-radius: 8px; margin: 25px 0;">
                    <p style="margin: 0 0 10px 0; color: #856404; font-size: 16px; font-weight: bold; text-align: center;">
                        ⏰ Link di Reset Valido per 24 ore
                    </p>
                    <p style="margin: 0; color: #856404; font-size: 14px; text-align: center;">
                        Se non hai richiesto tu questa operazione, ignora questa email
                    </p>
                </div>

                <!-- Link Alternative -->
                <div style="background-color: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666; text-align: center;">
                        Se il pulsante non funziona, copia e incolla questo link nel tuo browser:
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #a2180e; word-break: break-all; text-align: center;">
                        ' . esc_url($reset_url) . '
                    </p>
                </div>

                <!-- Footer Message -->
                <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e9ecef; margin-top: 30px;">
                    <p style="margin: 0 0 10px 0; color: #666666; font-size: 18px; font-weight: bold;">
                        Buon shopping! 🛒
                    </p>
                    <p style="margin: 0; color: #a2180e; font-size: 18px; font-weight: bold;">
                        Il team di ' . esc_html($shop_name) . '
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-radius: 0 0 10px 10px; border-top: 1px solid #e9ecef;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                    Visita il nostro store: <a href="' . esc_url($site_url) . '" style="color: #a2180e; text-decoration: none; font-weight: bold;">' . esc_html($shop_name) . '</a>
                </p>
                <p style="margin: 0; font-size: 12px; color: #999999;">
                    Conserva questa email per riferimenti futuri
                </p>
            </div>
        </div>
        ';

        return $html;
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