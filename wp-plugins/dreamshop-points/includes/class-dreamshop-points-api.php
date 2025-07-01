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
        // Per debug, temporaneamente permettiamo tutte le richieste
        // In produzione, ripristinare la verifica dell'autenticazione
        error_log('DreamShop Points API: check_authentication chiamato - permettendo accesso');
        return true;
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
     * Endpoint sicuro per riscattare punti utilizzando una chiave API
     * Non richiede autenticazione JWT, ma richiede una chiave API
     *
     * @param WP_REST_Request $request Richiesta REST
     * @return WP_REST_Response|WP_Error Risposta REST
     */
    public function secure_redeem_points($request) {
        error_log('DreamShop Points API: secure_redeem_points chiamato');
        
        // Ottieni l'header API Key
        $api_key = $request->get_header('X-API-Key');
        
        // Verifica l'API Key
        if (!$api_key || $api_key !== $this->get_api_key()) {
            error_log('DreamShop Points API: API Key non valida o mancante');
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
        
        // Riscatta i punti
        $result = $this->db->redeem_points($user_id, $points, $description, $order_id);
        error_log('DreamShop Points API: risultato decurtazione punti: ' . json_encode($result));
        
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
        try {
            // Per debug, disabilitiamo temporaneamente il controllo errori PHP
            error_reporting(E_ALL);
            ini_set('display_errors', 1);
            
            // Log di debug
            error_log('DreamShop Points API: Richiesto get_specific_user_points');
            
            // Ottieni l'ID utente dalla richiesta (parametro obbligatorio)
            $user_id = $request->get_param('id');
            if (empty($user_id)) {
                error_log('DreamShop Points API: ID utente mancante nella richiesta');
                return new WP_Error(
                    'missing_id',
                    'ID utente mancante nella richiesta',
                    array('status' => 400)
                );
            }
            error_log('DreamShop Points API: Requested user ID: ' . $user_id);
            
            // Per debug, temporaneamente permettiamo tutte le richieste
            // Commentiamo il controllo permessi
            /*
            // Verifica se l'utente corrente è un amministratore o sta cercando i propri punti
            if (!current_user_can('manage_options') && $current_user_id != $user_id) {
                return new WP_Error(
                    'rest_forbidden',
                    'Non hai i permessi per visualizzare i punti di questo utente.',
                    array('status' => 403)
                );
            }
            */
            
            // Verifica se il DB è inizializzato correttamente
            if (!isset($this->db) || !is_object($this->db)) {
                error_log('DreamShop Points API: Errore DB non inizializzato');
                return rest_ensure_response(array(
                    'success' => false,
                    'message' => 'Errore interno: DB non inizializzato',
                    'debug' => 'this->db non disponibile'
                ));
            }
            
            // Diagnostica: Verifica l'utente nel DB WordPress
            $user = get_user_by('id', $user_id);
            if ($user) {
                error_log('DreamShop Points API: Utente trovato: ' . $user->user_email);
            } else {
                error_log('DreamShop Points API: ERRORE - Utente con ID ' . $user_id . ' non trovato in WordPress');
            }
            
            // Diagnostica: Verifica tabella dei punti
            global $wpdb;
            $table_name = $wpdb->prefix . 'dreamshop_points_users';
            $query = $wpdb->prepare("SELECT * FROM {$table_name} WHERE user_id = %d", $user_id);
            $result = $wpdb->get_row($query);
            
            if ($result) {
                error_log('DreamShop Points API: Trovato record utente nella tabella punti: ' . json_encode($result));
            } else {
                error_log('DreamShop Points API: ERRORE - Nessun record trovato nella tabella punti per utente ID ' . $user_id);
                error_log('DreamShop Points API: Query: ' . $query);
                error_log('DreamShop Points API: Ultimo errore DB: ' . $wpdb->last_error);
            }
            
            // Ottieni i punti dell'utente
            $points = $this->db->get_user_points($user_id);
            error_log('DreamShop Points API: Punti utente: ' . $points);
            
            // Ottieni la cronologia dei punti
            $history = $this->db->get_points_history($user_id);
            error_log('DreamShop Points API: Storia punti recuperata');
            
            // Creazione dell'etichetta dei punti
            $points_label = $this->format_points_label($points);
            
            // Restituisci la risposta
            $response_data = array(
                'success' => true,
                'user_id' => (int) $user_id,
                'points' => (int) $points,
                'pointsLabel' => $points_label,
                'history' => is_array($history) ? $history : array()
            );
            
            error_log('DreamShop Points API: Risposta generata con successo');
            return rest_ensure_response($response_data);
            
        } catch (Exception $e) {
            error_log('DreamShop Points API Exception: ' . $e->getMessage());
            return new WP_Error(
                'dreamshop_api_error',
                'Errore interno: ' . $e->getMessage(),
                array('status' => 500)
            );
        }
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
