<?php

if (!defined('ABSPATH')) {
    exit;
}

class GiftCard_API {
    
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
    }
    
    public function register_routes() {
        register_rest_route('gift-card/v1', '/balance/(?P<user_id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_user_balance'),
            'permission_callback' => array($this, 'check_user_permission'),
            'args' => array(
                'user_id' => array(
                    'required' => true,
                    'validate_callback' => function($param, $request, $key) {
                        return is_numeric($param);
                    }
                )
            )
        ));
        
        register_rest_route('gift-card/v1', '/transactions/(?P<user_id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_user_transactions'),
            'permission_callback' => array($this, 'check_user_permission'),
            'args' => array(
                'user_id' => array(
                    'required' => true,
                    'validate_callback' => function($param, $request, $key) {
                        return is_numeric($param);
                    }
                ),
                'limit' => array(
                    'default' => 50,
                    'sanitize_callback' => 'absint'
                ),
                'offset' => array(
                    'default' => 0,
                    'sanitize_callback' => 'absint'
                )
            )
        ));
        
        register_rest_route('gift-card/v1', '/generate-coupon', array(
            'methods' => 'POST',
            'callback' => array($this, 'generate_coupon'),
            'permission_callback' => array($this, 'check_authenticated'),
            'args' => array(
                'user_id' => array(
                    'required' => true,
                    'validate_callback' => function($param, $request, $key) {
                        return is_numeric($param);
                    }
                ),
                'amount' => array(
                    'required' => true,
                    'validate_callback' => function($param, $request, $key) {
                        return is_numeric($param) && $param > 0;
                    }
                )
            )
        ));
        
        register_rest_route('gift-card/v1', '/coupon/(?P<coupon_code>[a-zA-Z0-9]+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_coupon_info'),
            'permission_callback' => '__return_true',
            'args' => array(
                'coupon_code' => array(
                    'required' => true,
                    'sanitize_callback' => 'sanitize_text_field'
                )
            )
        ));
        
        register_rest_route('gift-card/v1', '/validate-coupon', array(
            'methods' => 'POST',
            'callback' => array($this, 'validate_coupon'),
            'permission_callback' => '__return_true',
            'args' => array(
                'coupon_code' => array(
                    'required' => true,
                    'sanitize_callback' => 'sanitize_text_field'
                ),
                'cart_total' => array(
                    'required' => true,
                    'validate_callback' => function($param, $request, $key) {
                        return is_numeric($param) && $param >= 0;
                    }
                )
            )
        ));
    }
    
    public function check_user_permission($request) {
        $user_id = $request->get_param('user_id');
        $current_user = wp_get_current_user();
        
        if (!is_user_logged_in()) {
            return new WP_Error('not_logged_in', 'Utente non autenticato', array('status' => 401));
        }
        
        if ($current_user->ID != $user_id && !current_user_can('manage_options')) {
            return new WP_Error('forbidden', 'Non autorizzato ad accedere a questi dati', array('status' => 403));
        }
        
        return true;
    }
    
    public function check_authenticated($request) {
        if (!is_user_logged_in()) {
            return new WP_Error('not_logged_in', 'Utente non autenticato', array('status' => 401));
        }
        
        return true;
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
                    'formatted_balance' => number_format($balance, 2, ',', '.') . ' €'
                )
            ));
            
        } catch (Exception $e) {
            return new WP_Error('database_error', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function get_user_transactions($request) {
        $user_id = $request->get_param('user_id');
        $limit = $request->get_param('limit');
        $offset = $request->get_param('offset');
        
        try {
            $transactions = GiftCard_Database::get_user_transactions($user_id, $limit, $offset);
            
            $formatted_transactions = array_map(function($transaction) {
                return array(
                    'id' => intval($transaction->id),
                    'amount' => floatval($transaction->amount),
                    'formatted_amount' => number_format($transaction->amount, 2, ',', '.') . ' €',
                    'type' => $transaction->type,
                    'type_label' => $transaction->type === 'credit' ? 'Accredito' : 'Addebito',
                    'description' => $transaction->description,
                    'order_id' => $transaction->order_id ? intval($transaction->order_id) : null,
                    'coupon_code' => $transaction->coupon_code,
                    'created_at' => $transaction->created_at,
                    'formatted_date' => date_i18n('d/m/Y H:i', strtotime($transaction->created_at))
                );
            }, $transactions);
            
            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'transactions' => $formatted_transactions,
                    'pagination' => array(
                        'limit' => $limit,
                        'offset' => $offset,
                        'has_more' => count($transactions) === $limit
                    )
                )
            ));
            
        } catch (Exception $e) {
            return new WP_Error('database_error', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function generate_coupon($request) {
        $user_id = $request->get_param('user_id');
        $amount = floatval($request->get_param('amount'));
        $current_user = wp_get_current_user();
        
        if ($current_user->ID != $user_id && !current_user_can('manage_options')) {
            return new WP_Error('forbidden', 'Non autorizzato a generare coupon per questo utente', array('status' => 403));
        }
        
        if ($amount <= 0) {
            return new WP_Error('invalid_amount', 'L\'importo deve essere maggiore di zero', array('status' => 400));
        }
        
        $balance = GiftCard_Database::get_user_balance($user_id);
        if ($balance < $amount) {
            return new WP_Error('insufficient_balance', 'Saldo insufficiente', array('status' => 400));
        }
        
        try {
            $coupon_code = GiftCard_Database::create_coupon($user_id, $amount);
            
            if (!$coupon_code) {
                return new WP_Error('coupon_creation_failed', 'Errore nella generazione del coupon', array('status' => 500));
            }
            
            $new_balance = GiftCard_Database::get_user_balance($user_id);
            
            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'coupon_code' => $coupon_code,
                    'amount' => $amount,
                    'formatted_amount' => number_format($amount, 2, ',', '.') . ' €',
                    'new_balance' => $new_balance,
                    'formatted_new_balance' => number_format($new_balance, 2, ',', '.') . ' €'
                ),
                'message' => 'Coupon generato con successo'
            ));
            
        } catch (Exception $e) {
            return new WP_Error('database_error', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function get_coupon_info($request) {
        $coupon_code = $request->get_param('coupon_code');
        
        try {
            $coupon = GiftCard_Database::get_coupon_info($coupon_code);
            
            if (!$coupon) {
                return new WP_Error('coupon_not_found', 'Coupon non trovato', array('status' => 404));
            }
            
            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'id' => intval($coupon->id),
                    'user_id' => intval($coupon->user_id),
                    'coupon_code' => $coupon->coupon_code,
                    'amount' => floatval($coupon->amount),
                    'formatted_amount' => number_format($coupon->amount, 2, ',', '.') . ' €',
                    'status' => $coupon->status,
                    'expires_at' => $coupon->expires_at,
                    'created_at' => $coupon->created_at,
                    'used_at' => $coupon->used_at
                )
            ));
            
        } catch (Exception $e) {
            return new WP_Error('database_error', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function validate_coupon($request) {
        $coupon_code = $request->get_param('coupon_code');
        $cart_total = floatval($request->get_param('cart_total'));
        
        try {
            $coupon = GiftCard_Database::get_coupon_info($coupon_code);
            
            if (!$coupon) {
                return rest_ensure_response(array(
                    'success' => false,
                    'valid' => false,
                    'message' => 'Codice coupon non valido'
                ));
            }
            
            if ($coupon->status !== 'active') {
                return rest_ensure_response(array(
                    'success' => false,
                    'valid' => false,
                    'message' => 'Coupon già utilizzato o scaduto'
                ));
            }
            
            if ($coupon->expires_at && strtotime($coupon->expires_at) < current_time('timestamp')) {
                return rest_ensure_response(array(
                    'success' => false,
                    'valid' => false,
                    'message' => 'Coupon scaduto'
                ));
            }
            
            $discount_amount = min(floatval($coupon->amount), $cart_total);
            
            return rest_ensure_response(array(
                'success' => true,
                'valid' => true,
                'data' => array(
                    'coupon_code' => $coupon->coupon_code,
                    'coupon_amount' => floatval($coupon->amount),
                    'discount_amount' => $discount_amount,
                    'formatted_discount' => number_format($discount_amount, 2, ',', '.') . ' €',
                    'cart_total' => $cart_total,
                    'new_total' => max(0, $cart_total - $discount_amount)
                ),
                'message' => 'Coupon valido'
            ));
            
        } catch (Exception $e) {
            return new WP_Error('database_error', $e->getMessage(), array('status' => 500));
        }
    }
}