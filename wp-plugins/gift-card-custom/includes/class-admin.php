<?php

if (!defined('ABSPATH')) {
    exit;
}

class GiftCard_Admin {
    
    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'handle_admin_actions'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
    }
    
    public function add_admin_menu() {
        // Menu principale
        add_menu_page(
            'Gift Card Manager',
            'Gift Cards',
            'manage_woocommerce',
            'gift-card-manager',
            array($this, 'admin_page'),
            'dashicons-tickets-alt',
            56
        );
        
        // Sottomenu
        add_submenu_page(
            'gift-card-manager',
            'Configurazione',
            'Configurazione',
            'manage_woocommerce',
            'gift-card-manager',
            array($this, 'admin_page')
        );
        
        add_submenu_page(
            'gift-card-manager',
            'Saldi Utenti',
            'Saldi Utenti',
            'manage_woocommerce',
            'gift-card-balances',
            array($this, 'balances_page')
        );
        
        add_submenu_page(
            'gift-card-manager',
            'Transazioni',
            'Transazioni',
            'manage_woocommerce',
            'gift-card-transactions',
            array($this, 'transactions_page')
        );
    }
    
    public function enqueue_admin_scripts($hook) {
        if (strpos($hook, 'gift-card') !== false) {
            wp_enqueue_script('jquery');
        }
    }
    
    public function handle_admin_actions() {
        if (!isset($_POST['gift_card_action']) || !wp_verify_nonce($_POST['_wpnonce'], 'gift_card_admin')) {
            return;
        }
        
        $action = sanitize_text_field($_POST['gift_card_action']);
        
        switch ($action) {
            case 'save_settings':
                $this->save_settings();
                break;
            case 'update_balance':
                $this->update_user_balance();
                break;
        }
    }
    
    private function save_settings() {
        $gift_card_product_id = intval($_POST['gift_card_product_id']);
        
        if ($gift_card_product_id > 0) {
            // Verifica che sia un prodotto valido
            $product = wc_get_product($gift_card_product_id);
            if ($product) {
                update_option('gift_card_product_id', $gift_card_product_id);
                add_action('admin_notices', function() {
                    echo '<div class="notice notice-success"><p>Configurazione salvata con successo!</p></div>';
                });
            } else {
                add_action('admin_notices', function() {
                    echo '<div class="notice notice-error"><p>ID prodotto non valido!</p></div>';
                });
            }
        }
    }
    
    private function update_user_balance() {
        $user_id = intval($_POST['user_id']);
        $amount = floatval($_POST['amount']);
        $type = sanitize_text_field($_POST['type']);
        $description = sanitize_text_field($_POST['description']);
        
        if ($user_id && $amount > 0 && in_array($type, ['credit', 'debit']) && $description) {
            $result = GiftCard_Database::update_user_balance($user_id, $amount, $type, $description);
            
            if ($result) {
                add_action('admin_notices', function() {
                    echo '<div class="notice notice-success"><p>Saldo aggiornato con successo!</p></div>';
                });
            } else {
                add_action('admin_notices', function() {
                    echo '<div class="notice notice-error"><p>Errore nell\'aggiornamento del saldo!</p></div>';
                });
            }
        }
    }
    
    public function admin_page() {
        $current_product_id = get_option('gift_card_product_id', '');
        ?>
        <div class="wrap">
            <h1>Gift Card Manager - Configurazione</h1>
            
            <div class="card" style="max-width: 800px;">
                <h2>Configurazione Prodotto Gift Card</h2>
                <form method="post">
                    <?php wp_nonce_field('gift_card_admin'); ?>
                    <input type="hidden" name="gift_card_action" value="save_settings">
                    
                    <table class="form-table">
                        <tr>
                            <th scope="row">
                                <label for="gift_card_product_id">ID Prodotto Gift Card</label>
                            </th>
                            <td>
                                <input type="number" 
                                       name="gift_card_product_id" 
                                       id="gift_card_product_id" 
                                       value="<?php echo esc_attr($current_product_id); ?>" 
                                       class="regular-text" 
                                       placeholder="es. 123" />
                                <p class="description">
                                    Inserisci l'ID del prodotto variabile che fungerà da Gift Card. 
                                    Le variazioni rappresenteranno i diversi tagli disponibili.
                                </p>
                                
                                <?php if ($current_product_id): ?>
                                    <?php
                                    $product = wc_get_product($current_product_id);
                                    if ($product):
                                    ?>
                                        <div style="margin-top: 10px; padding: 10px; background: #f0f8ff; border: 1px solid #0073aa; border-radius: 4px;">
                                            <strong>Prodotto attuale:</strong> <?php echo esc_html($product->get_name()); ?><br>
                                            <strong>Tipo:</strong> <?php echo esc_html($product->get_type()); ?><br>
                                            <a href="<?php echo admin_url('post.php?post=' . $current_product_id . '&action=edit'); ?>" 
                                               target="_blank">Modifica prodotto &rarr;</a>
                                        </div>
                                        
                                        <?php if ($product->is_type('variable')): ?>
                                            <?php $variations = $product->get_available_variations(); ?>
                                            <?php if (!empty($variations)): ?>
                                                <div style="margin-top: 10px;">
                                                    <strong>Variazioni disponibili:</strong>
                                                    <ul style="margin-top: 5px;">
                                                        <?php foreach ($variations as $variation): ?>
                                                            <?php $var_product = wc_get_product($variation['variation_id']); ?>
                                                            <li>
                                                                €<?php echo number_format($var_product->get_price(), 2, ',', '.'); ?> 
                                                                - <?php echo wc_get_formatted_variation($var_product, true); ?>
                                                            </li>
                                                        <?php endforeach; ?>
                                                    </ul>
                                                </div>
                                            <?php else: ?>
                                                <div style="margin-top: 10px; color: #d63638;">
                                                    <strong>Attenzione:</strong> Il prodotto non ha variazioni configurate.
                                                </div>
                                            <?php endif; ?>
                                        <?php else: ?>
                                            <div style="margin-top: 10px; color: #d63638;">
                                                <strong>Attenzione:</strong> Il prodotto deve essere di tipo "Variabile" per funzionare con le Gift Card.
                                            </div>
                                        <?php endif; ?>
                                    <?php else: ?>
                                        <div style="margin-top: 10px; color: #d63638;">
                                            <strong>Errore:</strong> Prodotto non trovato con ID <?php echo esc_html($current_product_id); ?>
                                        </div>
                                    <?php endif; ?>
                                <?php endif; ?>
                            </td>
                        </tr>
                    </table>
                    
                    <?php submit_button('Salva Configurazione'); ?>
                </form>
            </div>
            
            <div class="card" style="max-width: 800px; margin-top: 20px;">
                <h3>Come configurare:</h3>
                <ol>
                    <li><strong>Crea un prodotto variabile</strong> in WooCommerce</li>
                    <li><strong>Aggiungi variazioni</strong> con i diversi tagli (es. €25, €50, €100)</li>
                    <li><strong>Inserisci l'ID del prodotto</strong> nel campo sopra</li>
                    <li><strong>Quando un cliente acquista</strong> e l'ordine viene completato, il sistema accrediterà automaticamente il saldo</li>
                </ol>
            </div>
        </div>
        <?php
    }
    
    public function balances_page() {
        ?>
        <div class="wrap">
            <h1>Gift Card - Saldi Utenti</h1>
            
            <!-- Form per aggiornare saldo -->
            <div class="card" style="max-width: 600px; margin-bottom: 20px;">
                <h2>Aggiorna Saldo Utente</h2>
                <form method="post">
                    <?php wp_nonce_field('gift_card_admin'); ?>
                    <input type="hidden" name="gift_card_action" value="update_balance">
                    
                    <table class="form-table">
                        <tr>
                            <th scope="row">
                                <label for="user_id">Utente</label>
                            </th>
                            <td>
                                <?php
                                wp_dropdown_users(array(
                                    'name' => 'user_id',
                                    'id' => 'user_id',
                                    'show_option_none' => 'Seleziona utente...',
                                    'option_none_value' => ''
                                ));
                                ?>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="type">Tipo Operazione</label>
                            </th>
                            <td>
                                <select name="type" id="type" required>
                                    <option value="">Seleziona...</option>
                                    <option value="credit">Accredito (+)</option>
                                    <option value="debit">Addebito (-)</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="amount">Importo (€)</label>
                            </th>
                            <td>
                                <input type="number" 
                                       name="amount" 
                                       id="amount" 
                                       step="0.01" 
                                       min="0.01" 
                                       class="small-text"
                                       required />
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="description">Descrizione</label>
                            </th>
                            <td>
                                <input type="text" 
                                       name="description" 
                                       id="description" 
                                       class="regular-text" 
                                       placeholder="Motivo dell'operazione..." 
                                       required />
                            </td>
                        </tr>
                    </table>
                    
                    <?php submit_button('Aggiorna Saldo'); ?>
                </form>
            </div>
            
            <!-- Lista utenti con saldo -->
            <div class="card">
                <h2>Utenti con Saldo Gift Card</h2>
                <?php $this->display_users_with_balance(); ?>
            </div>
        </div>
        <?php
    }
    
    public function transactions_page() {
        $user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : null;
        ?>
        <div class="wrap">
            <h1>Gift Card - Transazioni</h1>
            
            <?php if ($user_id): ?>
                <?php $user = get_user_by('id', $user_id); ?>
                <?php if ($user): ?>
                    <h2>Transazioni per: <?php echo esc_html($user->display_name); ?> (<?php echo esc_html($user->user_email); ?>)</h2>
                    <p><a href="<?php echo admin_url('admin.php?page=gift-card-transactions'); ?>">&larr; Torna a tutte le transazioni</a></p>
                    <?php $this->display_user_transactions($user_id); ?>
                <?php else: ?>
                    <p>Utente non trovato.</p>
                <?php endif; ?>
            <?php else: ?>
                <h2>Tutte le Transazioni</h2>
                <?php $this->display_all_transactions(); ?>
            <?php endif; ?>
        </div>
        <?php
    }
    
    private function display_users_with_balance() {
        $users = GiftCard_Database::get_users_with_balance();
        
        if (empty($users)) {
            echo '<p>Nessun utente ha saldo Gift Card al momento.</p>';
            return;
        }
        
        ?>
        <table class="wp-list-table widefat fixed striped">
            <thead>
                <tr>
                    <th>Utente</th>
                    <th>Email</th>
                    <th>Saldo</th>
                    <th>Transazioni</th>
                    <th>Ultima Attività</th>
                    <th>Azioni</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($users as $user_data): ?>
                    <?php $user = get_user_by('id', $user_data->user_id); ?>
                    <tr>
                        <td>
                            <?php echo $user ? esc_html($user->display_name) : 'Utente eliminato'; ?>
                        </td>
                        <td>
                            <?php echo $user ? esc_html($user->user_email) : '-'; ?>
                        </td>
                        <td>
                            <strong style="color: #0073aa;">€<?php echo number_format($user_data->balance, 2, ',', '.'); ?></strong>
                        </td>
                        <td>
                            <?php echo intval($user_data->transaction_count); ?>
                        </td>
                        <td>
                            <?php echo date_i18n('d/m/Y H:i', strtotime($user_data->last_transaction)); ?>
                        </td>
                        <td>
                            <a href="<?php echo admin_url('admin.php?page=gift-card-transactions&user_id=' . $user_data->user_id); ?>" 
                               class="button button-small">
                                Vedi Transazioni
                            </a>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php
    }
    
    private function display_user_transactions($user_id) {
        $transactions = GiftCard_Database::get_user_transactions($user_id, 50);
        
        if (empty($transactions)) {
            echo '<p>Nessuna transazione trovata per questo utente.</p>';
            return;
        }
        
        $this->display_transactions_table($transactions);
    }
    
    private function display_all_transactions() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'gift_card_transactions';
        $transactions = $wpdb->get_results("
            SELECT * FROM $table_name 
            ORDER BY created_at DESC 
            LIMIT 100
        ");
        
        if (empty($transactions)) {
            echo '<p>Nessuna transazione trovata.</p>';
            return;
        }
        
        $this->display_transactions_table($transactions, true);
    }
    
    private function display_transactions_table($transactions, $show_user = false) {
        ?>
        <table class="wp-list-table widefat fixed striped">
            <thead>
                <tr>
                    <th>Data</th>
                    <?php if ($show_user): ?><th>Utente</th><?php endif; ?>
                    <th>Tipo</th>
                    <th>Importo</th>
                    <th>Descrizione</th>
                    <th>Ordine</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($transactions as $transaction): ?>
                    <tr>
                        <td>
                            <?php echo date_i18n('d/m/Y H:i', strtotime($transaction->created_at)); ?>
                        </td>
                        <?php if ($show_user): ?>
                            <td>
                                <?php 
                                $user = get_user_by('id', $transaction->user_id);
                                echo $user ? esc_html($user->display_name) : 'Utente eliminato';
                                ?>
                            </td>
                        <?php endif; ?>
                        <td>
                            <span class="<?php echo $transaction->type === 'credit' ? 'gift-card-credit' : 'gift-card-debit'; ?>" 
                                  style="padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; 
                                         <?php echo $transaction->type === 'credit' ? 'background: #d4edda; color: #155724;' : 'background: #f8d7da; color: #721c24;'; ?>">
                                <?php echo $transaction->type === 'credit' ? 'ACCREDITO' : 'ADDEBITO'; ?>
                            </span>
                        </td>
                        <td>
                            <strong><?php echo ($transaction->type === 'credit' ? '+' : '-'); ?>€<?php echo number_format($transaction->amount, 2, ',', '.'); ?></strong>
                        </td>
                        <td>
                            <?php echo esc_html($transaction->description); ?>
                        </td>
                        <td>
                            <?php if ($transaction->order_id): ?>
                                <a href="<?php echo admin_url('post.php?post=' . $transaction->order_id . '&action=edit'); ?>" 
                                   target="_blank">
                                    #<?php echo $transaction->order_id; ?>
                                </a>
                            <?php else: ?>
                                -
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php
    }
}