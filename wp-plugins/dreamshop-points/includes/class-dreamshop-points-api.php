<?php
/**
 * Gestisce le API REST per il plugin DreamShop Points
 */
class DreamShop_Points_API {
    
    /**
     * Istanza del database
     *
     * @var DreamShop_Points_DB
     */
    private $db;
    
    /**
     * Costruttore
     */
    public function __construct() {
        $this->db = new DreamShop_Points_DB();
    }
    
    /**
     * Registra gli endpoint dell'API REST
     */
    public function register_endpoints() {
        // Namespace API per DreamShop Points (usato dal vecchio frontend)
        $old_namespace = 'dreamshop/v1';
        
        // Nuovo namespace API per DreamShop Points (usato dal nuovo frontend)
        $new_namespace = 'dreamshop-points/v1';
        
        // ============= Vecchi endpoint (mantenerli per compatibilità) =============
        
        // Endpoint per ottenere i punti dell'utente corrente
        register_rest_route($old_namespace, '/points/user', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_user_points'),
            'permission_callback' => array($this, 'check_authentication')
        ));
        
        // Endpoint per aggiungere punti a un utente
        register_rest_route($old_namespace, '/points/add', array(
            'methods' => 'POST',
            'callback' => array($this, 'add_points'),
            'permission_callback' => array($this, 'check_authentication')
        ));
        
        // Endpoint per riscattare punti
        register_rest_route($old_namespace, '/points/redeem', array(
            'methods' => 'POST',
            'callback' => array($this, 'redeem_points'),
            'permission_callback' => array($this, 'check_authentication')
        ));
        
        // ============= Nuovi endpoint (compatibili con il frontend Next.js) =============
        
        // Endpoint per ottenere i punti di un utente specifico per ID
        register_rest_route($new_namespace, '/users/(?P<id>\d+)/points', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_specific_user_points'),
            'permission_callback' => array($this, 'check_authentication'),
            'args' => array(
                'id' => array(
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                )
            )
        ));
        
        // Endpoint per ottenere i punti dell'utente corrente
        register_rest_route($new_namespace, '/users/me/points', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_user_points'),
            'permission_callback' => array($this, 'check_authentication')
        ));
        
        // Endpoint per aggiungere punti a un utente
        register_rest_route($new_namespace, '/points/add', array(
            'methods' => 'POST',
            'callback' => array($this, 'add_points'),
            'permission_callback' => array($this, 'check_authentication')
        ));
        
        // Endpoint per riscattare punti
        register_rest_route($new_namespace, '/points/redeem', array(
            'methods' => 'POST',
            'callback' => array($this, 'redeem_points'),
            'permission_callback' => array($this, 'check_authentication')
        ));
        
        // ============= NUOVO ENDPOINT SICURO (senza autenticazione) =============
        
        // Endpoint sicuro per riscattare punti tramite chiave API
        register_rest_route($new_namespace, '/points/secure-redeem', array(
            'methods' => 'POST',
            'callback' => array($this, 'secure_redeem_points'),
            // Nessuna permission_callback qui - l'autenticazione è gestita internamente
            'permission_callback' => '__return_true' // Permette a tutte le richieste di arrivare alla callback
        ));
    }
    
    /**
     * Verifica che l'utente sia autenticato
     *
     * @param WP_REST_Request $request Richiesta REST
     * @return bool|WP_Error True se autenticato, WP_Error altrimenti
     */
    public function check_authentication($request) {
        return current_user_can('read');
    }
    
    /**
     * Chiave API sicura per l'endpoint di decurtazione punti
     * Nota: Questa è condivisa con il server Next.js attraverso variabili d'ambiente
     */
    private function get_api_key() {
        // Prima cerca nelle costanti PHP (es. impostate nel wp-config.php)
        if (defined('DREAMSHOP_POINTS_API_KEY') && DREAMSHOP_POINTS_API_KEY) {
            return DREAMSHOP_POINTS_API_KEY;
        }
        
        // Poi cerca nelle opzioni di WordPress
        $api_key = get_option('dreamshop_points_api_key');
        if ($api_key) {
            return $api_key;
        }
        
        // Se l'opzione non esiste, creala con una chiave sicura
        // Nota: questa chiave dovrebbe essere condivisa manualmente con il server Next.js
        if (!$api_key) {
            // Genera una chiave sicura di 64 caratteri
            $api_key = bin2hex(random_bytes(32)); // 64 caratteri esadecimali
            
            // Salva la chiave nelle opzioni di WordPress
            update_option('dreamshop_points_api_key', $api_key);
            
            // Log per il debug (rimuovere in produzione)
            error_log('DreamShop Points API: Generata nuova chiave API. Configurala nel tuo server Next.js.');
            error_log('DreamShop Points API: POINTS_API_KEY=' . $api_key);
            
            return $api_key;
        }
        
        // Fallback (non dovrebbe mai arrivare qui)
        return 'H2y8x5v3K7L9q1R4T6W0p8Z2X4C6V9B1N3M5Q7E0S2D4F6G8J0K2L4Z6X8C0V2B4N6M8Q0';
    }
    
    /**
     * Genera un coupon WooCommerce per i punti riscattati
     * 
     * @param int $user_id ID dell'utente
     * @param float $discount_amount Importo dello sconto
     * @param string $description Descrizione del coupon
     * @return array Dati del coupon o array vuoto in caso di errore
     */
    private function generate_points_coupon($user_id, $discount_amount, $description = '') {
        // Verifica che WooCommerce sia attivo
        if (!class_exists('WooCommerce')) {
            error_log('DreamShop Points API: WooCommerce non attivo');
            return [];
        }
        
        // Verifica che il tipo di post shop_coupon esista
        $post_type_exists = post_type_exists('shop_coupon');
        if (!$post_type_exists) {
            error_log('DreamShop Points API: Tipo di post shop_coupon non disponibile');
            return [];
        }
        
        // Genera un codice coupon univoco basato su timestamp e ID utente
        $timestamp = time();
        $coupon_code = 'POINTS_' . $user_id . '_' . $timestamp;
        
        // Crea il coupon come post di tipo shop_coupon
        $coupon = array(
            'post_title' => $coupon_code,
            'post_content' => '',
            'post_status' => 'publish',
            'post_author' => $user_id,
            'post_type' => 'shop_coupon',
            'post_excerpt' => $description ?: 'Sconto per punti fedeltà riscattati'
        );
        
        // Log per debug
        error_log('DreamShop Points API: Tentativo di creazione coupon con parametri: ' . json_encode($coupon));
        
        // Utilizza try/catch per catturare eventuali errori
        try {
            $coupon_id = wp_insert_post($coupon);
            
            if (!$coupon_id || is_wp_error($coupon_id)) {
                error_log('DreamShop Points API: Errore nella creazione del coupon: ' . json_encode($coupon_id));
                if (is_wp_error($coupon_id)) {
                    error_log('DreamShop Points API: Dettaglio errore: ' . $coupon_id->get_error_message());
                }
                return [];
            }
            
            error_log('DreamShop Points API: Coupon creato con ID: ' . $coupon_id);
        } catch (Exception $e) {
            error_log('DreamShop Points API: Eccezione durante la creazione del coupon: ' . $e->getMessage());
            return [];
        }
        
        // Imposta i metadati del coupon
        update_post_meta($coupon_id, 'discount_type', 'fixed_cart'); // Sconto fisso sul carrello
        update_post_meta($coupon_id, 'coupon_amount', $discount_amount); // Importo dello sconto
        update_post_meta($coupon_id, 'individual_use', 'no'); // Può essere usato insieme ad altri coupon
        update_post_meta($coupon_id, 'usage_limit', 1); // Può essere usato solo una volta
        update_post_meta($coupon_id, 'usage_limit_per_user', 1); // Una volta per utente
        update_post_meta($coupon_id, 'date_expires', strtotime('+1 day')); // Scade dopo 24 ore
        update_post_meta($coupon_id, 'apply_before_tax', 'yes'); // Applica prima delle tasse
        update_post_meta($coupon_id, 'free_shipping', 'no'); // Non include spedizione gratuita
        update_post_meta($coupon_id, '_dreamshop_points_coupon', 'yes'); // Marca come coupon generato da punti
        update_post_meta($coupon_id, '_dreamshop_points_user_id', $user_id); // Utente associato
        
        // Esclude questo coupon dalle restrizioni di individual_use di altri coupon
        update_post_meta($coupon_id, 'exclude_sale_items', 'no');
        
        // Priorità alta per questo coupon per assicurarsi che venga applicato
        update_post_meta($coupon_id, 'priority', '10'); // Priorità alta
        
        // Assicuriamo che possa essere applicato anche se ci sono altri coupon
        update_post_meta($coupon_id, 'can_be_combined', 'yes');
        
        // Aggiunge un meta speciale per identificare questo come coupon punti
        update_post_meta($coupon_id, '_dreamshop_points_coupon_code', $coupon_code);
        
        // Imposta la priorità più alta possibile per questo coupon
        update_post_meta($coupon_id, 'priority', '999');
        
        // Log per debug
        error_log('DreamShop Points API: Metadati del coupon impostati con successo per ID: ' . $coupon_id);
        
        error_log('DreamShop Points API: Coupon generato con successo: ' . $coupon_code . ' per un valore di ' . $discount_amount);
        
        return [
            'coupon_id' => $coupon_id,
            'coupon_code' => $coupon_code,
            'discount_amount' => $discount_amount,
            'expiry_date' => date('Y-m-d H:i:s', strtotime('+1 day'))
        ];
    }
    
    /**
     * Endpoint sicuro per riscattare punti utilizzando una chiave API
     * Non richiede autenticazione JWT, ma richiede una chiave API
     * Genera e restituisce un coupon WooCommerce per applicare lo sconto
     *
     * @param WP_REST_Request $request Richiesta REST
     * @return WP_REST_Response|WP_Error Risposta REST
     */
    public function secure_redeem_points($request) {
        error_log('DreamShop Points API: secure_redeem_points chiamato');
        
        // Ottieni l'header API Key
        $api_key = $request->get_header('X-API-Key');
        
        // Verifica l'API Key
        $expected_key = $this->get_api_key();
        error_log('DreamShop Points API: Chiave ricevuta: ' . $api_key);
        error_log('DreamShop Points API: Chiave attesa: ' . $expected_key);
        
        if (!$api_key || $api_key !== $expected_key) {
            error_log('DreamShop Points API: API Key non valida o mancante - Ricevuta: [' . $api_key . '] Attesa: [' . $expected_key . ']');
            return new WP_Error(
                'invalid_api_key',
                'Chiave API non valida o mancante',
                array('status' => 401)
            );
        }
        
        // Ottieni i parametri dalla richiesta
        $params = $request->get_json_params();
        error_log('DreamShop Points API: secure_redeem_points parametri: ' . json_encode($params));
        
        // Valida i parametri richiesti
        if (!isset($params['user_id']) || !is_numeric($params['user_id']) || $params['user_id'] <= 0) {
            error_log('DreamShop Points API: user_id non valido o mancante');
            return new WP_Error(
                'invalid_parameter',
                'Il parametro user_id è obbligatorio e deve essere un numero positivo',
                array('status' => 400)
            );
        }
        
        if (!isset($params['points']) || !is_numeric($params['points']) || $params['points'] <= 0) {
            error_log('DreamShop Points API: points non valido o mancante');
            return new WP_Error(
                'invalid_parameter',
                'Il parametro points è obbligatorio e deve essere un numero positivo',
                array('status' => 400)
            );
        }
        
        // Estrai i parametri
        $user_id = intval($params['user_id']);
        $points = intval($params['points']);
        $description = isset($params['description']) ? sanitize_text_field($params['description']) : 'Punti riscattati';
        $order_id = isset($params['order_id']) ? intval($params['order_id']) : 0;
        
        // Valore monetario dei punti (parametro opzionale o calcolo automatico)
        $discount_amount = isset($params['discount_amount']) ? floatval($params['discount_amount']) : ($points / 100); // Default: 1 punto = 0.01€
        
        // Verifica che l'utente esista
        if (!get_user_by('id', $user_id)) {
            error_log('DreamShop Points API: utente non trovato: ' . $user_id);
            return new WP_Error(
                'invalid_user',
                'Utente non trovato',
                array('status' => 404)
            );
        }
        
        // Verifica che l'utente abbia abbastanza punti
        $current_points = $this->db->get_user_points($user_id);
        if ($current_points < $points) {
            error_log('DreamShop Points API: punti insufficienti. Richiesti: ' . $points . ', disponibili: ' . $current_points);
            return new WP_Error(
                'insufficient_points',
                'Punti insufficienti. L\'utente ha ' . $current_points . ' punti, ma ne sono richiesti ' . $points . '.',
                array('status' => 400)
            );
        }
        
        // Genera il coupon per lo sconto
        $coupon_data = $this->generate_points_coupon($user_id, $discount_amount, $description);
        
        if (empty($coupon_data)) {
            error_log('DreamShop Points API: Errore nella generazione del coupon');
            return new WP_Error(
                'coupon_error',
                'Impossibile generare il coupon per i punti',
                array('status' => 500)
            );
        }
        
        // Riscatta i punti solo dopo aver generato il coupon con successo
        $result = $this->db->redeem_points($user_id, $points, $description . ' (Coupon: ' . $coupon_data['coupon_code'] . ')', $order_id);
        error_log('DreamShop Points API: risultato decurtazione punti: ' . json_encode($result));
        
        // Se l'operazione ha avuto successo
        if ($result['success']) {
            // Aggiungi i dati del coupon alla risposta
            $response = array_merge($result, [
                'coupon' => $coupon_data,
                'discount_amount' => $discount_amount,
                'points_redeemed' => $points,
                'user_id' => $user_id
            ]);
            
            return rest_ensure_response($response);
        } else {
            // Se la decurtazione punti fallisce, eliminiamo anche il coupon generato
            if (!empty($coupon_data['coupon_id'])) {
                wp_delete_post($coupon_data['coupon_id'], true);
                error_log('DreamShop Points API: Coupon eliminato dopo fallimento decurtazione punti: ' . $coupon_data['coupon_code']);
            }
            
            return new WP_Error(
                'points_error',
                $result['description'],
                array('status' => 400)
            );
        }
    }
    
    /**
     * Ottiene i punti di un utente
     *
     * @param WP_REST_Request $request Richiesta REST
     * @return WP_REST_Response Risposta REST
     */
    public function get_user_points($request) {
        // Ottieni l'utente corrente
        $user_id = get_current_user_id();
        
        // Ottieni i punti dell'utente
        $points = $this->db->get_user_points($user_id);
        
        // Ottieni la cronologia dei punti
        $history = $this->db->get_points_history($user_id);
        
        // Creazione dell'etichetta dei punti
        $points_label = $this->format_points_label($points);
        
        // Restituisci la risposta
        return rest_ensure_response(array(
            'success' => true,
            'user_id' => $user_id,
            'points' => $points,
            'pointsLabel' => $points_label,
            'history' => $history
        ));
    }
    
    /**
     * Aggiunge punti a un utente
     *
     * @param WP_REST_Request $request Richiesta REST
     * @return WP_REST_Response Risposta REST
     */
    public function add_points($request) {
        // Ottieni l'utente corrente
        $user_id = get_current_user_id();
        
        // Ottieni i parametri dalla richiesta
        $params = $request->get_json_params();
        
        // Valida i parametri richiesti
        if (!isset($params['points']) || !is_numeric($params['points']) || $params['points'] <= 0) {
            return new WP_Error(
                'invalid_parameter',
                'Il parametro points è obbligatorio e deve essere un numero positivo.',
                array('status' => 400)
            );
        }
        
        $points = intval($params['points']);
        $description = isset($params['description']) ? sanitize_text_field($params['description']) : 'Punti aggiunti';
        $order_id = isset($params['order_id']) ? intval($params['order_id']) : 0;
        
        // Aggiungi i punti
        $result = $this->db->add_points($user_id, $points, $description, $order_id);
        
        // Se l'operazione ha avuto successo
        if ($result['success']) {
            return rest_ensure_response($result);
        } else {
            return new WP_Error(
                'points_error',
                $result['description'],
                array('status' => 400)
            );
        }
    }
    
    /**
     * Riscatta punti di un utente
     *
     * @param WP_REST_Request $request Richiesta REST
     * @return WP_REST_Response Risposta REST
     */
    public function redeem_points($request) {
        // Ottieni i parametri dalla richiesta
        $params = $request->get_json_params();
        
        // Log dei parametri ricevuti per debug
        error_log('DreamShop Points API: redeem_points chiamato con parametri: ' . json_encode($params));
        
        // Valida i parametri richiesti
        if (!isset($params['points']) || !is_numeric($params['points']) || $params['points'] <= 0) {
            error_log('DreamShop Points API: parametro points non valido');
            return new WP_Error(
                'invalid_parameter',
                'Il parametro points è obbligatorio e deve essere un numero positivo.',
                array('status' => 400)
            );
        }
        
        // Ottieni e valida l'ID utente
        // Prima cerca l'user_id nei parametri, altrimenti usa l'utente corrente
        $user_id = isset($params['user_id']) && is_numeric($params['user_id']) ? intval($params['user_id']) : get_current_user_id();
        
        // Verifica che l'utente esista
        if ($user_id <= 0 || !get_user_by('id', $user_id)) {
            error_log('DreamShop Points API: utente non valido o non autenticato: ' . $user_id);
            return new WP_Error(
                'invalid_user',
                'Utente non valido o non autenticato.',
                array('status' => 401)
            );
        }
        
        error_log('DreamShop Points API: riscatto punti per utente ID ' . $user_id);
        
        $points = intval($params['points']);
        $description = isset($params['description']) ? sanitize_text_field($params['description']) : 'Punti riscattati';
        $order_id = isset($params['order_id']) ? intval($params['order_id']) : 0;
        
        // Verifica che l'utente abbia abbastanza punti
        $current_points = $this->db->get_user_points($user_id);
        if ($current_points < $points) {
            error_log('DreamShop Points API: punti insufficienti. Richiesti: ' . $points . ', disponibili: ' . $current_points);
            return new WP_Error(
                'insufficient_points',
                'Punti insufficienti. L\'utente ha ' . $current_points . ' punti, ma ne sono richiesti ' . $points . '.',
                array('status' => 400)
            );
        }
        
        // Riscatta i punti
        $result = $this->db->redeem_points($user_id, $points, $description, $order_id);
        error_log('DreamShop Points API: risultato riscatto punti: ' . json_encode($result));
        
        // Se l'operazione ha avuto successo
        if ($result['success']) {
            return rest_ensure_response($result);
        } else {
            return new WP_Error(
                'points_error',
                $result['description'],
                array('status' => 400)
            );
        }
    }
    
    /**
     * Ottiene i punti di un utente specifico tramite ID
     *
     * @param WP_REST_Request $request Richiesta REST
     * @return WP_REST_Response|WP_Error Risposta REST o Errore
     */
    public function get_specific_user_points($request) {
        // Ottieni l'ID utente dalla richiesta (parametro obbligatorio)
        $user_id = $request->get_param('id');
        if (empty($user_id)) {
            return new WP_Error(
                'missing_id',
                'ID utente mancante nella richiesta',
                array('status' => 400)
            );
        }
        
        // Verifica se l'utente corrente è un amministratore o sta cercando i propri punti
        $current_user_id = get_current_user_id();
        if (!current_user_can('manage_options') && $current_user_id != $user_id) {
            return new WP_Error(
                'rest_forbidden',
                'Non hai i permessi per visualizzare i punti di questo utente.',
                array('status' => 403)
            );
        }
        
        // Ottieni i punti dell'utente
        $points = $this->db->get_user_points($user_id);
        
        // Ottieni la cronologia dei punti
        $history = $this->db->get_points_history($user_id);
        
        // Creazione dell'etichetta dei punti
        $points_label = $this->format_points_label($points);
        
        // Restituisci la risposta
        return rest_ensure_response(array(
            'success' => true,
            'user_id' => (int) $user_id,
            'points' => (int) $points,
            'pointsLabel' => $points_label,
            'history' => is_array($history) ? $history : array()
        ));
    }
    
    /**
     * Formatta l'etichetta dei punti
     *
     * @param int $points Numero di punti
     * @return string Etichetta formattata
     */
    private function format_points_label($points) {
        if ($points === 1) {
            return '1 punto';
        } else {
            return $points . ' punti';
        }
    }
}
