<?php

if (!defined('ABSPATH')) {
    exit;
}

class GiftCard_Manager {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
    }
    
    public function init() {
        if (!class_exists('WooCommerce')) {
            return;
        }
        
        add_action('woocommerce_product_options_general_product_data', array($this, 'add_gift_card_product_fields'));
        add_action('woocommerce_process_product_meta', array($this, 'save_gift_card_product_fields'));
        add_filter('woocommerce_product_data_tabs', array($this, 'add_gift_card_product_tab'));
        add_action('woocommerce_product_data_panels', array($this, 'gift_card_product_tab_content'));
        
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('wp_ajax_gift_card_generate_coupon', array($this, 'ajax_generate_coupon'));
        add_action('wp_ajax_nopriv_gift_card_generate_coupon', array($this, 'ajax_generate_coupon'));
        
        add_shortcode('gift_card_balance', array($this, 'gift_card_balance_shortcode'));
        add_shortcode('gift_card_history', array($this, 'gift_card_history_shortcode'));
    }
    
    public function add_gift_card_product_fields() {
        woocommerce_wp_checkbox(array(
            'id' => '_is_gift_card',
            'label' => __('È una Gift Card', 'gift-card-custom'),
            'description' => __('Seleziona se questo prodotto è una gift card', 'gift-card-custom')
        ));
    }
    
    public function save_gift_card_product_fields($post_id) {
        $is_gift_card = isset($_POST['_is_gift_card']) ? 'yes' : 'no';
        update_post_meta($post_id, '_is_gift_card', $is_gift_card);
    }
    
    public function add_gift_card_product_tab($tabs) {
        $tabs['gift_card'] = array(
            'label' => __('Gift Card', 'gift-card-custom'),
            'target' => 'gift_card_product_data',
            'class' => array('show_if_gift_card')
        );
        return $tabs;
    }
    
    public function gift_card_product_tab_content() {
        ?>
        <div id='gift_card_product_data' class='panel woocommerce_options_panel'>
            <div class='options_group'>
                <?php
                woocommerce_wp_text_field(array(
                    'id' => '_gift_card_min_amount',
                    'label' => __('Importo minimo (€)', 'gift-card-custom'),
                    'placeholder' => '10.00',
                    'desc_tip' => true,
                    'description' => __('Importo minimo per questa gift card', 'gift-card-custom'),
                    'type' => 'number',
                    'custom_attributes' => array(
                        'step' => '0.01',
                        'min' => '0'
                    )
                ));
                
                woocommerce_wp_text_field(array(
                    'id' => '_gift_card_max_amount',
                    'label' => __('Importo massimo (€)', 'gift-card-custom'),
                    'placeholder' => '500.00',
                    'desc_tip' => true,
                    'description' => __('Importo massimo per questa gift card', 'gift-card-custom'),
                    'type' => 'number',
                    'custom_attributes' => array(
                        'step' => '0.01',
                        'min' => '0'
                    )
                ));
                
                woocommerce_wp_select(array(
                    'id' => '_gift_card_validity_period',
                    'label' => __('Periodo di validità', 'gift-card-custom'),
                    'options' => array(
                        '365' => __('1 Anno', 'gift-card-custom'),
                        '730' => __('2 Anni', 'gift-card-custom'),
                        '1095' => __('3 Anni', 'gift-card-custom'),
                        '0' => __('Senza scadenza', 'gift-card-custom')
                    ),
                    'desc_tip' => true,
                    'description' => __('Per quanto tempo sarà valida la gift card', 'gift-card-custom')
                ));
                ?>
            </div>
        </div>
        
        <script type="text/javascript">
        jQuery(document).ready(function($) {
            // Mostra/nascondi tab gift card
            $('input#_is_gift_card').change(function() {
                var is_gift_card = $('input#_is_gift_card:checked').length;
                $('.show_if_gift_card').show();
                if (!is_gift_card) {
                    $('.show_if_gift_card').hide();
                }
            }).change();
        });
        </script>
        <?php
    }
    
    public function enqueue_scripts() {
        if (is_account_page() || is_page()) {
            wp_enqueue_script(
                'gift-card-frontend',
                GIFT_CARD_PLUGIN_URL . 'assets/js/frontend.js',
                array('jquery'),
                '1.0.0',
                true
            );
            
            wp_localize_script('gift-card-frontend', 'gift_card_ajax', array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('gift_card_nonce'),
                'api_url' => rest_url('gift-card/v1/'),
                'current_user_id' => get_current_user_id()
            ));
            
            wp_enqueue_style(
                'gift-card-frontend',
                GIFT_CARD_PLUGIN_URL . 'assets/css/frontend.css',
                array(),
                '1.0.0'
            );
        }
    }
    
    public function ajax_generate_coupon() {
        check_ajax_referer('gift_card_nonce', 'nonce');
        
        if (!is_user_logged_in()) {
            wp_send_json_error('Utente non autenticato');
        }
        
        $user_id = get_current_user_id();
        $amount = floatval($_POST['amount']);
        
        if ($amount <= 0) {
            wp_send_json_error('Importo non valido');
        }
        
        $balance = GiftCard_Database::get_user_balance($user_id);
        if ($balance < $amount) {
            wp_send_json_error('Saldo insufficiente');
        }
        
        $coupon_code = GiftCard_Database::create_coupon($user_id, $amount);
        
        if ($coupon_code) {
            $new_balance = GiftCard_Database::get_user_balance($user_id);
            wp_send_json_success(array(
                'coupon_code' => $coupon_code,
                'amount' => $amount,
                'new_balance' => $new_balance,
                'formatted_amount' => number_format($amount, 2, ',', '.') . ' €',
                'formatted_balance' => number_format($new_balance, 2, ',', '.') . ' €'
            ));
        } else {
            wp_send_json_error('Errore nella generazione del coupon');
        }
    }
    
    public function gift_card_balance_shortcode($atts) {
        if (!is_user_logged_in()) {
            return '<p>Effettua il login per visualizzare il saldo delle tue gift card.</p>';
        }
        
        $user_id = get_current_user_id();
        $balance = GiftCard_Database::get_user_balance($user_id);
        
        ob_start();
        ?>
        <div class="gift-card-balance-widget">
            <div class="balance-display">
                <h3>Il tuo saldo Gift Card</h3>
                <div class="balance-amount" data-user-id="<?php echo esc_attr($user_id); ?>">
                    €<?php echo number_format($balance, 2, ',', '.'); ?>
                </div>
            </div>
            
            <?php if ($balance > 0): ?>
            <div class="coupon-generator">
                <h4>Genera Coupon</h4>
                <form id="generate-coupon-form">
                    <div class="form-group">
                        <label for="coupon-amount">Importo coupon (max €<?php echo number_format($balance, 2, ',', '.'); ?>)</label>
                        <input type="number" id="coupon-amount" name="amount" min="0.01" max="<?php echo $balance; ?>" step="0.01" required>
                    </div>
                    <button type="submit" class="button">Genera Coupon</button>
                </form>
                
                <div id="coupon-result" class="coupon-result" style="display:none;">
                    <h5>Coupon generato:</h5>
                    <div class="coupon-code"></div>
                    <p class="coupon-instructions">Copia questo codice e utilizzalo durante il checkout per applicare lo sconto.</p>
                </div>
            </div>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }
    
    public function gift_card_history_shortcode($atts) {
        if (!is_user_logged_in()) {
            return '<p>Effettua il login per visualizzare lo storico delle tue gift card.</p>';
        }
        
        $atts = shortcode_atts(array(
            'limit' => 10
        ), $atts);
        
        $user_id = get_current_user_id();
        $transactions = GiftCard_Database::get_user_transactions($user_id, intval($atts['limit']));
        
        if (empty($transactions)) {
            return '<p>Nessuna transazione gift card trovata.</p>';
        }
        
        ob_start();
        ?>
        <div class="gift-card-history">
            <h3>Storico Gift Card</h3>
            <table class="gift-card-transactions">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Importo</th>
                        <th>Descrizione</th>
                        <th>Codice Coupon</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($transactions as $transaction): ?>
                    <tr class="transaction-<?php echo esc_attr($transaction->type); ?>">
                        <td><?php echo date_i18n('d/m/Y H:i', strtotime($transaction->created_at)); ?></td>
                        <td>
                            <span class="transaction-type <?php echo esc_attr($transaction->type); ?>">
                                <?php echo $transaction->type === 'credit' ? 'Accredito' : 'Addebito'; ?>
                            </span>
                        </td>
                        <td class="amount">
                            <?php echo ($transaction->type === 'credit' ? '+' : '-'); ?>€<?php echo number_format($transaction->amount, 2, ',', '.'); ?>
                        </td>
                        <td><?php echo esc_html($transaction->description); ?></td>
                        <td>
                            <?php if ($transaction->coupon_code): ?>
                                <code><?php echo esc_html($transaction->coupon_code); ?></code>
                            <?php else: ?>
                                -
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php
        return ob_get_clean();
    }
}