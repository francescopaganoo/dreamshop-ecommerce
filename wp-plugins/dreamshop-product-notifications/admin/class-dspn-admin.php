<?php
/**
 * Admin panel for DreamShop Product Notifications
 */

if (!defined('ABSPATH')) {
    exit;
}

class DSPN_Admin {
    
    private $database;
    
    public function __construct() {
        $this->database = new DSPN_Database();
        
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'));
        add_action('admin_post_dspn_test_notification', array($this, 'handle_test_notification'));
        add_action('wp_ajax_dspn_delete_notification', array($this, 'ajax_delete_notification'));
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_menu_page(
            'Product Notifications',
            'Notifiche Prodotti',
            'manage_options',
            'dspn-notifications',
            array($this, 'admin_page'),
            'dashicons-email-alt',
            30
        );
        
        add_submenu_page(
            'dspn-notifications',
            'Impostazioni',
            'Impostazioni',
            'manage_options',
            'dspn-settings',
            array($this, 'settings_page')
        );
    }
    
    /**
     * Register plugin settings
     */
    public function register_settings() {
        register_setting('dspn_settings', 'dspn_enabled');
        register_setting('dspn_settings', 'dspn_from_email');
        register_setting('dspn_settings', 'dspn_from_name');
        register_setting('dspn_settings', 'dspn_email_template');
    }
    
    /**
     * Enqueue admin assets
     */
    public function enqueue_admin_assets($hook) {
        if (strpos($hook, 'dspn-') === false) {
            return;
        }
        
        wp_enqueue_style('dspn-admin', DSPN_PLUGIN_URL . 'assets/css/admin.css', array(), DSPN_VERSION);
        wp_enqueue_script('dspn-admin', DSPN_PLUGIN_URL . 'assets/js/admin.js', array('jquery'), DSPN_VERSION, true);
        
        wp_localize_script('dspn-admin', 'dspn_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('dspn_nonce')
        ));
    }
    
    /**
     * Main admin page
     */
    public function admin_page() {
        $current_status = $_GET['status'] ?? 'all';
        $paged = $_GET['paged'] ?? 1;
        $notifications = $this->database->get_all_notifications($current_status, 20, ($paged - 1) * 20);
        $total_count = $this->database->get_notification_count($current_status);
        
        ?>
        <div class="wrap">
            <h1>Notifiche Prodotti - Iscrizioni</h1>
            
            <div class="nav-tab-wrapper">
                <a href="?page=dspn-notifications&status=all" class="nav-tab <?php echo $current_status === 'all' ? 'nav-tab-active' : ''; ?>">
                    Tutte (<?php echo $this->database->get_notification_count('all'); ?>)
                </a>
                <a href="?page=dspn-notifications&status=pending" class="nav-tab <?php echo $current_status === 'pending' ? 'nav-tab-active' : ''; ?>">
                    In Attesa (<?php echo $this->database->get_notification_count('pending'); ?>)
                </a>
                <a href="?page=dspn-notifications&status=notified" class="nav-tab <?php echo $current_status === 'notified' ? 'nav-tab-active' : ''; ?>">
                    Inviate (<?php echo $this->database->get_notification_count('notified'); ?>)
                </a>
            </div>
            
            <?php if (empty($notifications)): ?>
                <div class="notice notice-info">
                    <p>Nessuna iscrizione trovata.</p>
                </div>
            <?php else: ?>
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Nome Cliente</th>
                            <th>Prodotto</th>
                            <th>Data Iscrizione</th>
                            <th>Stato</th>
                            <th>Data Notifica</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($notifications as $notification): ?>
                            <tr>
                                <td><?php echo esc_html($notification->email); ?></td>
                                <td><?php echo esc_html($notification->customer_name ?: '-'); ?></td>
                                <td>
                                    <?php if ($notification->product_name): ?>
                                        <a href="<?php echo get_edit_post_link($notification->product_id); ?>" target="_blank">
                                            <?php echo esc_html($notification->product_name); ?>
                                        </a>
                                    <?php else: ?>
                                        Prodotto eliminato (ID: <?php echo $notification->product_id; ?>)
                                    <?php endif; ?>
                                </td>
                                <td><?php echo date_i18n('d/m/Y H:i', strtotime($notification->created_at)); ?></td>
                                <td>
                                    <span class="status-badge status-<?php echo $notification->status; ?>">
                                        <?php 
                                        switch($notification->status) {
                                            case 'pending': echo 'In Attesa'; break;
                                            case 'notified': echo 'Inviata'; break;
                                            case 'cancelled': echo 'Cancellata'; break;
                                        }
                                        ?>
                                    </span>
                                </td>
                                <td><?php echo $notification->notified_at ? date_i18n('d/m/Y H:i', strtotime($notification->notified_at)) : '-'; ?></td>
                                <td>
                                    <?php if ($notification->status === 'pending'): ?>
                                        <button type="button" class="button button-small" onclick="testNotification(<?php echo $notification->product_id; ?>)">
                                            Test
                                        </button>
                                    <?php endif; ?>
                                    <button type="button" class="button button-small button-link-delete" onclick="deleteNotification(<?php echo $notification->id; ?>)">
                                        Elimina
                                    </button>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                
                <?php
                // Pagination
                $total_pages = ceil($total_count / 20);
                if ($total_pages > 1):
                ?>
                <div class="tablenav bottom">
                    <div class="tablenav-pages">
                        <?php
                        echo paginate_links(array(
                            'base' => add_query_arg('paged', '%#%'),
                            'format' => '',
                            'current' => $paged,
                            'total' => $total_pages,
                            'prev_text' => '&laquo; Precedente',
                            'next_text' => 'Successiva &raquo;'
                        ));
                        ?>
                    </div>
                </div>
                <?php endif; ?>
            <?php endif; ?>
        </div>
        
        <script>
        function testNotification(productId) {
            if (confirm('Vuoi inviare una notifica di test per questo prodotto?')) {
                window.location.href = '<?php echo admin_url('admin-post.php'); ?>?action=dspn_test_notification&product_id=' + productId + '&_wpnonce=<?php echo wp_create_nonce('dspn_test'); ?>';
            }
        }
        
        function deleteNotification(notificationId) {
            if (confirm('Sei sicuro di voler eliminare questa iscrizione?')) {
                jQuery.post(ajaxurl, {
                    action: 'dspn_delete_notification',
                    notification_id: notificationId,
                    nonce: '<?php echo wp_create_nonce('dspn_nonce'); ?>'
                }, function(response) {
                    if (response.success) {
                        location.reload();
                    } else {
                        alert('Errore: ' + response.data);
                    }
                });
            }
        }
        </script>
        <?php
    }
    
    /**
     * Settings page
     */
    public function settings_page() {
        ?>
        <div class="wrap">
            <h1>Impostazioni Notifiche Prodotti</h1>
            
            <form method="post" action="options.php">
                <?php
                settings_fields('dspn_settings');
                do_settings_sections('dspn_settings');
                ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row">Plugin Attivo</th>
                        <td>
                            <label>
                                <input type="checkbox" name="dspn_enabled" value="1" <?php checked(get_option('dspn_enabled'), '1'); ?> />
                                Abilita le notifiche prodotti
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Email Mittente</th>
                        <td>
                            <input type="email" name="dspn_from_email" value="<?php echo esc_attr(get_option('dspn_from_email', get_option('admin_email'))); ?>" class="regular-text" />
                            <p class="description">L'indirizzo email da cui verranno inviate le notifiche.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Nome Mittente</th>
                        <td>
                            <input type="text" name="dspn_from_name" value="<?php echo esc_attr(get_option('dspn_from_name', get_bloginfo('name'))); ?>" class="regular-text" />
                            <p class="description">Il nome che apparirà come mittente delle email.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Template Email</th>
                        <td>
                            <?php
                            wp_editor(get_option('dspn_email_template'), 'dspn_email_template', array(
                                'textarea_name' => 'dspn_email_template',
                                'media_buttons' => true,
                                'textarea_rows' => 15
                            ));
                            ?>
                            <p class="description">
                                Placeholder disponibili: {customer_name}, {product_name}, {product_url}, {product_price}, {shop_name}, {shop_url}, {unsubscribe_url}
                            </p>
                        </td>
                    </tr>
                </table>
                
                <?php submit_button('Salva Impostazioni'); ?>
            </form>
        </div>
        <?php
    }
    
    /**
     * Handle test notification
     */
    public function handle_test_notification() {
        if (!current_user_can('manage_options')) {
            wp_die('Accesso negato');
        }
        
        if (!wp_verify_nonce($_GET['_wpnonce'] ?? '', 'dspn_test')) {
            wp_die('Token di sicurezza non valido');
        }
        
        $product_id = intval($_GET['product_id'] ?? 0);
        if (!$product_id) {
            wp_die('ID prodotto non valido');
        }
        
        $stock_monitor = new DSPN_Stock_Monitor();
        $stock_monitor->manual_check_product($product_id);
        
        wp_redirect(add_query_arg(array(
            'page' => 'dspn-notifications',
            'message' => 'test_sent'
        ), admin_url('admin.php')));
        exit;
    }
    
    /**
     * AJAX delete notification
     */
    public function ajax_delete_notification() {
        if (!wp_verify_nonce($_POST['nonce'] ?? '', 'dspn_nonce')) {
            wp_send_json_error('Token di sicurezza non valido');
        }
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Permessi insufficienti');
        }
        
        $notification_id = intval($_POST['notification_id'] ?? 0);
        if (!$notification_id) {
            wp_send_json_error('ID notifica non valido');
        }
        
        $result = $this->database->delete_notification($notification_id);
        
        if ($result) {
            wp_send_json_success('Iscrizione eliminata con successo');
        } else {
            wp_send_json_error('Errore durante l\'eliminazione');
        }
    }
}