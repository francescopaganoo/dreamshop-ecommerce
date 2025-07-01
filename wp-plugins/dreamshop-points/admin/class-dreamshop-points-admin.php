<?php
/**
 * Gestisce l'interfaccia di amministrazione per il plugin DreamShop Points
 */
class DreamShop_Points_Admin {
    
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
        
        // Aggiungi script e stili admin
        add_action('admin_enqueue_scripts', array($this, 'enqueue_styles_scripts'));
        
        // Aggiungi azioni per gli ordini WooCommerce
        add_action('woocommerce_admin_order_data_after_billing_address', array($this, 'display_points_info'), 10, 1);
    }
    
    /**
     * Carica gli stili e gli script admin
     */
    public function enqueue_styles_scripts() {
        $screen = get_current_screen();
        
        // Carica stili e script solo nelle pagine del plugin
        if (isset($screen->id) && strpos($screen->id, 'dreamshop-points') !== false) {
            wp_enqueue_style('dreamshop-points-admin', DREAMSHOP_POINTS_PLUGIN_URL . 'admin/css/dreamshop-points-admin.css', array(), DREAMSHOP_POINTS_VERSION);
            wp_enqueue_script('dreamshop-points-admin', DREAMSHOP_POINTS_PLUGIN_URL . 'admin/js/dreamshop-points-admin.js', array('jquery'), DREAMSHOP_POINTS_VERSION, true);
        }
    }
    
    /**
     * Aggiunge il menu di amministrazione
     */
    public function add_admin_menu() {
        add_menu_page(
            'DreamShop Points',
            'Punti Fedeltà',
            'manage_options',
            'dreamshop-points',
            array($this, 'render_dashboard'),
            'dashicons-star-filled',
            58
        );
        
        add_submenu_page(
            'dreamshop-points',
            'Dashboard',
            'Dashboard',
            'manage_options',
            'dreamshop-points',
            array($this, 'render_dashboard')
        );
        
        add_submenu_page(
            'dreamshop-points',
            'Impostazioni',
            'Impostazioni',
            'manage_options',
            'dreamshop-points-settings',
            array($this, 'render_settings')
        );
        
        add_submenu_page(
            'dreamshop-points',
            'Gestione Utenti',
            'Gestione Utenti',
            'manage_options',
            'dreamshop-points-users',
            array($this, 'render_users')
        );
    }
    
    /**
     * Renderizza la pagina dashboard
     */
    public function render_dashboard() {
        // Ottieni statistiche sui punti
        global $wpdb;
        $points_table = $wpdb->prefix . 'dreamshop_points';
        $points_log_table = $wpdb->prefix . 'dreamshop_points_log';
        
        $total_points = $wpdb->get_var("SELECT SUM(points) FROM {$points_table}");
        $total_users = $wpdb->get_var("SELECT COUNT(*) FROM {$points_table}");
        $total_redeemed = $wpdb->get_var("SELECT SUM(points) FROM {$points_log_table} WHERE type = 'redeem'");
        $total_earned = $wpdb->get_var("SELECT SUM(points) FROM {$points_log_table} WHERE type = 'earn'");
        
        $recent_transactions = $wpdb->get_results(
            "SELECT p.*, u.display_name, u.user_email
            FROM {$points_log_table} p
            JOIN {$wpdb->users} u ON p.user_id = u.ID
            ORDER BY p.created_at DESC
            LIMIT 10",
            ARRAY_A
        );
        
        include(DREAMSHOP_POINTS_PLUGIN_DIR . 'admin/views/dashboard.php');
    }
    
    /**
     * Renderizza la pagina impostazioni
     */
    public function render_settings() {
        // Salva le impostazioni se il form è stato inviato
        if (isset($_POST['dreamshop_points_save_settings']) && check_admin_referer('dreamshop_points_settings')) {
            // Salva le impostazioni
            $earn_ratio = floatval($_POST['dreamshop_points_earn_ratio']);
            $redemption_ratio = floatval($_POST['dreamshop_points_redemption_ratio']);
            $min_points_to_redeem = intval($_POST['dreamshop_points_min_to_redeem']);
            
            update_option('dreamshop_points_earn_ratio', $earn_ratio);
            update_option('dreamshop_points_redemption_ratio', $redemption_ratio);
            update_option('dreamshop_points_min_to_redeem', $min_points_to_redeem);
            
            // Mostra messaggio di successo
            add_settings_error('dreamshop_points', 'settings_updated', 'Impostazioni salvate con successo.', 'updated');
        }
        
        // Ottieni le impostazioni attuali
        $earn_ratio = get_option('dreamshop_points_earn_ratio', 1);
        $redemption_ratio = get_option('dreamshop_points_redemption_ratio', 0.01);
        $min_points_to_redeem = get_option('dreamshop_points_min_to_redeem', 100);
        
        include(DREAMSHOP_POINTS_PLUGIN_DIR . 'admin/views/settings.php');
    }
    
    /**
     * Renderizza la pagina gestione utenti
     */
    public function render_users() {
        // Aggiorna i punti degli utenti se richiesto
        if (isset($_POST['dreamshop_points_update_user']) && check_admin_referer('dreamshop_points_update_user')) {
            $user_id = intval($_POST['user_id']);
            $points = intval($_POST['points']);
            $action = sanitize_text_field($_POST['points_action']);
            $description = sanitize_text_field($_POST['description']);
            
            if ($action === 'add') {
                $this->db->add_points($user_id, $points, $description);
                add_settings_error('dreamshop_points', 'points_updated', "Aggiunti {$points} punti all'utente.", 'updated');
            } elseif ($action === 'remove') {
                $this->db->redeem_points($user_id, $points, $description);
                add_settings_error('dreamshop_points', 'points_updated', "Rimossi {$points} punti dall'utente.", 'updated');
            }
        }
        
        // Query per ottenere tutti gli utenti con i loro punti
        global $wpdb;
        $points_table = $wpdb->prefix . 'dreamshop_points';
        
        $users = $wpdb->get_results(
            "SELECT u.ID, u.display_name, u.user_email, IFNULL(p.points, 0) as points
            FROM {$wpdb->users} u
            LEFT JOIN {$points_table} p ON u.ID = p.user_id
            ORDER BY p.points DESC",
            ARRAY_A
        );
        
        // Se viene richiesta la cronologia di un utente
        $user_history = null;
        $user_details = null;
        
        if (isset($_GET['user_id']) && is_numeric($_GET['user_id'])) {
            $user_id = intval($_GET['user_id']);
            $user_details = get_user_by('id', $user_id);
            
            if ($user_details) {
                $user_history = $this->db->get_points_history($user_id, 100);
            }
        }
        
        include(DREAMSHOP_POINTS_PLUGIN_DIR . 'admin/views/users.php');
    }
    
    /**
     * Aggiunge un meta box per i punti negli ordini
     */
    public function add_order_points_meta_box() {
        add_meta_box(
            'dreamshop_points_order',
            'Punti Fedeltà',
            array($this, 'render_order_points_meta_box'),
            'shop_order',
            'side',
            'default'
        );
    }
    
    /**
     * Renderizza il meta box dei punti negli ordini
     *
     * @param WP_Post $post Post dell'ordine
     */
    public function render_order_points_meta_box($post) {
        // Ottieni l'ordine
        $order = wc_get_order($post->ID);
        if (!$order) {
            return;
        }
        
        // Ottieni il cliente
        $customer_id = $order->get_customer_id();
        if (!$customer_id) {
            echo '<p>Questo ordine non ha un cliente registrato.</p>';
            return;
        }
        
        // Ottieni i punti del cliente
        $points = $this->db->get_user_points($customer_id);
        
        // Ottieni i punti guadagnati con questo ordine
        global $wpdb;
        $points_log_table = $wpdb->prefix . 'dreamshop_points_log';
        
        $earned_points = $wpdb->get_var($wpdb->prepare(
            "SELECT SUM(points) FROM {$points_log_table} 
            WHERE user_id = %d AND order_id = %d AND type = 'earn'",
            $customer_id, $order->get_id()
        ));
        
        $redeemed_points = $wpdb->get_var($wpdb->prepare(
            "SELECT SUM(points) FROM {$points_log_table} 
            WHERE user_id = %d AND order_id = %d AND type = 'redeem'",
            $customer_id, $order->get_id()
        ));
        
        // Calcola i punti che sarebbero aggiunti se l'ordine fosse completato
        $points_to_add = $this->db->calculate_order_points($order);
        
        // Output
        echo '<div class="dreamshop-points-meta-box">';
        echo '<p><strong>Punti attuali cliente:</strong> ' . $points . '</p>';
        
        if ($earned_points) {
            echo '<p><strong>Punti guadagnati con questo ordine:</strong> ' . $earned_points . '</p>';
        }
        
        if ($redeemed_points) {
            echo '<p><strong>Punti riscattati in questo ordine:</strong> ' . $redeemed_points . '</p>';
        }
        
        // Se l'ordine non è completato, mostra i punti che sarebbero aggiunti
        if ($order->get_status() != 'completed' && !$earned_points) {
            echo '<p><strong>Punti da aggiungere al completamento:</strong> ' . $points_to_add . '</p>';
            
            // Form per aggiungere manualmente i punti
            if (current_user_can('manage_woocommerce')) {
                wp_nonce_field('dreamshop_points_add_manually', 'dreamshop_points_nonce');
                echo '<p><button type="button" id="dreamshop-points-add-manually" class="button" data-order-id="' . $order->get_id() . 
                     '" data-user-id="' . $customer_id . '" data-points="' . $points_to_add . '">Aggiungi punti manualmente</button></p>';
                echo '<div id="dreamshop-points-add-result"></div>';
            }
        }
        
        echo '</div>';
    }
    
    /**
     * Salva i meta dei punti nell'ordine
     *
     * @param int $order_id ID dell'ordine
     */
    public function save_order_points_meta_box($order_id) {
        // Verifica se è un'azione automatica
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }
        
        // Verifica se è un ordine
        if ('shop_order' != get_post_type($order_id)) {
            return;
        }
        
        // Verifica se l'utente ha i permessi
        if (!current_user_can('edit_post', $order_id)) {
            return;
        }
        
        // Verifica il nonce
        if (!isset($_POST['dreamshop_points_nonce']) || !wp_verify_nonce($_POST['dreamshop_points_nonce'], 'dreamshop_points_add_manually')) {
            return;
        }
        
        // Processa i dati qui se necessario
    }
    
    /**
     * Mostra le informazioni sui punti nella pagina di dettaglio dell'ordine
     *
     * @param WC_Order $order Oggetto ordine
     */
    public function display_points_info($order) {
        $customer_id = $order->get_customer_id();
        
        if (!$customer_id) {
            return;
        }
        
        $points = $this->db->get_user_points($customer_id);
        
        echo '<div class="order-points-info">';
        echo '<h3>Punti Fedeltà</h3>';
        echo '<p><strong>Punti attuali:</strong> ' . $points . '</p>';
        
        // Ottieni i punti relativi a questo ordine
        global $wpdb;
        $points_log_table = $wpdb->prefix . 'dreamshop_points_log';
        
        $earned_points = $wpdb->get_var($wpdb->prepare(
            "SELECT SUM(points) FROM {$points_log_table} 
            WHERE user_id = %d AND order_id = %d AND type = 'earn'",
            $customer_id, $order->get_id()
        ));
        
        $redeemed_points = $wpdb->get_var($wpdb->prepare(
            "SELECT SUM(points) FROM {$points_log_table} 
            WHERE user_id = %d AND order_id = %d AND type = 'redeem'",
            $customer_id, $order->get_id()
        ));
        
        if ($earned_points) {
            echo '<p><strong>Punti guadagnati con questo ordine:</strong> ' . $earned_points . '</p>';
        }
        
        if ($redeemed_points) {
            echo '<p><strong>Punti riscattati in questo ordine:</strong> ' . $redeemed_points . '</p>';
        }
        
        echo '</div>';
    }
}
