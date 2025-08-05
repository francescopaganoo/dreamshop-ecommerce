<?php
/**
 * Admin interface class
 */

if (!defined('ABSPATH')) {
    exit;
}

class DreamShop_Deferred_Shipping_Admin {
    
    private static $instance = null;
    private $db;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        $this->db = DreamShop_Deferred_Shipping_Database::get_instance();
        $this->init_hooks();
    }
    
    private function init_hooks() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        add_action('wp_ajax_deferred_shipping_add_product', array($this, 'ajax_add_product'));
        add_action('wp_ajax_deferred_shipping_remove_product', array($this, 'ajax_remove_product'));
        add_action('wp_ajax_deferred_shipping_update_amount', array($this, 'ajax_update_amount'));
        add_action('wp_ajax_deferred_shipping_create_orders', array($this, 'ajax_create_shipping_orders'));
        add_action('wp_ajax_deferred_shipping_search_products', array($this, 'ajax_search_products'));
        add_action('wp_ajax_deferred_shipping_cleanup_duplicates', array($this, 'ajax_cleanup_duplicates'));
    }
    
    public function add_admin_menu() {
        add_menu_page(
            'Spedizione Posticipata',
            'Spedizione Posticipata',
            'manage_woocommerce',
            'deferred-shipping',
            array($this, 'admin_page'),
            'dashicons-shipping',
            58
        );
    }
    
    public function enqueue_admin_scripts($hook) {
        if ('toplevel_page_deferred-shipping' !== $hook) {
            return;
        }
        
        wp_enqueue_script('jquery');
        
        // Enqueue Select2 from WooCommerce if available, otherwise from CDN
        if (wp_script_is('select2', 'registered')) {
            wp_enqueue_script('select2');
            wp_enqueue_style('select2');
        } else {
            wp_enqueue_script(
                'select2',
                'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js',
                array('jquery'),
                '4.1.0',
                true
            );
            wp_enqueue_style(
                'select2',
                'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css',
                array(),
                '4.1.0'
            );
        }
        
        wp_enqueue_script(
            'deferred-shipping-admin',
            DREAMSHOP_DEFERRED_SHIPPING_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery', 'select2'),
            DREAMSHOP_DEFERRED_SHIPPING_VERSION,
            true
        );
        
        wp_enqueue_style(
            'deferred-shipping-admin',
            DREAMSHOP_DEFERRED_SHIPPING_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            DREAMSHOP_DEFERRED_SHIPPING_VERSION
        );
        
        wp_localize_script('deferred-shipping-admin', 'deferredShipping', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('deferred_shipping_nonce'),
            'strings' => array(
                'confirmRemove' => 'Sei sicuro di voler rimuovere questo prodotto?',
                'confirmCreateOrders' => 'Creare gli ordini di spedizione per tutti i clienti?',
                'success' => 'Operazione completata con successo',
                'error' => 'Si è verificato un errore'
            )
        ));
    }
    
    public function admin_page() {
        $products = $this->db->get_products();
        ?>
        <div class="wrap">
            <h1>Gestione Spedizione Posticipata</h1>
            
            <div class="deferred-shipping-admin">
                <!-- Add Product Section -->
                <div class="card">
                    <h2>Aggiungi Prodotto</h2>
                    <form id="add-product-form">
                        <table class="form-table">
                            <tr>
                                <th scope="row">
                                    <label for="product-select">Seleziona Prodotto</label>
                                </th>
                                <td>
                                    <select id="product-select" name="product_id" style="width: 300px;">
                                        <option value="">Cerca prodotto...</option>
                                    </select>
                                    <p class="description">Cerca e seleziona un prodotto da aggiungere alla lista spedizione posticipata</p>
                                </td>
                            </tr>
                        </table>
                        <p class="submit">
                            <button type="submit" class="button button-primary">Aggiungi Prodotto</button>
                        </p>
                    </form>
                </div>
                
                <!-- Products List -->
                <div class="card">
                    <h2>Prodotti con Spedizione Posticipata</h2>
                    
                    <div style="margin-bottom: 15px;">
                        <button type="button" id="cleanup-duplicates-btn" class="button button-secondary">
                            Pulisci Ordini Duplicati
                        </button>
                        <p class="description">Rimuove eventuali ordini di spedizione duplicati dal database.</p>
                    </div>
                    
                    <?php if (empty($products)): ?>
                        <p>Nessun prodotto configurato per la spedizione posticipata.</p>
                    <?php else: ?>
                        <table class="wp-list-table widefat fixed striped">
                            <thead>
                                <tr>
                                    <th>Prodotto</th>
                                    <th>Stato</th>
                                    <th>Utenti</th>
                                    <th>Importo Spedizione</th>
                                    <th>Data Creazione</th>
                                    <th>Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($products as $product): ?>
                                    <tr data-product-id="<?php echo esc_attr($product->product_id); ?>">
                                        <td>
                                            <strong><?php echo esc_html($product->product_name); ?></strong>
                                            <br><small>ID: <?php echo esc_html($product->product_id); ?></small>
                                        </td>
                                        <td>
                                            <span class="status-badge status-<?php echo esc_attr($product->status); ?>">
                                                <?php echo $product->status === 'pending' ? 'In Attesa' : 'Calcolato'; ?>
                                            </span>
                                        </td>
                                        <td>
                                            <span class="customer-count">
                                                <strong><?php echo intval($product->customer_count); ?></strong>
                                                <?php echo intval($product->customer_count) === 1 ? 'utente' : 'utenti'; ?>
                                            </span>
                                        </td>
                                        <td>
                                            <?php if ($product->status === 'pending'): ?>
                                                <div class="shipping-amount-form">
                                                    <input type="number" 
                                                           step="0.01" 
                                                           min="0" 
                                                           class="shipping-amount-input" 
                                                           placeholder="0.00"
                                                           data-product-id="<?php echo esc_attr($product->product_id); ?>">
                                                    <button type="button" 
                                                            class="button button-small update-amount-btn"
                                                            data-product-id="<?php echo esc_attr($product->product_id); ?>">
                                                        Salva
                                                    </button>
                                                </div>
                                            <?php else: ?>
                                                <strong>€<?php echo number_format($product->shipping_amount, 2); ?></strong>
                                                <br>
                                                <button type="button" 
                                                        class="button button-small create-orders-btn"
                                                        data-product-id="<?php echo esc_attr($product->product_id); ?>"
                                                        data-amount="<?php echo esc_attr($product->shipping_amount); ?>">
                                                    Crea Ordini Spedizione
                                                </button>
                                            <?php endif; ?>
                                        </td>
                                        <td>
                                            <?php echo date('d/m/Y H:i', strtotime($product->created_at)); ?>
                                        </td>
                                        <td>
                                            <button type="button" 
                                                    class="button button-small remove-product-btn"
                                                    data-product-id="<?php echo esc_attr($product->product_id); ?>">
                                                Rimuovi
                                            </button>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php endif; ?>
                </div>
            </div>
        </div>
        <?php
    }
    
    public function ajax_add_product() {
        check_ajax_referer('deferred_shipping_nonce', 'nonce');
        
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized');
        }
        
        $product_id = intval($_POST['product_id']);
        
        if (!$product_id) {
            wp_send_json_error('ID prodotto non valido');
        }
        
        // Check if product exists and is published
        $product = wc_get_product($product_id);
        if (!$product || $product->get_status() !== 'publish') {
            wp_send_json_error('Prodotto non trovato o non pubblicato');
        }
        
        // Check if already exists
        if ($this->db->is_deferred_shipping_product($product_id)) {
            wp_send_json_error('Prodotto già presente nella lista');
        }
        
        $result = $this->db->add_product($product_id);
        
        if ($result) {
            wp_send_json_success('Prodotto aggiunto con successo');
        } else {
            wp_send_json_error('Errore durante l\'aggiunta del prodotto');
        }
    }
    
    public function ajax_remove_product() {
        check_ajax_referer('deferred_shipping_nonce', 'nonce');
        
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized');
        }
        
        $product_id = intval($_POST['product_id']);
        
        $result = $this->db->remove_product($product_id);
        
        if ($result) {
            wp_send_json_success('Prodotto rimosso con successo');
        } else {
            wp_send_json_error('Errore durante la rimozione del prodotto');
        }
    }
    
    public function ajax_update_amount() {
        check_ajax_referer('deferred_shipping_nonce', 'nonce');
        
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized');
        }
        
        $product_id = intval($_POST['product_id']);
        $amount = floatval($_POST['amount']);
        
        if (!$product_id || $amount < 0) {
            wp_send_json_error('Dati non validi');
        }
        
        $result = $this->db->update_shipping_amount($product_id, $amount);
        
        if ($result) {
            wp_send_json_success('Importo aggiornato con successo');
        } else {
            wp_send_json_error('Errore durante l\'aggiornamento');
        }
    }
    
    public function ajax_create_shipping_orders() {
        check_ajax_referer('deferred_shipping_nonce', 'nonce');
        
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized');
        }
        
        $product_id = intval($_POST['product_id']);
        $amount = floatval($_POST['amount']);
        
        // Get orders that need shipping notification
        $orders = $this->db->get_orders_for_notification($product_id);
        
        if (empty($orders)) {
            wp_send_json_error('Nessun ordine trovato per questo prodotto');
        }
        
        $created_count = 0;
        $orders_handler = DreamShop_Deferred_Shipping_Orders::get_instance();
        
        foreach ($orders as $order_data) {
            $result = $orders_handler->create_shipping_order(
                $order_data->ID,
                $product_id,
                $order_data->customer_id,
                $amount
            );
            
            if ($result) {
                $created_count++;
            }
        }
        
        if ($created_count > 0) {
            wp_send_json_success("Creati $created_count ordini di spedizione");
        } else {
            wp_send_json_error('Errore durante la creazione degli ordini');
        }
    }
    
    public function ajax_search_products() {
        check_ajax_referer('deferred_shipping_nonce', 'nonce');
        
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized');
        }
        
        $term = isset($_GET['term']) ? sanitize_text_field($_GET['term']) : '';
        
        if (strlen($term) < 2) {
            wp_send_json_error('Term too short');
        }
        
        $args = array(
            'post_type' => 'product',
            'post_status' => 'publish',
            'posts_per_page' => 20,
            's' => $term
        );
        
        $products = get_posts($args);
        $results = array();
        
        if (!empty($products)) {
            foreach ($products as $product) {
                $product_obj = wc_get_product($product->ID);
                if ($product_obj && $product_obj->is_visible()) {
                    $results[] = array(
                        'id' => $product->ID,
                        'text' => sprintf('%s (#%d)', $product->post_title, $product->ID)
                    );
                }
            }
        }
        
        wp_send_json_success($results);
    }
    
    public function ajax_cleanup_duplicates() {
        check_ajax_referer('deferred_shipping_nonce', 'nonce');
        
        if (!current_user_can('manage_woocommerce')) {
            wp_die('Unauthorized');
        }
        
        $cleaned = $this->db->cleanup_duplicate_orders();
        
        if ($cleaned > 0) {
            wp_send_json_success("Rimossi $cleaned ordini duplicati");
        } else {
            wp_send_json_success('Nessun ordine duplicato trovato');
        }
    }
}