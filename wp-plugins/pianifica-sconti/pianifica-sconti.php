<?php
/**
 * Plugin Name: WooCommerce Pianifica Sconto - Modifica Rapida
 * Plugin URI: https://yourwebsite.com
 * Description: Aggiunge la funzionalità "Pianifica sconto" alla modifica rapida dei prodotti WooCommerce
 * Version: 1.0.2
 * Author: Plan Studios Group FP
 * Author URI: https://yourwebsite.com
 * Text Domain: wc-schedule-sale-quick-edit
 * Domain Path: /languages
 * Requires at least: 5.0
 * Tested up to: 6.4
 * WC requires at least: 5.0
 * WC tested up to: 8.5
 * Requires PHP: 7.4
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Network: false
 */

// Previeni accesso diretto
if (!defined('ABSPATH')) {
    exit('Direct access denied.');
}

// Definisci costanti del plugin
define('WC_SCHEDULE_SALE_QE_VERSION', '1.0.2');
define('WC_SCHEDULE_SALE_QE_PLUGIN_FILE', __FILE__);
define('WC_SCHEDULE_SALE_QE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WC_SCHEDULE_SALE_QE_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WC_SCHEDULE_SALE_QE_PLUGIN_BASENAME', plugin_basename(__FILE__));

// Verifica se WooCommerce è attivo
if (!in_array('woocommerce/woocommerce.php', apply_filters('active_plugins', get_option('active_plugins')))) {
    return;
}

// Dichiarazione compatibilità con funzionalità WooCommerce
add_action('before_woocommerce_init', function() {
    if (class_exists('\Automattic\WooCommerce\Utilities\FeaturesUtil')) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('cart_checkout_blocks', __FILE__, true);
    }
});

/**
 * Classe principale del plugin
 */
class WC_Schedule_Sale_Quick_Edit {
    
    /**
     * Istanza singola del plugin
     */
    private static $instance = null;
    
    /**
     * Array per memorizzare i dati dei prodotti
     */
    private $products_data = array();
    
    /**
     * Flag per verificare se gli script sono stati caricati
     */
    private $scripts_loaded = false;
    
    /**
     * Costruttore
     */
    public function __construct() {
        // Hook per verificare dipendenze prima dell'inizializzazione
        add_action('plugins_loaded', array($this, 'check_dependencies'));
        add_action('init', array($this, 'init'));
        
        // Hook per l'attivazione e disattivazione
        register_activation_hook(__FILE__, array($this, 'on_activation'));
        register_deactivation_hook(__FILE__, array($this, 'on_deactivation'));
    }
    
    /**
     * Ottieni l'istanza singola del plugin
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Verifica le dipendenze del plugin
     */
    public function check_dependencies() {
        if (!class_exists('WooCommerce')) {
            add_action('admin_notices', array($this, 'woocommerce_missing_notice'));
            return false;
        }
        
        // Verifica versione WooCommerce
        if (defined('WC_VERSION') && version_compare(WC_VERSION, '5.0', '<')) {
            add_action('admin_notices', array($this, 'woocommerce_version_notice'));
            return false;
        }
        
        // Verifica versione PHP
        if (version_compare(PHP_VERSION, '7.4', '<')) {
            add_action('admin_notices', array($this, 'php_version_notice'));
            return false;
        }
        
        return true;
    }
    
    /**
     * Mostra avviso se WooCommerce non è presente
     */
    public function woocommerce_missing_notice() {
        ?>
        <div class="notice notice-error is-dismissible">
            <p>
                <strong><?php _e('WooCommerce Pianifica Sconto - Modifica Rapida', 'wc-schedule-sale-quick-edit'); ?></strong>
            </p>
            <p>
                <?php _e('Questo plugin richiede WooCommerce per funzionare. Per favore installa e attiva WooCommerce.', 'wc-schedule-sale-quick-edit'); ?>
            </p>
        </div>
        <?php
    }
    
    /**
     * Mostra avviso per versione WooCommerce non supportata
     */
    public function woocommerce_version_notice() {
        ?>
        <div class="notice notice-warning is-dismissible">
            <p>
                <strong><?php _e('WooCommerce Pianifica Sconto - Modifica Rapida', 'wc-schedule-sale-quick-edit'); ?></strong>
            </p>
            <p>
                <?php 
                printf(
                    __('Questo plugin richiede WooCommerce 5.0 o superiore. Versione attuale: %s', 'wc-schedule-sale-quick-edit'),
                    defined('WC_VERSION') ? WC_VERSION : 'sconosciuta'
                ); 
                ?>
            </p>
        </div>
        <?php
    }
    
    /**
     * Mostra avviso per versione PHP non supportata
     */
    public function php_version_notice() {
        ?>
        <div class="notice notice-error is-dismissible">
            <p>
                <strong><?php _e('WooCommerce Pianifica Sconto - Modifica Rapida', 'wc-schedule-sale-quick-edit'); ?></strong>
            </p>
            <p>
                <?php 
                printf(
                    __('Questo plugin richiede PHP 7.4 o superiore. Versione attuale: %s', 'wc-schedule-sale-quick-edit'),
                    PHP_VERSION
                ); 
                ?>
            </p>
        </div>
        <?php
    }
    
    /**
     * Inizializzazione del plugin
     */
    public function init() {
        // Verifica nuovamente che WooCommerce sia disponibile
        if (!$this->check_dependencies()) {
            return;
        }
        
        // Carica le traduzioni
        add_action('plugins_loaded', array($this, 'load_textdomain'));
        
        // Hook per aggiungere i campi alla modifica rapida
        add_action('woocommerce_product_quick_edit_end', array($this, 'add_quick_edit_fields'));
        
        // Hook per salvare i dati della modifica rapida
        add_action('woocommerce_product_quick_edit_save', array($this, 'save_quick_edit_fields'));
        
        // Hook per popolare i campi con i dati esistenti
        add_action('manage_product_posts_custom_column', array($this, 'add_custom_column_data'), 10, 2);
        
        // Hook alternativo per assicurarsi che i dati vengano sempre aggiunti
        add_action('admin_footer', array($this, 'add_product_data_to_footer'));
        
        // Aggiungere gli script necessari
        add_action('admin_enqueue_scripts', array($this, 'enqueue_scripts'));
        
        // Hook per supporto HPOS
        add_action('woocommerce_init', array($this, 'hpos_compatibility_init'));
        
        // AJAX handler per recuperare i dati del prodotto
        add_action('wp_ajax_get_product_schedule_sale_data', array($this, 'ajax_get_product_schedule_sale_data'));
        
        // Hook per aggiungere link alle impostazioni
        add_filter('plugin_action_links_' . WC_SCHEDULE_SALE_QE_PLUGIN_BASENAME, array($this, 'add_plugin_action_links'));
        
        // Hook per informazioni plugin
        add_filter('plugin_row_meta', array($this, 'add_plugin_row_meta'), 10, 2);
    }
    
    /**
     * Carica le traduzioni
     */
    public function load_textdomain() {
        load_plugin_textdomain(
            'wc-schedule-sale-quick-edit',
            false,
            dirname(WC_SCHEDULE_SALE_QE_PLUGIN_BASENAME) . '/languages/'
        );
    }
    
    /**
     * Inizializzazione compatibilità HPOS
     */
    public function hpos_compatibility_init() {
        // Il plugin lavora principalmente con i prodotti (posts), 
        // quindi è naturalmente compatibile con HPOS
        // Qui possiamo aggiungere eventuali hook specifici per HPOS se necessari in futuro
        $this->log('HPOS compatibility initialized');
    }
    
    /**
     * Aggiunge i campi per pianificare lo sconto nella modifica rapida
     */
    public function add_quick_edit_fields() {
        // Verifica che siamo nella pagina corretta
        global $current_screen;
        if (!$current_screen || $current_screen->id !== 'edit-product') {
            return;
        }
        
        ?>
        <br class="clear" />
        
        <!-- Contenitore principale per la pianificazione sconto -->
        <div class="wc-schedule-sale-container">
            <span class="title"><?php _e('⏰ Pianifica Sconto', 'wc-schedule-sale-quick-edit'); ?></span>
            
            <!-- Campo prezzo scontato -->
            <div class="inline-edit-group">
                <label class="alignleft">
                    <span class="title"><?php _e('💰 Prezzo Scontato', 'wc-schedule-sale-quick-edit'); ?></span>
                    <span class="input-text-wrap">
                        <input 
                            type="number" 
                            name="_sale_price_quick" 
                            class="text sale_price" 
                            placeholder="<?php esc_attr_e('0.00', 'wc-schedule-sale-quick-edit'); ?>" 
                            step="0.01" 
                            min="0"
                            value="" 
                        />
                        <span class="wc-schedule-sale-help"><?php _e('Inserisci il prezzo scontato (es: 19.99)', 'wc-schedule-sale-quick-edit'); ?></span>
                    </span>
                </label>
            </div>
            
            <!-- Campo data inizio sconto -->
            <div class="inline-edit-group">
                <label class="alignleft">
                    <span class="title"><?php _e('🚀 Inizio Sconto', 'wc-schedule-sale-quick-edit'); ?></span>
                    <span class="input-text-wrap">
                        <input 
                            type="datetime-local" 
                            name="_sale_price_dates_from_quick" 
                            class="text" 
                            value="" 
                        />
                        <span class="wc-schedule-sale-help"><?php _e('Data e ora di inizio dello sconto', 'wc-schedule-sale-quick-edit'); ?></span>
                    </span>
                </label>
            </div>
            
            <!-- Campo data fine sconto -->
            <div class="inline-edit-group">
                <label class="alignleft">
                    <span class="title"><?php _e('🏁 Fine Sconto', 'wc-schedule-sale-quick-edit'); ?></span>
                    <span class="input-text-wrap">
                        <input 
                            type="datetime-local" 
                            name="_sale_price_dates_to_quick" 
                            class="text" 
                            value="" 
                        />
                        <span class="wc-schedule-sale-help"><?php _e('Data e ora di fine dello sconto', 'wc-schedule-sale-quick-edit'); ?></span>
                    </span>
                </label>
            </div>
            
            <!-- Separatore -->
            <div class="wc-schedule-sale-divider"></div>
            
            <!-- Checkbox per cancellare pianificazione -->
            <div class="inline-edit-group">
                <label class="alignleft">
                    <span class="input-text-wrap">
                        <input type="checkbox" name="_clear_sale_schedule_quick" id="clear_sale_schedule" value="1" />
                        <label for="clear_sale_schedule"><?php _e('🗑️ Cancella pianificazione sconto esistente', 'wc-schedule-sale-quick-edit'); ?></label>
                        <span class="wc-schedule-sale-help"><?php _e('Spunta per rimuovere completamente la pianificazione sconto', 'wc-schedule-sale-quick-edit'); ?></span>
                    </span>
                </label>
            </div>
        </div>
        
        <?php
    }
    
    /**
     * Salva i dati della pianificazione sconto dalla modifica rapida
     */
    public function save_quick_edit_fields($product) {
        $product_id = $product->get_id();
        
        $this->log("Tentativo di salvare dati per prodotto: $product_id");
        
        // Verifica nonce per sicurezza (migliore gestione del nonce)
        $nonce_field = isset($_POST['woocommerce_quick_edit_nonce']) ? sanitize_text_field($_POST['woocommerce_quick_edit_nonce']) : '';
        if (empty($nonce_field) || !wp_verify_nonce($nonce_field, 'woocommerce_quick_edit_nonce')) {
            $this->log("Verifica nonce fallita per prodotto: $product_id");
            return;
        }
        
        // Verifica permessi utente
        if (!current_user_can('edit_product', $product_id)) {
            $this->log("Permessi insufficienti per prodotto: $product_id");
            return;
        }
        
        // Se è selezionato "Cancella pianificazione sconto"
        if (isset($_POST['_clear_sale_schedule_quick']) && $_POST['_clear_sale_schedule_quick'] == '1') {
            $product->set_sale_price('');
            $product->set_date_on_sale_from('');
            $product->set_date_on_sale_to('');
            $product->save();
            
            $this->log("Pianificazione sconto cancellata per prodotto: $product_id");
            
            // Mostra messaggio di successo
            add_action('admin_notices', function() {
                echo '<div class="notice notice-success is-dismissible"><p>' . 
                     __('Pianificazione sconto cancellata con successo.', 'wc-schedule-sale-quick-edit') . 
                     '</p></div>';
            });
            
            return;
        }
        
        $changes_made = false;
        $errors = array();
        
        // Salva il prezzo scontato
        if (isset($_POST['_sale_price_quick']) && !empty($_POST['_sale_price_quick'])) {
            $sale_price = sanitize_text_field($_POST['_sale_price_quick']);
            $sale_price_clean = wc_format_decimal($sale_price);
            
            if ($sale_price_clean > 0) {
                // Verifica che il prezzo scontato sia inferiore al prezzo regolare
                $regular_price = $product->get_regular_price();
                if ($regular_price && $sale_price_clean >= floatval($regular_price)) {
                    $errors[] = __('Il prezzo scontato deve essere inferiore al prezzo regolare.', 'wc-schedule-sale-quick-edit');
                } else {
                    $product->set_sale_price($sale_price_clean);
                    $changes_made = true;
                    $this->log("Prezzo scontato impostato: $sale_price_clean per prodotto: $product_id");
                }
            }
        }
        
        // Salva la data di inizio sconto
        $date_from_set = false;
        if (isset($_POST['_sale_price_dates_from_quick']) && !empty($_POST['_sale_price_dates_from_quick'])) {
            $date_from = sanitize_text_field($_POST['_sale_price_dates_from_quick']);
            $timestamp_from = strtotime($date_from);
            
            if ($timestamp_from && $timestamp_from > 0) {
                $product->set_date_on_sale_from($timestamp_from);
                $date_from_set = true;
                $changes_made = true;
                $this->log("Data inizio sconto impostata: $date_from per prodotto: $product_id");
            } else {
                $errors[] = __('Formato data di inizio non valido.', 'wc-schedule-sale-quick-edit');
            }
        }
        
        // Salva la data di fine sconto
        if (isset($_POST['_sale_price_dates_to_quick']) && !empty($_POST['_sale_price_dates_to_quick'])) {
            $date_to = sanitize_text_field($_POST['_sale_price_dates_to_quick']);
            $timestamp_to = strtotime($date_to);
            
            if ($timestamp_to && $timestamp_to > 0) {
                // Verifica che la data di fine sia successiva alla data di inizio
                if ($date_from_set) {
                    $timestamp_from = strtotime($_POST['_sale_price_dates_from_quick']);
                    if ($timestamp_to <= $timestamp_from) {
                        $errors[] = __('La data di fine sconto deve essere successiva alla data di inizio.', 'wc-schedule-sale-quick-edit');
                    } else {
                        $product->set_date_on_sale_to($timestamp_to);
                        $changes_made = true;
                        $this->log("Data fine sconto impostata: $date_to per prodotto: $product_id");
                    }
                } else {
                    $product->set_date_on_sale_to($timestamp_to);
                    $changes_made = true;
                    $this->log("Data fine sconto impostata: $date_to per prodotto: $product_id");
                }
            } else {
                $errors[] = __('Formato data di fine non valido.', 'wc-schedule-sale-quick-edit');
            }
        }
        
        // Salva il prodotto solo se ci sono stati cambiamenti
        if ($changes_made && empty($errors)) {
            $product->save();
            $this->log("Prodotto $product_id salvato con successo");
            
            // Mostra messaggio di successo
            add_action('admin_notices', function() {
                echo '<div class="notice notice-success is-dismissible"><p>' . 
                     __('Pianificazione sconto aggiornata con successo.', 'wc-schedule-sale-quick-edit') . 
                     '</p></div>';
            });
            
        } elseif (!empty($errors)) {
            // Mostra errori
            $this->log("Errori nel salvataggio prodotto $product_id: " . implode(', ', $errors));
            
            add_action('admin_notices', function() use ($errors) {
                foreach ($errors as $error) {
                    echo '<div class="notice notice-error is-dismissible"><p>' . esc_html($error) . '</p></div>';
                }
            });
        }
    }
    
    /**
     * Aggiunge i dati personalizzati alla colonna per la modifica rapida
     */
    public function add_custom_column_data($column, $post_id) {
        // Aggiungiamo i dati alla colonna 'name' che è sempre presente
        if ($column == 'name') {
            $product = wc_get_product($post_id);
            if ($product) {
                $sale_price = $product->get_sale_price();
                $date_from = $product->get_date_on_sale_from();
                $date_to = $product->get_date_on_sale_to();
                
                // Memorizza i dati per uso successivo
                $this->products_data[$post_id] = array(
                    'sale_price' => $sale_price,
                    'date_from' => $date_from,
                    'date_to' => $date_to
                );
                
                // Formatta le date per l'input datetime-local
                $date_from_formatted = '';
                $date_to_formatted = '';
                
                if ($date_from && is_a($date_from, 'WC_DateTime')) {
                    try {
                        $date_from_formatted = $date_from->date('Y-m-d\TH:i');
                    } catch (Exception $e) {
                        $this->log("Errore formattazione data_from per prodotto $post_id: " . $e->getMessage());
                    }
                }
                
                if ($date_to && is_a($date_to, 'WC_DateTime')) {
                    try {
                        $date_to_formatted = $date_to->date('Y-m-d\TH:i');
                    } catch (Exception $e) {
                        $this->log("Errore formattazione date_to per prodotto $post_id: " . $e->getMessage());
                    }
                }
                
                // Renderizza i dati nascosti solo se ha almeno un dato di sconto
                if ($sale_price || $date_from_formatted || $date_to_formatted) {
                    echo '<div class="hidden wc-schedule-sale-data" id="wc_schedule_sale_data_' . esc_attr($post_id) . '" style="display:none !important;">';
                    echo '<span class="sale_price">' . esc_attr($sale_price) . '</span>';
                    echo '<span class="sale_date_from">' . esc_attr($date_from_formatted) . '</span>';
                    echo '<span class="sale_date_to">' . esc_attr($date_to_formatted) . '</span>';
                    echo '</div>';
                }
            }
        }
    }
    
    /**
     * Aggiunge i dati prodotto nel footer come fallback
     */
    public function add_product_data_to_footer() {
        global $current_screen;
        
        // Solo nella pagina dei prodotti
        if (!$current_screen || $current_screen->id !== 'edit-product') {
            return;
        }
        
        // Ottieni tutti i prodotti con sconti pianificati nella pagina corrente
        global $wp_query;
        
        if (!$wp_query || !isset($wp_query->posts)) {
            return;
        }
        
        $products_with_sales = array();
        
        foreach ($wp_query->posts as $post) {
            if ($post->post_type !== 'product') {
                continue;
            }
            
            $product = wc_get_product($post->ID);
            if (!$product) {
                continue;
            }
            
            $sale_price = $product->get_sale_price();
            $date_from = $product->get_date_on_sale_from();
            $date_to = $product->get_date_on_sale_to();
            
            // Solo se ha almeno un dato di sconto
            if ($sale_price || $date_from || $date_to) {
                $date_from_formatted = '';
                $date_to_formatted = '';
                
                if ($date_from && is_a($date_from, 'WC_DateTime')) {
                    try {
                        $date_from_formatted = $date_from->date('Y-m-d\TH:i');
                    } catch (Exception $e) {
                        $this->log("Errore formattazione data_from nel footer per prodotto {$post->ID}: " . $e->getMessage());
                    }
                }
                
                if ($date_to && is_a($date_to, 'WC_DateTime')) {
                    try {
                        $date_to_formatted = $date_to->date('Y-m-d\TH:i');
                    } catch (Exception $e) {
                        $this->log("Errore formattazione date_to nel footer per prodotto {$post->ID}: " . $e->getMessage());
                    }
                }
                
                $products_with_sales[$post->ID] = array(
                    'sale_price' => $sale_price ?: '',
                    'sale_date_from' => $date_from_formatted,
                    'sale_date_to' => $date_to_formatted
                );
            }
        }
        
        if (empty($products_with_sales)) {
            return;
        }
        
        ?>
        <script type="text/javascript">
        /* WC Schedule Sale Quick Edit - Data Fallback */
        window.wcScheduleSaleData = window.wcScheduleSaleData || {};
        <?php foreach ($products_with_sales as $product_id => $data): ?>
        window.wcScheduleSaleData[<?php echo intval($product_id); ?>] = {
            sale_price: "<?php echo esc_js($data['sale_price']); ?>",
            sale_date_from: "<?php echo esc_js($data['sale_date_from']); ?>",
            sale_date_to: "<?php echo esc_js($data['sale_date_to']); ?>"
        };
        <?php endforeach; ?>
        console.log('WC Schedule Sale Quick Edit: Dati footer caricati per ' + Object.keys(window.wcScheduleSaleData).length + ' prodotti');
        </script>
        <?php
    }
    
    /**
     * AJAX handler per recuperare i dati di pianificazione sconto
     */
    public function ajax_get_product_schedule_sale_data() {
        // Verifica che sia una richiesta AJAX
        if (!wp_doing_ajax()) {
            wp_die('Invalid request');
        }
        
        // Verifica nonce
        $nonce = isset($_POST['nonce']) ? sanitize_text_field($_POST['nonce']) : '';
        if (empty($nonce) || !wp_verify_nonce($nonce, 'woocommerce_quick_edit_nonce')) {
            wp_send_json_error('Nonce verification failed');
        }
        
        $product_id = isset($_POST['product_id']) ? intval($_POST['product_id']) : 0;
        
        if (!$product_id) {
            wp_send_json_error('Invalid product ID');
        }
        
        // Verifica permessi
        if (!current_user_can('edit_product', $product_id)) {
            wp_send_json_error('Permission denied');
        }
        
        $product = wc_get_product($product_id);
        if (!$product) {
            wp_send_json_error('Product not found');
        }
        
        $sale_price = $product->get_sale_price();
        $date_from = $product->get_date_on_sale_from();
        $date_to = $product->get_date_on_sale_to();
        
        // Formatta le date per l'input datetime-local
        $date_from_formatted = '';
        $date_to_formatted = '';
        
        if ($date_from && is_a($date_from, 'WC_DateTime')) {
            try {
                $date_from_formatted = $date_from->date('Y-m-d\TH:i');
            } catch (Exception $e) {
                $this->log("Errore AJAX formattazione data_from per prodotto $product_id: " . $e->getMessage());
            }
        }
        
        if ($date_to && is_a($date_to, 'WC_DateTime')) {
            try {
                $date_to_formatted = $date_to->date('Y-m-d\TH:i');
            } catch (Exception $e) {
                $this->log("Errore AJAX formattazione date_to per prodotto $product_id: " . $e->getMessage());
            }
        }
        
        $this->log("AJAX: Dati inviati per prodotto $product_id - Prezzo: $sale_price, Da: $date_from_formatted, A: $date_to_formatted");
        
        wp_send_json_success(array(
            'sale_price' => $sale_price ?: '',
            'sale_date_from' => $date_from_formatted,
            'sale_date_to' => $date_to_formatted,
            'product_id' => $product_id
        ));
    }
    
    /**
     * Carica gli script JavaScript necessari
     */
    public function enqueue_scripts($hook) {
        // Solo nella pagina di modifica prodotti
        if ($hook !== 'edit.php' || !isset($_GET['post_type']) || $_GET['post_type'] !== 'product') {
            return;
        }
        
        $this->scripts_loaded = true;
        
        // JavaScript
        wp_enqueue_script(
            'wc-schedule-sale-quick-edit',
            WC_SCHEDULE_SALE_QE_PLUGIN_URL . 'assets/js/quick-edit.js',
            array('jquery', 'inline-edit-post'),
            WC_SCHEDULE_SALE_QE_VERSION,
            true
        );
        
        // CSS
        wp_enqueue_style(
            'wc-schedule-sale-quick-edit-style',
            WC_SCHEDULE_SALE_QE_PLUGIN_URL . 'assets/css/quick-edit.css',
            array(),
            WC_SCHEDULE_SALE_QE_VERSION
        );
        
        // Localizzazione per JavaScript
        wp_localize_script('wc-schedule-sale-quick-edit', 'wcScheduleSaleQE', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('woocommerce_quick_edit_nonce'),
            'strings' => array(
                'date_validation_error' => __('La data di fine sconto deve essere successiva alla data di inizio.', 'wc-schedule-sale-quick-edit'),
                'price_validation_error' => __('Il prezzo scontato deve essere inferiore al prezzo regolare.', 'wc-schedule-sale-quick-edit'),
                'loading' => __('Caricamento...', 'wc-schedule-sale-quick-edit'),
                'success' => __('Salvato con successo!', 'wc-schedule-sale-quick-edit'),
                'error' => __('Errore nel salvataggio', 'wc-schedule-sale-quick-edit')
            ),
            'debug' => defined('WP_DEBUG') && WP_DEBUG
        ));
        
        $this->log("Script e stili caricati per la pagina prodotti");
    }
    
    /**
     * Aggiunge link alle azioni del plugin
     */
    public function add_plugin_action_links($links) {
        $settings_link = array(
            '<a href="' . admin_url('edit.php?post_type=product') . '">' . __('Prodotti', 'wc-schedule-sale-quick-edit') . '</a>',
        );
        return array_merge($settings_link, $links);
    }
    
    /**
     * Aggiunge meta informazioni al plugin
     */
    public function add_plugin_row_meta($links, $file) {
        if (WC_SCHEDULE_SALE_QE_PLUGIN_BASENAME === $file) {
            $row_meta = array(
                'docs' => '<a href="https://github.com/yourrepo/wc-schedule-sale-quick-edit" target="_blank">' . __('Documentazione', 'wc-schedule-sale-quick-edit') . '</a>',
                'support' => '<a href="https://github.com/yourrepo/wc-schedule-sale-quick-edit/issues" target="_blank">' . __('Supporto', 'wc-schedule-sale-quick-edit') . '</a>',
            );
            return array_merge($links, $row_meta);
        }
        return $links;
    }
    
    /**
     * Funzione di logging per debug
     */
    private function log($message, $level = 'info') {
        if (defined('WP_DEBUG') && WP_DEBUG && defined('WP_DEBUG_LOG') && WP_DEBUG_LOG) {
            $timestamp = current_time('Y-m-d H:i:s');
            $log_message = "[{$timestamp}] WC Schedule Sale Quick Edit [{$level}]: {$message}";
            error_log($log_message);
        }
    }
    
    /**
     * Funzione chiamata all'attivazione del plugin
     */
    public function on_activation() {
        $this->log("Plugin attivato - Versione: " . WC_SCHEDULE_SALE_QE_VERSION);
        
        // Verifica dipendenze all'attivazione
        if (!$this->check_dependencies()) {
            return;
        }
        
        // Crea le opzioni del plugin se non esistono
        $default_options = array(
            'version' => WC_SCHEDULE_SALE_QE_VERSION,
            'activated_time' => current_time('timestamp'),
            'debug_mode' => false
        );
        
        add_option('wc_schedule_sale_qe_options', $default_options);
        
        // Flush rewrite rules se necessario (per eventuali endpoint personalizzati futuri)
        flush_rewrite_rules();
    }
    
    /**
     * Funzione chiamata alla disattivazione del plugin
     */
    public function on_deactivation() {
        $this->log("Plugin disattivato");
        
        // Flush rewrite rules
        flush_rewrite_rules();
        
        // Non cancelliamo le opzioni in caso di riattivazione
        // delete_option('wc_schedule_sale_qe_options');
    }
    
    /**
     * Metodo per ottenere le opzioni del plugin
     */
    public function get_option($key, $default = null) {
        $options = get_option('wc_schedule_sale_qe_options', array());
        return isset($options[$key]) ? $options[$key] : $default;
    }
    
    /**
     * Metodo per impostare le opzioni del plugin
     */
    public function update_option($key, $value) {
        $options = get_option('wc_schedule_sale_qe_options', array());
        $options[$key] = $value;
        return update_option('wc_schedule_sale_qe_options', $options);
    }
    
    /**
     * Verifica se gli script sono stati caricati
     */
    public function are_scripts_loaded() {
        return $this->scripts_loaded;
    }
    
    /**
     * Ottieni informazioni sui prodotti caricati
     */
    public function get_products_data() {
        return $this->products_data;
    }
    
    /**
     * Pulisce i dati dei prodotti (utile per test)
     */
    public function clear_products_data() {
        $this->products_data = array();
    }
    
    /**
     * Metodo statico per ottenere la versione del plugin
     */
    public static function get_version() {
        return WC_SCHEDULE_SALE_QE_VERSION;
    }
    
    /**
     * Metodo per verificare se WooCommerce HPOS è attivo
     */
    public function is_hpos_enabled() {
        return class_exists('\Automattic\WooCommerce\Utilities\OrderUtil') && 
               \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
    }
    
    /**
     * Metodo per gestire upgrade/downgrade del plugin
     */
    public function check_version_upgrade() {
        $current_version = $this->get_option('version', '0.0.0');
        
        if (version_compare($current_version, WC_SCHEDULE_SALE_QE_VERSION, '<')) {
            $this->log("Aggiornamento da versione $current_version a " . WC_SCHEDULE_SALE_QE_VERSION);
            
            // Qui possiamo aggiungere logica di migrazione per versioni future
            $this->perform_version_upgrade($current_version);
            
            // Aggiorna la versione salvata
            $this->update_option('version', WC_SCHEDULE_SALE_QE_VERSION);
        }
    }
    
    /**
     * Esegue operazioni di aggiornamento specifiche per versione
     */
    private function perform_version_upgrade($from_version) {
        // Esempio di migrazione per versioni future:
        /*
        if (version_compare($from_version, '1.1.0', '<')) {
            // Migrazioni per versione 1.1.0
        }
        
        if (version_compare($from_version, '2.0.0', '<')) {
            // Migrazioni per versione 2.0.0
        }
        */
        
        $this->log("Operazioni di aggiornamento completate da $from_version a " . WC_SCHEDULE_SALE_QE_VERSION);
    }
}

// Inizializza il plugin
add_action('plugins_loaded', function() {
    WC_Schedule_Sale_Quick_Edit::get_instance();
});

/**
 * Funzione di attivazione del plugin
 */
register_activation_hook(__FILE__, 'wc_schedule_sale_quick_edit_activate');
function wc_schedule_sale_quick_edit_activate() {
    // Verifica versione PHP
    if (version_compare(PHP_VERSION, '7.4', '<')) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die(
            __('Questo plugin richiede PHP 7.4 o superiore.', 'wc-schedule-sale-quick-edit') . 
            '<br>' . 
            sprintf(__('Versione PHP attuale: %s', 'wc-schedule-sale-quick-edit'), PHP_VERSION),
            __('Errore di Attivazione Plugin', 'wc-schedule-sale-quick-edit'),
            array('back_link' => true)
        );
    }
    
    // Verifica se WooCommerce è attivo
    if (!class_exists('WooCommerce')) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die(
            __('Questo plugin richiede WooCommerce per funzionare.', 'wc-schedule-sale-quick-edit') . 
            '<br><a href="' . admin_url('plugin-install.php?tab=plugin-information&plugin=woocommerce') . '">' . 
            __('Installa WooCommerce', 'wc-schedule-sale-quick-edit') . '</a>',
            __('Errore di Attivazione Plugin', 'wc-schedule-sale-quick-edit'),
            array('back_link' => true)
        );
    }
    
    // Verifica versione WooCommerce
    if (defined('WC_VERSION') && version_compare(WC_VERSION, '5.0', '<')) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die(
            sprintf(
                __('Questo plugin richiede WooCommerce 5.0 o superiore. Versione attuale: %s', 'wc-schedule-sale-quick-edit'), 
                WC_VERSION
            ),
            __('Errore di Attivazione Plugin', 'wc-schedule-sale-quick-edit'),
            array('back_link' => true)
        );
    }
    
    // Verifica se la cartella assets esiste
    $assets_dir = WC_SCHEDULE_SALE_QE_PLUGIN_DIR . 'assets';
    if (!is_dir($assets_dir)) {
        wp_die(
            __('Cartella assets mancante. Assicurati che tutti i file del plugin siano stati caricati correttamente.', 'wc-schedule-sale-quick-edit'),
            __('Errore di Attivazione Plugin', 'wc-schedule-sale-quick-edit'),
            array('back_link' => true)
        );
    }
    
    // Chiama il metodo di attivazione dell'istanza
    $instance = WC_Schedule_Sale_Quick_Edit::get_instance();
    $instance->on_activation();
}

/**
 * Funzione di disattivazione del plugin
 */
register_deactivation_hook(__FILE__, 'wc_schedule_sale_quick_edit_deactivate');
function wc_schedule_sale_quick_edit_deactivate() {
    $instance = WC_Schedule_Sale_Quick_Edit::get_instance();
    $instance->on_deactivation();
}

/**
 * Hook per controllare aggiornamenti di versione
 */
add_action('admin_init', function() {
    if (class_exists('WC_Schedule_Sale_Quick_Edit')) {
        $instance = WC_Schedule_Sale_Quick_Edit::get_instance();
        $instance->check_version_upgrade();
    }
});

/**
 * Funzioni di utilità globali
 */

/**
 * Ottieni l'istanza del plugin
 */
function wc_schedule_sale_quick_edit() {
    return WC_Schedule_Sale_Quick_Edit::get_instance();
}

/**
 * Verifica se il plugin è attivo e funzionante
 */
function wc_schedule_sale_quick_edit_is_active() {
    return class_exists('WooCommerce') && 
           class_exists('WC_Schedule_Sale_Quick_Edit') && 
           version_compare(PHP_VERSION, '7.4', '>=');
}

/**
 * Ottieni la versione del plugin
 */
function wc_schedule_sale_quick_edit_version() {
    return WC_SCHEDULE_SALE_QE_VERSION;
}

/**
 * Hook per inizializzazione dopo che tutti i plugin sono caricati
 */
add_action('init', function() {
    // Carica le traduzioni se non già caricate
    if (!is_textdomain_loaded('wc-schedule-sale-quick-edit')) {
        load_plugin_textdomain(
            'wc-schedule-sale-quick-edit',
            false,
            dirname(WC_SCHEDULE_SALE_QE_PLUGIN_BASENAME) . '/languages/'
        );
    }
});

/**
 * Aggiungi supporto per WP-CLI se disponibile
 */
if (defined('WP_CLI') && WP_CLI) {
    /**
     * Comandi WP-CLI per il plugin
     */
    class WC_Schedule_Sale_Quick_Edit_CLI {
        
        /**
         * Mostra informazioni sul plugin
         */
        public function info() {
            WP_CLI::line('WooCommerce Pianifica Sconto - Modifica Rapida');
            WP_CLI::line('Versione: ' . WC_SCHEDULE_SALE_QE_VERSION);
            WP_CLI::line('Status: ' . (wc_schedule_sale_quick_edit_is_active() ? 'Attivo' : 'Non attivo'));
            
            if (class_exists('WC_Schedule_Sale_Quick_Edit')) {
                $instance = WC_Schedule_Sale_Quick_Edit::get_instance();
                WP_CLI::line('HPOS Abilitato: ' . ($instance->is_hpos_enabled() ? 'Si' : 'No'));
                WP_CLI::line('Script Caricati: ' . ($instance->are_scripts_loaded() ? 'Si' : 'No'));
                WP_CLI::line('Prodotti con dati: ' . count($instance->get_products_data()));
            }
        }
        
        /**
         * Pulisce i dati memorizzati
         */
        public function clear_data() {
            if (class_exists('WC_Schedule_Sale_Quick_Edit')) {
                $instance = WC_Schedule_Sale_Quick_Edit::get_instance();
                $instance->clear_products_data();
                WP_CLI::success('Dati del plugin puliti.');
            } else {
                WP_CLI::error('Plugin non attivo.');
            }
        }
    }
    
    WP_CLI::add_command('wc-schedule-sale', 'WC_Schedule_Sale_Quick_Edit_CLI');
}

/* Fine del file - Plugin completamente inizializzato */