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

        // Aggiungi endpoint AJAX per la ricerca utenti
        add_action('wp_ajax_dreamshop_points_search_users', array($this, 'ajax_search_users'));
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

            // Localizza lo script con i dati necessari
            wp_localize_script('dreamshop-points-admin', 'dreamshop_points_admin', array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'search_nonce' => wp_create_nonce('dreamshop_points_search')
            ));
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

        // Impostazioni paginazione
        $per_page = 20; // Numero di utenti per pagina
        $current_page = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
        $offset = ($current_page - 1) * $per_page;

        // Query per ottenere gli utenti con i loro punti
        global $wpdb;
        $points_table = $wpdb->prefix . 'dreamshop_points';

        // Conta il totale degli utenti
        $total_users = $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->users}"
        );

        // Calcola il numero totale di pagine
        $total_pages = ceil($total_users / $per_page);

        // Query per ottenere gli utenti della pagina corrente
        $users = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT u.ID, u.display_name, u.user_email, IFNULL(p.points, 0) as points
                FROM {$wpdb->users} u
                LEFT JOIN {$points_table} p ON u.ID = p.user_id
                ORDER BY p.points DESC
                LIMIT %d OFFSET %d",
                $per_page,
                $offset
            ),
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

    /**
     * Gestisce la ricerca AJAX degli utenti
     */
    public function ajax_search_users() {
        // Verifica il nonce per la sicurezza
        check_ajax_referer('dreamshop_points_search', 'nonce');

        // Ottieni il termine di ricerca e i parametri di paginazione
        $search_term = isset($_POST['search']) ? sanitize_text_field($_POST['search']) : '';
        $per_page = 20;
        $current_page = isset($_POST['paged']) ? max(1, intval($_POST['paged'])) : 1;
        $offset = ($current_page - 1) * $per_page;

        global $wpdb;
        $points_table = $wpdb->prefix . 'dreamshop_points';

        // Prepara la condizione di ricerca
        $where = '';
        $count_where = '';
        if (!empty($search_term)) {
            $search_like = '%' . $wpdb->esc_like($search_term) . '%';
            $where = $wpdb->prepare(
                "WHERE u.display_name LIKE %s OR u.user_email LIKE %s OR u.user_login LIKE %s",
                $search_like,
                $search_like,
                $search_like
            );
            $count_where = $where;
        }

        // Conta il totale degli utenti che corrispondono alla ricerca
        $total_users = $wpdb->get_var(
            "SELECT COUNT(*)
            FROM {$wpdb->users} u
            {$count_where}"
        );

        // Calcola il numero totale di pagine
        $total_pages = ceil($total_users / $per_page);

        // Query per ottenere gli utenti
        $users = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT u.ID, u.display_name, u.user_email, IFNULL(p.points, 0) as points
                FROM {$wpdb->users} u
                LEFT JOIN {$points_table} p ON u.ID = p.user_id
                {$where}
                ORDER BY p.points DESC
                LIMIT %d OFFSET %d",
                $per_page,
                $offset
            ),
            ARRAY_A
        );

        // Genera l'HTML della tabella
        ob_start();
        ?>
        <thead>
            <tr>
                <th><?php _e('Utente', 'dreamshop-points'); ?></th>
                <th><?php _e('Email', 'dreamshop-points'); ?></th>
                <th><?php _e('Punti', 'dreamshop-points'); ?></th>
                <th><?php _e('Azioni', 'dreamshop-points'); ?></th>
            </tr>
        </thead>
        <tbody>
            <?php if (empty($users)) : ?>
            <tr>
                <td colspan="4"><?php _e('Nessun utente trovato', 'dreamshop-points'); ?></td>
            </tr>
            <?php else : ?>
                <?php foreach ($users as $user) : ?>
                <tr>
                    <td>
                        <a href="<?php echo esc_url(admin_url('user-edit.php?user_id=' . $user['ID'])); ?>">
                            <?php echo esc_html($user['display_name']); ?>
                        </a>
                    </td>
                    <td><?php echo esc_html($user['user_email']); ?></td>
                    <td><?php echo esc_html($user['points']); ?></td>
                    <td>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=dreamshop-points-users&user_id=' . $user['ID'])); ?>" class="button button-small">
                            <?php _e('Visualizza cronologia', 'dreamshop-points'); ?>
                        </a>
                    </td>
                </tr>
                <?php endforeach; ?>
            <?php endif; ?>
        </tbody>
        <?php
        $table_html = ob_get_clean();

        // Genera l'HTML della paginazione
        $pagination_html = '';
        if (!empty($users) && $total_pages > 1) {
            ob_start();
            $page_links = paginate_links(array(
                'base' => add_query_arg('paged', '%#%'),
                'format' => '',
                'prev_text' => __('&laquo; Precedente'),
                'next_text' => __('Successivo &raquo;'),
                'total' => $total_pages,
                'current' => $current_page,
                'type' => 'plain'
            ));

            if ($page_links) {
                echo '<div class="tablenav bottom"><div class="tablenav-pages">';
                echo '<span class="displaying-num">' .
                     sprintf(_n('%s utente', '%s utenti', $total_users, 'dreamshop-points'), number_format_i18n($total_users)) .
                     '</span>';
                echo $page_links;
                echo '</div></div>';
            }
            $pagination_html = ob_get_clean();
        }

        // Invia la risposta JSON
        wp_send_json_success(array(
            'table_html' => $table_html,
            'pagination_html' => $pagination_html,
            'total_users' => $total_users,
            'total_pages' => $total_pages,
            'current_page' => $current_page
        ));
    }
}
