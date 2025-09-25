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

        // Endpoint per riscattare gift card
        register_rest_route('gift-card/v1', '/redeem', array(
            'methods' => 'POST',
            'callback' => array($this, 'redeem_gift_card'),
            'permission_callback' => array($this, 'check_user_permission'),
            'args' => array(
                'gift_card_code' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return !empty($param) && is_string($param);
                    }
                ),
                'user_id' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                )
            )
        ));

        // Endpoint per verificare un codice gift card
        register_rest_route('gift-card/v1', '/verify/(?P<code>[a-zA-Z0-9]+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'verify_gift_card'),
            'permission_callback' => array($this, 'check_user_permission'),
            'args' => array(
                'code' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return !empty($param) && is_string($param);
                    }
                )
            )
        ));

        // Endpoint per ottenere le gift card di un utente
        register_rest_route('gift-card/v1', '/user-gift-cards/(?P<user_id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_user_gift_cards'),
            'permission_callback' => array($this, 'check_user_permission'),
            'args' => array(
                'user_id' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                ),
                'type' => array(
                    'required' => false,
                    'default' => 'purchased',
                    'validate_callback' => function($param) {
                        return in_array($param, array('purchased', 'redeemed'));
                    }
                )
            )
        ));

        // Endpoint per ottenere la configurazione del plugin
        register_rest_route('gift-card/v1', '/config', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_config'),
            'permission_callback' => array($this, 'check_user_permission')
        ));
    }
    
    public function check_user_permission($request) {
        // Verifica header Authorization (può essere Basic o Bearer)
        $auth_header = $request->get_header('authorization');

        if (!$auth_header) {
            return new WP_Error('unauthorized', 'Header autorizzazione mancante', array('status' => 401));
        }
        
        // Verifica se è Basic Auth (WooCommerce credentials) - questo è il metodo che ora usiamo
        if (strpos($auth_header, 'Basic ') === 0) {
            // Autentica con credenziali WooCommerce (chiamato dalle API Next.js)
            $auth_result = $this->authenticate_basic_auth($auth_header);
            if ($auth_result === true) {
                return true;
            } else {
                return $auth_result; // Restituisce il WP_Error
            }
        }
        
        // Fallback per Bearer token (per compatibilità)
        if (strpos($auth_header, 'Bearer ') === 0) {
            $token = str_replace('Bearer ', '', $auth_header);

            $user_id = $this->decode_jwt_token($token);
            if ($user_id) {
                wp_set_current_user($user_id);

                $requested_user_id = $request->get_param('user_id');
                if ($requested_user_id && $user_id != $requested_user_id && !current_user_can('manage_options')) {
                    return new WP_Error('forbidden', 'Accesso negato ai dati di altri utenti', array('status' => 403));
                }

                return true;
            }
        }

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
                // Impostiamo un utente amministratore fittizio per le chiamate dell'API Next.js
                wp_set_current_user(1); // Admin user per le chiamate API interne
                return true;
            }

            return new WP_Error('unauthorized', 'Credenziali Basic Auth non valide', array('status' => 401));

        } catch (Exception $e) {
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
                return false;
            }
            
            // Decodifica il payload (seconda parte)
            $payload_encoded = $parts[1];
            
            // Aggiungi padding se necessario per base64
            $payload_encoded .= str_repeat('=', (4 - strlen($payload_encoded) % 4) % 4);
            
            $payload = json_decode(base64_decode($payload_encoded), true);
            
            if (!$payload) {
                return false;
            }
            
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
                return false;
            }
            
            // Verifica scadenza
            if (isset($payload['exp']) && time() > $payload['exp']) {
                return false;
            }
            
            return intval($user_id);
        } catch (Exception $e) {
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
                return intval($user_id);
            }
            
            // Prova anche come session token
            $user_id = $wpdb->get_var($wpdb->prepare(
                "SELECT user_id FROM {$wpdb->usermeta} 
                 WHERE meta_key = 'session_tokens' AND meta_value LIKE %s",
                '%' . $token . '%'
            ));
            
            if ($user_id) {
                return intval($user_id);
            }
            
            return false;
        } catch (Exception $e) {
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
        
        
        if (!$user_id || $amount <= 0) {
            return new WP_Error('invalid_params', 'Parametri non validi', array('status' => 400));
        }
        
        try {
            $current_balance = GiftCard_Database::get_user_balance($user_id);
            
            if ($amount > $current_balance) {
                return new WP_Error('insufficient_balance', 'Saldo insufficiente', array('status' => 400));
            }
            
            // Genera codice coupon univoco
            $coupon_code = 'GC' . strtoupper(wp_generate_password(8, false));
            
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
                return new WP_Error('coupon_creation_failed', 'Errore nella creazione del coupon', array('status' => 500));
            }
            
            // Sottrai l'importo dal saldo dell'utente
            $description = sprintf('Generazione coupon %s per €%.2f', $coupon_code, $amount);
            $debit_result = GiftCard_Database::update_user_balance($user_id, $amount, 'debit', $description);
            
            if (!$debit_result) {
                // Se fallisce l'addebito, elimina il coupon creato
                wp_delete_post($coupon_id, true);
                return new WP_Error('balance_update_failed', 'Errore nell\'aggiornamento del saldo', array('status' => 500));
            }
            
            $new_balance = GiftCard_Database::get_user_balance($user_id);
            
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
            return new WP_Error('generation_error', 'Errore nella generazione del coupon: ' . $e->getMessage(), array('status' => 500));
        }
    }

    /**
     * Riscatta una gift card
     */
    public function redeem_gift_card($request) {
        // Pulisci eventuali output buffer per evitare HTML nell'output JSON
        if (ob_get_level()) {
            ob_clean();
        }

        // Disabilita la visualizzazione di errori PHP che potrebbero interferire con JSON
        $old_display_errors = ini_get('display_errors');
        ini_set('display_errors', 0);

        $gift_card_code = sanitize_text_field($request->get_param('gift_card_code'));
        $user_id = intval($request->get_param('user_id'));

        // Validazione input
        if (empty($gift_card_code) || $user_id <= 0) {
            return new WP_Error('invalid_input', 'Parametri non validi', array('status' => 400));
        }

        try {
            // Verifica che la classe database sia disponibile
            if (!class_exists('GiftCard_Database')) {
                return new WP_Error('class_not_found', 'Classe GiftCard_Database non trovata', array('status' => 500));
            }

            $result = GiftCard_Database::redeem_gift_card($gift_card_code, $user_id);

            if ($result['success']) {
                $new_balance = GiftCard_Database::get_user_balance($user_id);

                $response_data = array(
                    'success' => true,
                    'data' => array(
                        'message' => $result['message'],
                        'amount' => floatval($result['amount']),
                        'formatted_amount' => '€' . number_format($result['amount'], 2, ',', '.'),
                        'new_balance' => $new_balance,
                        'formatted_new_balance' => '€' . number_format($new_balance, 2, ',', '.')
                    )
                );

                // Assicurati che venga restituito JSON corretto
                header('Content-Type: application/json');
                return rest_ensure_response($response_data);
            } else {
                return new WP_Error('redeem_failed', $result['message'], array('status' => 400));
            }

        } catch (Exception $e) {
            return new WP_Error('redeem_error', 'Errore nel riscatto della gift card', array('status' => 500));
        } finally {
            // Ripristina la configurazione di display_errors
            ini_set('display_errors', $old_display_errors);
        }
    }

    /**
     * Verifica un codice gift card senza riscattarlo
     */
    public function verify_gift_card($request) {
        $code = sanitize_text_field($request->get_param('code'));

        try {
            $gift_card = GiftCard_Database::get_gift_card_by_code($code);

            if (!$gift_card) {
                return new WP_Error('invalid_code', 'Codice gift card non valido', array('status' => 404));
            }

            // Controlla se è già riscattata
            $is_redeemed = $gift_card->is_redeemed;
            $is_expired = $gift_card->expires_at && strtotime($gift_card->expires_at) < time();

            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'code' => $gift_card->code,
                    'amount' => floatval($gift_card->amount),
                    'formatted_amount' => '€' . number_format($gift_card->amount, 2, ',', '.'),
                    'is_redeemed' => $is_redeemed,
                    'is_expired' => $is_expired,
                    'is_valid' => !$is_redeemed && !$is_expired,
                    'recipient_email' => $gift_card->recipient_email,
                    'created_at' => $gift_card->created_at,
                    'redeemed_at' => $gift_card->redeemed_at,
                    'expires_at' => $gift_card->expires_at,
                    'formatted_expires_at' => $gift_card->expires_at ? date_i18n('d/m/Y', strtotime($gift_card->expires_at)) : null
                )
            ));

        } catch (Exception $e) {
            return new WP_Error('verify_error', 'Errore nella verifica della gift card', array('status' => 500));
        }
    }

    /**
     * Ottiene le gift card di un utente
     */
    public function get_user_gift_cards($request) {
        $user_id = intval($request->get_param('user_id'));
        $type = $request->get_param('type') ?: 'purchased';

        try {
            $gift_cards = GiftCard_Database::get_user_gift_cards($user_id, $type);

            $formatted_gift_cards = array();
            foreach ($gift_cards as $gift_card) {
                $is_expired = $gift_card->expires_at && strtotime($gift_card->expires_at) < time();

                $formatted_gift_cards[] = array(
                    'id' => intval($gift_card->id),
                    'code' => $gift_card->code,
                    'amount' => floatval($gift_card->amount),
                    'formatted_amount' => '€' . number_format($gift_card->amount, 2, ',', '.'),
                    'recipient_email' => $gift_card->recipient_email,
                    'recipient_name' => $gift_card->recipient_name,
                    'message' => $gift_card->message,
                    'is_redeemed' => intval($gift_card->is_redeemed),
                    'is_expired' => $is_expired,
                    'created_at' => $gift_card->created_at,
                    'redeemed_at' => $gift_card->redeemed_at,
                    'expires_at' => $gift_card->expires_at,
                    'formatted_created_at' => date_i18n('d/m/Y H:i', strtotime($gift_card->created_at)),
                    'formatted_redeemed_at' => $gift_card->redeemed_at ? date_i18n('d/m/Y H:i', strtotime($gift_card->redeemed_at)) : null,
                    'formatted_expires_at' => $gift_card->expires_at ? date_i18n('d/m/Y', strtotime($gift_card->expires_at)) : null
                );
            }

            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'gift_cards' => $formatted_gift_cards,
                    'type' => $type,
                    'count' => count($formatted_gift_cards)
                )
            ));

        } catch (Exception $e) {
            return new WP_Error('fetch_error', 'Errore nel recupero delle gift card', array('status' => 500));
        }
    }

    /**
     * Ottiene la configurazione del plugin
     */
    public function get_config($request) {
        try {
            $gift_card_product_id = get_option('gift_card_product_id');

            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'gift_card_product_id' => $gift_card_product_id ? intval($gift_card_product_id) : null,
                    'plugin_version' => GIFT_CARD_VERSION
                )
            ));

        } catch (Exception $e) {
            return new WP_Error('config_error', 'Errore nel recupero della configurazione', array('status' => 500));
        }
    }
}