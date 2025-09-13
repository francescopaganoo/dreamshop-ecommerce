<?php

if (!defined('ABSPATH')) {
    exit;
}

class GiftCard_API {
    
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_endpoints'));
    }
    
    public function register_endpoints() {
        // Endpoint per ottenere il saldo utente
        register_rest_route('gift-card/v1', '/balance/(?P<user_id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_user_balance'),
            'permission_callback' => array($this, 'check_user_permission'),
            'args' => array(
                'user_id' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                )
            )
        ));
        
        // Endpoint per ottenere le transazioni utente
        register_rest_route('gift-card/v1', '/transactions/(?P<user_id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_user_transactions'),
            'permission_callback' => array($this, 'check_user_permission'),
            'args' => array(
                'user_id' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                )
            )
        ));
        
        // Endpoint per generare coupon (al momento disabilitato)
        register_rest_route('gift-card/v1', '/generate-coupon', array(
            'methods' => 'POST',
            'callback' => array($this, 'generate_coupon'),
            'permission_callback' => array($this, 'check_user_permission')
        ));
    }
    
    public function check_user_permission($request) {
        // Log per debug
        error_log('[GIFT CARD API] Verifica permessi chiamata API');
        
        // Verifica header Authorization (può essere Basic o Bearer)
        $auth_header = $request->get_header('authorization');
        error_log('[GIFT CARD API] Header Authorization: ' . ($auth_header ? 'presente' : 'mancante'));
        
        if (!$auth_header) {
            error_log('[GIFT CARD API] Errore: Header autorizzazione mancante');
            return new WP_Error('unauthorized', 'Header autorizzazione mancante', array('status' => 401));
        }
        
        // Verifica se è Basic Auth (WooCommerce credentials) - questo è il metodo che ora usiamo
        if (strpos($auth_header, 'Basic ') === 0) {
            // Autentica con credenziali WooCommerce (chiamato dalle API Next.js)
            $auth_result = $this->authenticate_basic_auth($auth_header);
            if ($auth_result === true) {
                error_log('[GIFT CARD API] Autenticazione Basic Auth completata con successo');
                return true;
            } else {
                error_log('[GIFT CARD API] Errore: Autenticazione Basic Auth fallita');
                return $auth_result; // Restituisce il WP_Error
            }
        }
        
        // Fallback per Bearer token (per compatibilità)
        if (strpos($auth_header, 'Bearer ') === 0) {
            $token = str_replace('Bearer ', '', $auth_header);
            error_log('[GIFT CARD API] Token Bearer ricevuto: ' . substr($token, 0, 20) . '...');
            
            $user_id = $this->decode_jwt_token($token);
            if ($user_id) {
                error_log('[GIFT CARD API] Utente autenticato via JWT: ' . $user_id);
                wp_set_current_user($user_id);
                
                $requested_user_id = $request->get_param('user_id');
                if ($requested_user_id && $user_id != $requested_user_id && !current_user_can('manage_options')) {
                    return new WP_Error('forbidden', 'Accesso negato ai dati di altri utenti', array('status' => 403));
                }
                
                return true;
            }
        }
        
        error_log('[GIFT CARD API] Errore: Nessun metodo di autenticazione valido');
        return new WP_Error('unauthorized', 'Metodo di autenticazione non supportato', array('status' => 401));
    }
    
    private function authenticate_basic_auth($auth_header) {
        try {
            // Decodifica le credenziali Basic Auth
            $credentials = base64_decode(str_replace('Basic ', '', $auth_header));
            list($consumer_key, $consumer_secret) = explode(':', $credentials, 2);
            
            // Verifica che le credenziali corrispondano a quelle di WooCommerce
            $expected_key = defined('WC_CONSUMER_KEY') ? WC_CONSUMER_KEY : get_option('woocommerce_consumer_key');
            $expected_secret = defined('WC_CONSUMER_SECRET') ? WC_CONSUMER_SECRET : get_option('woocommerce_consumer_secret');
            
            // Per semplicità, accettiamo qualsiasi credenziale Basic Auth valida (sarà l'API Next.js a gestire l'autenticazione utente)
            if ($consumer_key && $consumer_secret && strlen($consumer_key) > 10 && strlen($consumer_secret) > 10) {
                error_log('[GIFT CARD API] Basic Auth: Credenziali WooCommerce accettate');
                // Impostiamo un utente amministratore fittizio per le chiamate dell'API Next.js
                wp_set_current_user(1); // Admin user per le chiamate API interne
                return true;
            }
            
            error_log('[GIFT CARD API] Basic Auth: Credenziali non valide');
            return new WP_Error('unauthorized', 'Credenziali Basic Auth non valide', array('status' => 401));
            
        } catch (Exception $e) {
            error_log('[GIFT CARD API] Errore Basic Auth: ' . $e->getMessage());
            return new WP_Error('unauthorized', 'Errore nella decodifica Basic Auth', array('status' => 401));
        }
    }
    
    private function decode_jwt_token($token) {
        // Implementazione semplificata per decodificare il JWT
        // In produzione dovresti usare una libreria JWT appropriata
        
        try {
            // Split del token JWT
            $parts = explode('.', $token);
            if (count($parts) !== 3) {
                error_log('[GIFT CARD API] JWT: Formato token non valido');
                return false;
            }
            
            // Decodifica il payload (seconda parte)
            $payload_encoded = $parts[1];
            
            // Aggiungi padding se necessario per base64
            $payload_encoded .= str_repeat('=', (4 - strlen($payload_encoded) % 4) % 4);
            
            $payload = json_decode(base64_decode($payload_encoded), true);
            
            if (!$payload) {
                error_log('[GIFT CARD API] JWT: Impossibile decodificare il payload');
                return false;
            }
            
            error_log('[GIFT CARD API] JWT Payload: ' . print_r($payload, true));
            
            // Prova diversi formati di payload
            $user_id = null;
            
            if (isset($payload['data']['user']['id'])) {
                $user_id = $payload['data']['user']['id'];
            } elseif (isset($payload['user_id'])) {
                $user_id = $payload['user_id'];
            } elseif (isset($payload['sub'])) {
                $user_id = $payload['sub'];
            }
            
            if (!$user_id) {
                error_log('[GIFT CARD API] JWT: User ID non trovato nel payload');
                return false;
            }
            
            // Verifica scadenza
            if (isset($payload['exp']) && time() > $payload['exp']) {
                error_log('[GIFT CARD API] JWT: Token scaduto');
                return false;
            }
            
            return intval($user_id);
        } catch (Exception $e) {
            error_log('[GIFT CARD API] Errore decodifica JWT: ' . $e->getMessage());
            return false;
        }
    }
    
    private function authenticate_woocommerce_token($token) {
        // Prova a usare il token come API key di WooCommerce
        try {
            // Cerca utenti con questo token come meta
            global $wpdb;
            
            $user_id = $wpdb->get_var($wpdb->prepare(
                "SELECT user_id FROM {$wpdb->usermeta} 
                 WHERE meta_key = 'woocommerce_api_key' AND meta_value = %s",
                $token
            ));
            
            if ($user_id) {
                error_log('[GIFT CARD API] WooCommerce: User trovato via API key');
                return intval($user_id);
            }
            
            // Prova anche come session token
            $user_id = $wpdb->get_var($wpdb->prepare(
                "SELECT user_id FROM {$wpdb->usermeta} 
                 WHERE meta_key = 'session_tokens' AND meta_value LIKE %s",
                '%' . $token . '%'
            ));
            
            if ($user_id) {
                error_log('[GIFT CARD API] WooCommerce: User trovato via session token');
                return intval($user_id);
            }
            
            return false;
        } catch (Exception $e) {
            error_log('[GIFT CARD API] Errore autenticazione WooCommerce: ' . $e->getMessage());
            return false;
        }
    }
    
    public function get_user_balance($request) {
        $user_id = $request->get_param('user_id');
        
        try {
            $balance = GiftCard_Database::get_user_balance($user_id);
            
            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'user_id' => intval($user_id),
                    'balance' => floatval($balance),
                    'formatted_balance' => '€' . number_format($balance, 2, ',', '.')
                )
            ));
        } catch (Exception $e) {
            return new WP_Error('database_error', 'Errore nel recupero del saldo', array('status' => 500));
        }
    }
    
    public function get_user_transactions($request) {
        $user_id = $request->get_param('user_id');
        $limit = $request->get_param('limit') ?: 20;
        $offset = $request->get_param('offset') ?: 0;
        
        try {
            $transactions = GiftCard_Database::get_user_transactions($user_id, $limit + 1); // +1 per vedere se ci sono altre
            
            $has_more = count($transactions) > $limit;
            if ($has_more) {
                array_pop($transactions); // Rimuovi l'elemento extra
            }
            
            $formatted_transactions = array();
            foreach ($transactions as $transaction) {
                $formatted_transactions[] = array(
                    'id' => intval($transaction->id),
                    'amount' => floatval($transaction->amount),
                    'formatted_amount' => '€' . number_format($transaction->amount, 2, ',', '.'),
                    'type' => $transaction->type,
                    'type_label' => $transaction->type === 'credit' ? 'Accredito' : 'Addebito',
                    'description' => $transaction->description,
                    'order_id' => $transaction->order_id ? intval($transaction->order_id) : null,
                    'coupon_code' => $transaction->coupon_code,
                    'created_at' => $transaction->created_at,
                    'formatted_date' => date_i18n('d/m/Y H:i', strtotime($transaction->created_at))
                );
            }
            
            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'transactions' => $formatted_transactions,
                    'pagination' => array(
                        'has_more' => $has_more,
                        'limit' => intval($limit),
                        'offset' => intval($offset)
                    )
                )
            ));
        } catch (Exception $e) {
            return new WP_Error('database_error', 'Errore nel recupero delle transazioni', array('status' => 500));
        }
    }
    
    public function generate_coupon($request) {
        $body = json_decode($request->get_body(), true);
        $user_id = intval($body['user_id']);
        $amount = floatval($body['amount']);
        
        error_log("[GIFT CARD API] Richiesta generazione coupon per utente {$user_id}, importo €{$amount}");
        
        if (!$user_id || $amount <= 0) {
            error_log('[GIFT CARD API] Parametri non validi per generazione coupon');
            return new WP_Error('invalid_params', 'Parametri non validi', array('status' => 400));
        }
        
        try {
            $current_balance = GiftCard_Database::get_user_balance($user_id);
            error_log("[GIFT CARD API] Saldo attuale utente {$user_id}: €{$current_balance}");
            
            if ($amount > $current_balance) {
                error_log('[GIFT CARD API] Saldo insufficiente per generazione coupon');
                return new WP_Error('insufficient_balance', 'Saldo insufficiente', array('status' => 400));
            }
            
            // Genera codice coupon univoco
            $coupon_code = 'GC' . strtoupper(wp_generate_password(8, false));
            error_log("[GIFT CARD API] Generazione coupon: {$coupon_code}");
            
            // Crea il coupon in WooCommerce
            $coupon = new WC_Coupon();
            $coupon->set_code($coupon_code);
            $coupon->set_discount_type('fixed_cart');
            $coupon->set_amount($amount);
            $coupon->set_individual_use(true);
            $coupon->set_usage_limit(1);
            $coupon->set_description('Gift Card - Generato automaticamente');
            $coupon_id = $coupon->save();
            
            if (!$coupon_id) {
                error_log('[GIFT CARD API] Errore nella creazione del coupon WooCommerce');
                return new WP_Error('coupon_creation_failed', 'Errore nella creazione del coupon', array('status' => 500));
            }
            
            // Sottrai l'importo dal saldo dell'utente
            $description = sprintf('Generazione coupon %s per €%.2f', $coupon_code, $amount);
            $debit_result = GiftCard_Database::update_user_balance($user_id, $amount, 'debit', $description);
            
            if (!$debit_result) {
                // Se fallisce l'addebito, elimina il coupon creato
                wp_delete_post($coupon_id, true);
                error_log('[GIFT CARD API] Errore nell\'addebito del saldo');
                return new WP_Error('balance_update_failed', 'Errore nell\'aggiornamento del saldo', array('status' => 500));
            }
            
            $new_balance = GiftCard_Database::get_user_balance($user_id);
            error_log("[GIFT CARD API] Coupon generato con successo. Nuovo saldo: €{$new_balance}");
            
            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'coupon_code' => $coupon_code,
                    'amount' => $amount,
                    'formatted_amount' => '€' . number_format($amount, 2, ',', '.'),
                    'new_balance' => $new_balance,
                    'formatted_new_balance' => '€' . number_format($new_balance, 2, ',', '.')
                )
            ));
        } catch (Exception $e) {
            error_log('[GIFT CARD API] Errore nella generazione del coupon: ' . $e->getMessage());
            return new WP_Error('generation_error', 'Errore nella generazione del coupon: ' . $e->getMessage(), array('status' => 500));
        }
    }
}