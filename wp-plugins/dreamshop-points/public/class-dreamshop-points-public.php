<?php
/**
 * Gestisce le funzionalità pubbliche per il plugin DreamShop Points
 */
class DreamShop_Points_Public {
    
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
        
        // Aggiungi script e stili frontend
        add_action('wp_enqueue_scripts', array($this, 'enqueue_styles_scripts'));
        
        // Aggiunta dei campi punti nel checkout
        add_action('woocommerce_review_order_before_payment', array($this, 'add_points_redemption_to_checkout'));
        add_action('woocommerce_cart_calculate_fees', array($this, 'apply_points_discount'));
        add_filter('woocommerce_update_order_review_fragments', array($this, 'update_points_fragment'));
        
        // Salvataggio dei punti utilizzati nell'ordine
        add_action('woocommerce_checkout_update_order_meta', array($this, 'save_points_to_order'));
        
        // Mostra i punti nel carrello
        add_action('woocommerce_cart_totals_before_order_total', array($this, 'show_points_in_cart'));
        
        // Gestisci i punti quando un ordine cambia stato
        add_action('woocommerce_order_status_changed', array($this, 'handle_order_status_change'), 10, 3);
        
        // Hook diretto per aggiungere punti quando un ordine è completato
        // Questo hook si attiva quando un ordine passa a stato completato
        add_action('woocommerce_order_status_completed', array($this, 'add_points_on_order_complete'));
        
        // Hook per supportare gli ordini già completati (retrocompatibilità)
        add_action('woocommerce_payment_complete', array($this, 'check_payment_complete'));
        
        // Debug per aiutare nella risoluzione dei problemi
        add_action('init', array($this, 'debug_points_process'), 99);
        
        // Gestione AJAX per riscattare e rimuovere punti nel checkout
        add_action('wp_ajax_dreamshop_redeem_points', array($this, 'ajax_redeem_points'));
        add_action('wp_ajax_dreamshop_remove_points', array($this, 'ajax_remove_points'));
    }
    
    /**
     * Carica gli stili e gli script frontend
     */
    public function enqueue_styles_scripts() {
        if (is_account_page() || is_checkout() || is_cart()) {
            wp_enqueue_style('dreamshop-points-public', DREAMSHOP_POINTS_PLUGIN_URL . 'public/css/dreamshop-points-public.css', array(), DREAMSHOP_POINTS_VERSION);
            wp_enqueue_script('dreamshop-points-public', DREAMSHOP_POINTS_PLUGIN_URL . 'public/js/dreamshop-points-public.js', array('jquery'), DREAMSHOP_POINTS_VERSION, true);
            
            wp_localize_script('dreamshop-points-public', 'dreamshop_points', array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('dreamshop_points_nonce'),
                'i18n' => array(
                    'apply_points' => __('Applica punti', 'dreamshop-points'),
                    'remove_points' => __('Rimuovi punti', 'dreamshop-points'),
                    'points_applied' => __('Punti applicati', 'dreamshop-points'),
                )
            ));
        }
    }
    
    /**
     * Mostra il saldo punti nella dashboard dell'account
     */
    public function show_points_balance() {
        // Ottieni l'utente corrente
        $user_id = get_current_user_id();
        if (!$user_id) return;
        
        // Ottieni i punti dell'utente
        $points = $this->db->get_user_points($user_id);
        $points_label = $points === 1 ? '1 punto' : $points . ' punti';
        
        // Mostra il saldo
        echo '<div class="dreamshop-points-balance">';
        echo '<h3>Il tuo saldo punti</h3>';
        echo '<p class="points-amount">' . $points_label . '</p>';
        echo '<p><a href="' . wc_get_account_endpoint_url('') . '?tab=points" class="button">Gestisci i tuoi punti</a></p>';
        echo '</div>';
    }
    
    /**
     * Aggiunge il campo per riscattare i punti nel checkout
     */
    public function add_points_redemption_to_checkout() {
        // Verifica che l'utente sia loggato
        if (!is_user_logged_in()) {
            return;
        }
        
        $user_id = get_current_user_id();
        $points = $this->db->get_user_points($user_id);
        $min_points = get_option('dreamshop_points_min_redemption', 100);
        
        // Se l'utente non ha abbastanza punti, non mostrare l'opzione
        if ($points < $min_points) {
            return;
        }
        
        // Verifica se i punti sono già stati applicati
        $points_applied = WC()->session->get('dreamshop_points_redeemed', 0);
        $discount_value = $points_applied * get_option('dreamshop_points_redemption_value', 0.01);
        
        $this->log_debug("Checkout: Punti utente: {$points}, Punti minimi: {$min_points}, Punti applicati: {$points_applied}, Valore sconto: {$discount_value}");
        
        // Template per il riscatto punti
        wc_get_template(
            'checkout/points-redemption.php',
            array(
                'points' => $points,
                'points_applied' => $points_applied,
                'discount_value' => $discount_value,
                'min_points' => $min_points,
                'redemption_value' => get_option('dreamshop_points_redemption_value', 0.01)
            ),
            'dreamshop-points/',
            DREAMSHOP_POINTS_PLUGIN_DIR . 'public/templates/'
        );
    }
    
    /**
     * Applica lo sconto punti al carrello
     *
     * @param WC_Cart $cart Oggetto carrello
     */
    public function apply_points_discount($cart) {
        if (!is_user_logged_in() || !WC()->session) {
            return;
        }
        
        // Ottieni i punti riscattati dalla sessione
        $points = WC()->session->get('dreamshop_points_redeemed', 0);
        
        if ($points <= 0) {
            return;
        }
        
        // Calcola il valore dello sconto
        $redemption_value = get_option('dreamshop_points_redemption_value', 0.01);
        $discount = $points * $redemption_value;
        
        $this->log_debug("Applicazione sconto: {$points} punti per un valore di {$discount}€ (valore riscatto: {$redemption_value})");
        
        if ($discount > 0) {
            $cart->add_fee(sprintf(__('Sconto punti (%d punti)', 'dreamshop-points'), $points), -$discount, false);
        }
    }
    
    /**
     * Aggiorna il fragment dei punti per l'aggiornamento AJAX del checkout
     *
     * @param array $fragments Array di frammenti
     * @return array Fragments aggiornati
     */
    public function update_points_fragment($fragments) {
        ob_start();
        $this->add_points_redemption_to_checkout();
        $fragments['.dreamshop-points-redemption'] = ob_get_clean();
        
        return $fragments;
    }
    
    /**
     * Salva i punti utilizzati nell'ordine
     *
     * @param int $order_id ID dell'ordine
     */
    public function save_points_to_order($order_id) {
        if (!is_user_logged_in() || !WC()->session) {
            return;
        }
        
        $points = WC()->session->get('dreamshop_points_redeemed', 0);
        $discount = WC()->session->get('dreamshop_points_discount', 0);
        $already_redeemed = WC()->session->get('dreamshop_points_already_redeemed', false);
        
        $this->log_debug("Salvataggio punti per l'ordine #{$order_id}: {$points} punti, sconto di {$discount}€, già riscattati: " . ($already_redeemed ? 'Sì' : 'No'));
        
        if ($points > 0) {
            // Salva i punti come meta dell'ordine
            update_post_meta($order_id, '_points_redeemed', $points);
            update_post_meta($order_id, '_points_discount_value', $discount);
            update_post_meta($order_id, '_points_already_processed', $already_redeemed ? 'yes' : 'no');
            
            // Riscatta i punti solo se non sono già stati sottratti
            $order = wc_get_order($order_id);
            
            if ($order && !$already_redeemed && $order->get_status() !== 'pending') {
                $user_id = $order->get_customer_id();
                $this->redeem_points_for_order($user_id, $points, $order_id);
            } else if ($already_redeemed) {
                // Aggiorna l'ID dell'ordine nella transazione punti
                $this->db->update_points_transaction_order_id($order_id);
                $this->log_debug("Ordine #{$order_id}: i punti erano già stati riscattati, aggiornato solo il riferimento all'ordine");
            }
        }
        
        // Resetta la sessione
        WC()->session->set('dreamshop_points_redeemed', 0);
        WC()->session->set('dreamshop_points_discount', 0);
        WC()->session->set('dreamshop_points_already_redeemed', false);
    }
    
    /**
     * Mostra i punti nel carrello
     */
    public function show_points_in_cart() {
        if (!is_user_logged_in()) {
            return;
        }
        
        $user_id = get_current_user_id();
        $points = $this->db->get_user_points($user_id);
        $points_label = $points === 1 ? '1 punto' : $points . ' punti';
        
        echo '<tr class="dreamshop-points-cart">';
        echo '<th>' . __('I tuoi punti', 'dreamshop-points') . '</th>';
        echo '<td data-title="' . __('I tuoi punti', 'dreamshop-points') . '">' . $points_label . '</td>';
        echo '</tr>';
    }
    
    /**
     * Gestisce il cambiamento di stato degli ordini
     *
     * @param int $order_id ID dell'ordine
     * @param string $old_status vecchio stato
     * @param string $new_status nuovo stato
     */
    public function handle_order_status_change($order_id, $old_status, $new_status) {
        $this->log_debug("Cambio stato ordine #{$order_id} da '{$old_status}' a '{$new_status}'");
        
        // Ottieni gli stati degli ordini che generano punti
        $earning_statuses = get_option('dreamshop_points_earning_statuses', array('completed'));
        
        // Se il nuovo stato è tra quelli che generano punti
        if (in_array($new_status, $earning_statuses)) {
            $this->log_debug("Stato '{$new_status}' è abilitato per generare punti. Chiamata a add_points_on_order_complete per #{$order_id}");
            $this->add_points_on_order_complete($order_id);
        }
        
        // Rimuovi punti quando un ordine viene rimborsato o annullato
        if ($new_status === 'refunded' || $new_status === 'cancelled') {
            $order = wc_get_order($order_id);
            if ($order) {
                $user_id = $order->get_customer_id();
                $this->refund_redeemed_points($order_id, $user_id);
            }
        }
    }
    
    /**
     * Funzione di debug per tracciare i processi relativi ai punti
     */
    public function debug_points_process() {
        if (isset($_GET['dreamshop_debug_points']) && current_user_can('manage_options')) {
            // Aggiungiamo un log per admin
            add_action('admin_notices', function() {
                echo '<div class="notice notice-info"><p>DreamShop Points Debug attivato.</p></div>';
            });
            
            // Aggiungiamo un log per il frontend
            if (!is_admin()) {
                echo '<div style="padding: 10px; margin: 10px 0; background: #f0f0f0; border-left: 4px solid #0073aa;">';
                echo '<strong>DreamShop Points Debug:</strong><br>';
                echo 'Utente corrente ID: ' . get_current_user_id() . '<br>';
                echo 'Punti utente: ' . $this->db->get_user_points(get_current_user_id()) . '<br>';
                echo '</div>';
            }
        }
    }
    
    /**
     * Controlla se un pagamento completo dovrebbe aggiungere punti
     *
     * @param int $order_id ID dell'ordine
     */
    public function check_payment_complete($order_id) {
        $order = wc_get_order($order_id);
        
        if (!$order) {
            $this->log_debug("Payment complete: Ordine $order_id non trovato");
            return;
        }
        
        $this->log_debug("Payment complete per ordine #{$order_id}, stato: {$order->get_status()}");
        
        // Se l'ordine è già completato, assegna punti
        if ($order->get_status() === 'completed') {
            $this->add_points_on_order_complete($order_id);
        }
    }
    
    /**
     * Registra un messaggio di debug nel file di log
     *
     * @param string $message Messaggio da registrare
     */
    private function log_debug($message) {
        // Assicurati che la directory esista
        $upload_dir = wp_upload_dir();
        $log_dir = $upload_dir['basedir'] . '/dreamshop-points-logs';
        
        if (!file_exists($log_dir)) {
            wp_mkdir_p($log_dir);
        }
        
        $log_file = $log_dir . '/points-debug.log';
        $timestamp = current_time('mysql');
        
        // Scrivi il log
        file_put_contents(
            $log_file,
            "[$timestamp] $message\n",
            FILE_APPEND
        );
    }
    
    /**
     * Aggiunge punti quando un ordine viene completato
     *
     * @param int $order_id ID dell'ordine
     */
    public function add_points_on_order_complete($order_id) {
        $order = wc_get_order($order_id);
        
        if (!$order) {
            $this->log_debug("Ordine $order_id non trovato");
            return;
        }
        
        $user_id = $order->get_customer_id();
        
        // Se non c'è un utente registrato, non assegna punti
        if (!$user_id) {
            $this->log_debug("Ordine $order_id senza utente registrato");
            return;
        }
        
        // Verifica se sono già stati assegnati punti
        $points_added = get_post_meta($order_id, '_points_added', true);
        
        if ($points_added) {
            $this->log_debug("Ordine $order_id: punti già assegnati ($points_added)");
            return;
        }
        
        $this->log_debug("Calcolo punti per ordine $order_id, utente $user_id");

        // Prima controlla se il frontend ha già calcolato i punti corretti
        $frontend_points = $order->get_meta('_points_to_earn_frontend');

        if ($frontend_points && is_numeric($frontend_points)) {
            $points = intval($frontend_points);
            $this->log_debug("Ordine $order_id: usando punti dal frontend: $points punti");
        } else {
            // Fallback al calcolo del plugin se i metadati non sono disponibili
            $points = $this->db->calculate_order_points($order);
            $this->log_debug("Ordine $order_id: usando calcolo plugin: $points punti");
        }

        $this->log_debug("Ordine $order_id: $points punti da assegnare");
        
        if ($points > 0) {
            // Aggiungi i punti
            $result = $this->db->add_points(
                $user_id,
                $points,
                sprintf(__('Punti guadagnati per l\'ordine #%s', 'dreamshop-points'), $order->get_order_number()),
                $order_id
            );
            
            // Salva il meta dell'ordine
            if ($result['success']) {
                update_post_meta($order_id, '_points_added', $points);
                $this->log_debug("Ordine $order_id: aggiunti $points punti con successo all'utente $user_id");
            } else {
                $this->log_debug("Ordine $order_id: ERRORE nell'aggiunta punti: " . print_r($result, true));
            }
            
            // Notifica l'utente
            $this->notify_points_added($user_id, $points, $order_id);
        }
    }
    
    /**
     * Riscatta punti per un ordine
     *
     * @param int $user_id ID dell'utente
     * @param int $points Punti da riscattare
     * @param int $order_id ID dell'ordine
     */
    private function redeem_points_for_order($user_id, $points, $order_id) {
        // Verifica se i punti sono già stati riscattati
        $points_redeemed = get_post_meta($order_id, '_points_redeemed_processed', true);
        
        if ($points_redeemed) {
            return;
        }
        
        // Riscatta i punti
        $result = $this->db->redeem_points(
            $user_id,
            $points,
            sprintf(__('Punti utilizzati per uno sconto sull\'ordine #%s', 'dreamshop-points'), $order_id),
            $order_id
        );
        
        // Salva il meta dell'ordine
        if ($result['success']) {
            update_post_meta($order_id, '_points_redeemed_processed', $points);
        }
    }
    
    /**
     * Restituisce i punti riscattati se un ordine viene annullato o rimborsato
     *
     * @param int $order_id ID dell'ordine
     * @param int $user_id ID dell'utente
     */
    private function refund_redeemed_points($order_id, $user_id) {
        // Verifica se i punti sono stati riscattati
        $points_redeemed = get_post_meta($order_id, '_points_redeemed_processed', true);
        
        if (!$points_redeemed) {
            return;
        }
        
        // Restituisci i punti
        $result = $this->db->add_points(
            $user_id,
            $points_redeemed,
            sprintf(__('Punti restituiti per annullamento/rimborso dell\'ordine #%s', 'dreamshop-points'), $order_id),
            $order_id
        );
        
        // Aggiorna il meta dell'ordine
        if ($result['success']) {
            update_post_meta($order_id, '_points_refunded', $points_redeemed);
        }
    }
    
    /**
     * Invia una notifica all'utente per i punti aggiunti
     *
     * @param int $user_id ID dell'utente
     * @param int $points Punti aggiunti
     * @param int $order_id ID dell'ordine
     */
    private function notify_points_added($user_id, $points, $order_id) {
        $user = get_user_by('id', $user_id);
        
        if (!$user) {
            return;
        }
        
        // Se è attivo WooCommerce Email, usa quello
        if (class_exists('WC_Email')) {
            $mailer = WC()->mailer();
            
            // Template dell'email
            $heading = __('Hai guadagnato punti!', 'dreamshop-points');
            $subject = __('Hai guadagnato punti col tuo ordine', 'dreamshop-points');
            
            // Contenuto dell'email
            $message = sprintf(
                __('Congratulazioni %s!<br><br>Hai guadagnato <strong>%d punti</strong> con il tuo ordine #%s.<br><br>Visita la tua <a href="%s">pagina account</a> per vedere il tuo saldo punti.', 'dreamshop-points'),
                $user->display_name,
                $points,
                $order_id,
                wc_get_account_endpoint_url('')
            );
            
            // Wrap the content with WooCommerce email template
            $content = $mailer->wrap_message($heading, $message);
            
            // Create a new email
            $email = new WC_Email();
            $email_content = apply_filters('woocommerce_mail_content', $email->style_inline($content));
            
            // Send the email
            $mailer->send($user->user_email, $subject, $email_content);
        }
    }
    
    /**
     * Gestisce la richiesta AJAX per riscattare punti nel checkout
     */
    public function ajax_redeem_points() {
        // Verifica il nonce
        check_ajax_referer('dreamshop-points-redeem', 'security');
        
        if (!is_user_logged_in()) {
            wp_send_json_error(array('message' => __('Devi essere loggato per riscattare punti.', 'dreamshop-points')));
            return;
        }
        
        // Ottieni i punti da riscattare
        $points_to_redeem = isset($_POST['points']) ? intval($_POST['points']) : 0;
        
        // Ottieni le impostazioni
        $min_points = get_option('dreamshop_points_min_redemption', 100);
        $redemption_value = get_option('dreamshop_points_redemption_value', 0.01);
        
        // Controlla se i punti sono sufficienti
        if ($points_to_redeem < $min_points) {
            wp_send_json_error(array('message' => sprintf(__('È necessario riscattare almeno %d punti.', 'dreamshop-points'), $min_points)));
            return;
        }
        
        // Ottieni i punti dell'utente
        $user_id = get_current_user_id();
        $user_points = $this->db->get_user_points($user_id);
        
        // Controlla se l'utente ha abbastanza punti
        if ($points_to_redeem > $user_points) {
            wp_send_json_error(array('message' => __('Non hai abbastanza punti disponibili.', 'dreamshop-points')));
            return;
        }
        
        // Calcola il valore dello sconto
        $discount = $points_to_redeem * $redemption_value;
        
        // Rimuovi i punti dall'utente immediatamente
        $result = $this->db->redeem_points(
            $user_id,
            $points_to_redeem,
            __('Punti utilizzati per uno sconto', 'dreamshop-points'),
            0 // L'ID dell'ordine verrà aggiornato in seguito
        );
        
        if (!$result['success']) {
            wp_send_json_error(array('message' => __('Si è verificato un errore nel riscatto dei punti.', 'dreamshop-points')));
            return;
        }
        
        // Salva nella sessione
        WC()->session->set('dreamshop_points_redeemed', $points_to_redeem);
        WC()->session->set('dreamshop_points_discount', $discount);
        // Memorizza nella sessione che i punti sono già stati sottratti
        WC()->session->set('dreamshop_points_already_redeemed', true);
        
        $this->log_debug(sprintf("Utente #%d ha riscattato %d punti per uno sconto di %s€", $user_id, $points_to_redeem, number_format($discount, 2, '.', '')));
        
        wp_send_json_success(array(
            'points_redeemed' => $points_to_redeem,
            'discount' => $discount,
            'message' => sprintf(__('Hai riscattato %d punti per uno sconto di %s€', 'dreamshop-points'), $points_to_redeem, number_format($discount, 2, ',', '.'))
        ));
    }
    
    /**
     * Gestisce la richiesta AJAX per rimuovere punti riscattati nel checkout
     */
    public function ajax_remove_points() {
        // Verifica il nonce
        check_ajax_referer('dreamshop-points-redeem', 'security');
        
        if (!is_user_logged_in()) {
            wp_send_json_error(array('message' => __('Devi essere loggato per rimuovere punti.', 'dreamshop-points')));
            return;
        }
        
        $user_id = get_current_user_id();
        $points_redeemed = WC()->session->get('dreamshop_points_redeemed', 0);
        $already_redeemed = WC()->session->get('dreamshop_points_already_redeemed', false);
        
        // Restituisci i punti all'utente se sono stati già sottratti
        if ($points_redeemed > 0 && $already_redeemed) {
            $result = $this->db->add_points(
                $user_id,
                $points_redeemed,
                __('Restituzione punti non utilizzati nel checkout', 'dreamshop-points'),
                0
            );
            
            if (!$result['success']) {
                $this->log_debug(sprintf("ERRORE nella restituzione di %d punti all'utente #%d", $points_redeemed, $user_id));
                wp_send_json_error(array('message' => __('Si è verificato un errore nella restituzione dei punti.', 'dreamshop-points')));
                return;
            }
            
            $this->log_debug(sprintf("Restituiti %d punti all'utente #%d", $points_redeemed, $user_id));
        }
        
        // Rimuovi dalla sessione
        WC()->session->set('dreamshop_points_redeemed', 0);
        WC()->session->set('dreamshop_points_discount', 0);
        WC()->session->set('dreamshop_points_already_redeemed', false);
        
        $this->log_debug(sprintf("Utente #%d ha rimosso i punti riscattati", $user_id));
        
        wp_send_json_success(array(
            'message' => __('I punti riscattati sono stati rimossi con successo.', 'dreamshop-points')
        ));
    }
}
