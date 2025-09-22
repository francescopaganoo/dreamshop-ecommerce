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
        
        // Sottomenu - Log Acquisti
        add_submenu_page(
            'gift-card-manager',
            'Log Acquisti',
            'Log Acquisti',
            'manage_woocommerce',
            'gift-card-logs',
            array($this, 'admin_logs_page')
        );

        // Sottomenu - Configurazione
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
            case 'mark_manual_sent':
                $this->handle_mark_manual_sent();
                break;
            case 'resend_email':
                $this->handle_resend_email();
                break;
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

    /**
     * Pagina admin per i log degli acquisti gift card
     */
    public function admin_logs_page() {
        // Gestione filtri
        $current_filter = isset($_GET['filter']) ? sanitize_text_field($_GET['filter']) : 'all';
        $search = isset($_GET['search']) ? sanitize_text_field($_GET['search']) : '';

        $filters = array();
        if ($current_filter === 'failed') {
            $filters['email_sent'] = 'failed';
        } elseif ($current_filter === 'sent') {
            $filters['email_sent'] = 'sent';
        } elseif ($current_filter === 'manual') {
            $filters['manual_sent'] = 'yes';
        }

        if (!empty($search)) {
            $filters['search'] = $search;
        }

        // Paginazione
        $current_page = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
        $per_page = 20;
        $offset = ($current_page - 1) * $per_page;

        $logs = GiftCard_Database::get_gift_card_logs($per_page, $offset, $filters);
        $total_logs = GiftCard_Database::count_gift_card_logs($filters);
        $total_pages = ceil($total_logs / $per_page);

        // Stats
        $stats = array(
            'total' => GiftCard_Database::count_gift_card_logs(),
            'failed' => GiftCard_Database::count_gift_card_logs(array('email_sent' => 'failed')),
            'sent' => GiftCard_Database::count_gift_card_logs(array('email_sent' => 'sent')),
            'manual' => GiftCard_Database::count_gift_card_logs(array('manual_sent' => 'yes'))
        );

        ?>
        <div class="wrap">
            <h1>Log Acquisti Gift Card</h1>

            <!-- Stats -->
            <div class="gift-card-stats" style="margin: 20px 0;">
                <ul class="subsubsub">
                    <li><a href="?page=gift-card-logs" class="<?php echo $current_filter === 'all' ? 'current' : ''; ?>">Tutti <span class="count">(<?php echo $stats['total']; ?>)</span></a> |</li>
                    <li><a href="?page=gift-card-logs&filter=failed" class="<?php echo $current_filter === 'failed' ? 'current' : ''; ?>">Email Non Inviate <span class="count">(<?php echo $stats['failed']; ?>)</span></a> |</li>
                    <li><a href="?page=gift-card-logs&filter=sent" class="<?php echo $current_filter === 'sent' ? 'current' : ''; ?>">Email Inviate <span class="count">(<?php echo $stats['sent']; ?>)</span></a> |</li>
                    <li><a href="?page=gift-card-logs&filter=manual" class="<?php echo $current_filter === 'manual' ? 'current' : ''; ?>">Inviate Manualmente <span class="count">(<?php echo $stats['manual']; ?>)</span></a></li>
                </ul>
            </div>

            <!-- Barra di ricerca -->
            <div class="tablenav top" style="margin: 20px 0;">
                <form method="get" style="float: right;">
                    <input type="hidden" name="page" value="gift-card-logs">
                    <?php if ($current_filter !== 'all'): ?>
                        <input type="hidden" name="filter" value="<?php echo esc_attr($current_filter); ?>">
                    <?php endif; ?>
                    <input type="search" name="search" value="<?php echo esc_attr($search); ?>" placeholder="Cerca per codice, email, nome...">
                    <input type="submit" class="button" value="Cerca">
                    <?php if (!empty($search)): ?>
                        <a href="?page=gift-card-logs<?php echo $current_filter !== 'all' ? '&filter=' . esc_attr($current_filter) : ''; ?>" class="button">Cancella</a>
                    <?php endif; ?>
                </form>
                <div class="clear"></div>
            </div>

            <!-- Tabella log -->
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Ordine</th>
                        <th>Codice Gift Card</th>
                        <th>Acquirente</th>
                        <th>Destinatario</th>
                        <th>Importo</th>
                        <th>Email</th>
                        <th>Azioni</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($logs)): ?>
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 20px;">
                                <em>Nessun log trovato.</em>
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($logs as $log): ?>
                            <tr>
                                <td><?php echo date_i18n('d/m/Y H:i', strtotime($log->created_at)); ?></td>
                                <td>
                                    <a href="<?php echo admin_url('post.php?post=' . $log->order_id . '&action=edit'); ?>" target="_blank">
                                        #<?php echo $log->order_id; ?>
                                    </a>
                                </td>
                                <td>
                                    <strong><?php echo esc_html($log->gift_card_code); ?></strong>
                                </td>
                                <td>
                                    <strong><?php echo esc_html($log->purchaser_name); ?></strong><br>
                                    <small><?php echo esc_html($log->purchaser_email); ?></small>
                                </td>
                                <td>
                                    <strong><?php echo esc_html($log->recipient_name ?: $log->recipient_email); ?></strong><br>
                                    <small><?php echo esc_html($log->recipient_email); ?></small>
                                    <?php if (!empty($log->message)): ?>
                                        <br><em>"<?php echo esc_html(substr($log->message, 0, 50)) . (strlen($log->message) > 50 ? '...' : ''); ?>"</em>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <strong>€<?php echo number_format($log->amount, 2, ',', '.'); ?></strong>
                                </td>
                                <td>
                                    <?php if ($log->email_sent): ?>
                                        <span class="gift-card-status-sent">✓ Inviata</span><br>
                                        <small><?php echo date_i18n('d/m/Y H:i', strtotime($log->email_sent_at)); ?></small>
                                    <?php else: ?>
                                        <span class="gift-card-status-failed">✗ Non inviata</span>
                                        <?php if ($log->email_error): ?>
                                            <br><small style="color: #dc3232;"><?php echo esc_html($log->email_error); ?></small>
                                        <?php endif; ?>
                                    <?php endif; ?>

                                    <?php if ($log->manual_sent): ?>
                                        <br><span class="gift-card-status-manual">📧 Inviata manualmente</span>
                                        <br><small><?php echo date_i18n('d/m/Y H:i', strtotime($log->manual_sent_at)); ?></small>
                                        <?php if ($log->notes): ?>
                                            <br><small><?php echo esc_html($log->notes); ?></small>
                                        <?php endif; ?>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <?php if (!$log->email_sent && !$log->manual_sent): ?>
                                        <form method="post" style="display: inline;">
                                            <?php wp_nonce_field('gift_card_admin'); ?>
                                            <input type="hidden" name="gift_card_action" value="mark_manual_sent">
                                            <input type="hidden" name="log_id" value="<?php echo $log->id; ?>">
                                            <input type="submit" class="button button-primary button-small" value="Marca come Inviata"
                                                   onclick="return confirm('Confermi che hai inviato manualmente questa gift card?');">
                                        </form>
                                    <?php endif; ?>

                                    <button class="button button-small"
                                            onclick="showGiftCardDetails(<?php echo htmlspecialchars(json_encode($log), ENT_QUOTES, 'UTF-8'); ?>)">
                                        Dettagli
                                    </button>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>

            <!-- Paginazione -->
            <?php if ($total_pages > 1): ?>
                <div class="tablenav bottom">
                    <div class="tablenav-pages">
                        <?php
                        $page_links = paginate_links(array(
                            'base' => add_query_arg('paged', '%#%'),
                            'format' => '',
                            'prev_text' => '&laquo;',
                            'next_text' => '&raquo;',
                            'total' => $total_pages,
                            'current' => $current_page
                        ));
                        echo $page_links;
                        ?>
                    </div>
                </div>
            <?php endif; ?>
        </div>

        <!-- Modal per dettagli gift card -->
        <div id="gift-card-modal" style="display: none; position: fixed; z-index: 100000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5);">
            <div style="background-color: #fff; margin: 5% auto; padding: 0; border-radius: 8px; width: 80%; max-width: 600px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; position: relative;">
                    <h2 style="margin: 0; color: white;">🎁 Dettagli Gift Card</h2>
                    <button onclick="closeGiftCardModal()" style="position: absolute; right: 15px; top: 15px; background: none; border: none; color: white; font-size: 24px; cursor: pointer; line-height: 1;">&times;</button>
                </div>
                <div id="gift-card-modal-content" style="padding: 25px; line-height: 1.6;">
                    <!-- Content will be inserted here -->
                </div>
                <div style="padding: 20px; border-top: 1px solid #eee; text-align: right;">
                    <button onclick="closeGiftCardModal()" class="button button-secondary">Chiudi</button>
                    <button onclick="copyGiftCardCode()" class="button button-primary" style="margin-left: 10px;">📋 Copia Codice</button>
                </div>
            </div>
        </div>

        <style>
        .gift-card-status-sent { color: #46b450; font-weight: bold; }
        .gift-card-status-failed { color: #dc3232; font-weight: bold; }
        .gift-card-status-manual { color: #00a0d2; font-weight: bold; }

        .gift-card-detail-row {
            display: flex;
            margin-bottom: 12px;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .gift-card-detail-label {
            font-weight: bold;
            min-width: 140px;
            color: #23282d;
        }
        .gift-card-detail-value {
            flex: 1;
            color: #32373c;
        }
        .gift-card-code {
            font-family: 'Courier New', monospace;
            background: #f8f9fa;
            padding: 8px 12px;
            border-radius: 4px;
            border: 1px solid #ddd;
            font-size: 16px;
            font-weight: bold;
            color: #2271b1;
            letter-spacing: 1px;
        }
        .gift-card-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-sent { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .status-manual { background: #cce7ff; color: #004085; }
        </style>

        <script>
        var currentGiftCardCode = '';

        function showGiftCardDetails(log) {
            currentGiftCardCode = log.gift_card_code;

            var content = '<div>';

            // Codice Gift Card
            content += '<div class="gift-card-detail-row">';
            content += '<div class="gift-card-detail-label">Codice:</div>';
            content += '<div class="gift-card-detail-value"><span class="gift-card-code">' + log.gift_card_code + '</span></div>';
            content += '</div>';

            // Ordine
            content += '<div class="gift-card-detail-row">';
            content += '<div class="gift-card-detail-label">Ordine:</div>';
            content += '<div class="gift-card-detail-value"><a href="<?php echo admin_url('post.php?post='); ?>' + log.order_id + '&action=edit" target="_blank">#' + log.order_id + '</a></div>';
            content += '</div>';

            // Importo
            content += '<div class="gift-card-detail-row">';
            content += '<div class="gift-card-detail-label">Importo:</div>';
            content += '<div class="gift-card-detail-value"><strong>€' + parseFloat(log.amount).toFixed(2).replace('.', ',') + '</strong></div>';
            content += '</div>';

            // Acquirente
            content += '<div class="gift-card-detail-row">';
            content += '<div class="gift-card-detail-label">Acquirente:</div>';
            content += '<div class="gift-card-detail-value">';
            content += '<strong>' + log.purchaser_name + '</strong><br>';
            content += '<small style="color: #666;">' + log.purchaser_email + '</small>';
            content += '</div>';
            content += '</div>';

            // Destinatario
            content += '<div class="gift-card-detail-row">';
            content += '<div class="gift-card-detail-label">Destinatario:</div>';
            content += '<div class="gift-card-detail-value">';
            content += '<strong>' + (log.recipient_name || log.recipient_email) + '</strong><br>';
            content += '<small style="color: #666;">' + log.recipient_email + '</small>';
            content += '</div>';
            content += '</div>';

            // Messaggio personalizzato
            if (log.message && log.message.trim()) {
                content += '<div class="gift-card-detail-row">';
                content += '<div class="gift-card-detail-label">Messaggio:</div>';
                content += '<div class="gift-card-detail-value">';
                content += '<em style="background: #f9f9f9; padding: 8px; border-left: 3px solid #ddd; display: block; border-radius: 4px;">"' + log.message + '"</em>';
                content += '</div>';
                content += '</div>';
            }

            // Data creazione
            content += '<div class="gift-card-detail-row">';
            content += '<div class="gift-card-detail-label">Creata il:</div>';
            content += '<div class="gift-card-detail-value">' + formatDateTime(log.created_at) + '</div>';
            content += '</div>';

            // Stato email
            content += '<div class="gift-card-detail-row">';
            content += '<div class="gift-card-detail-label">Email automatica:</div>';
            content += '<div class="gift-card-detail-value">';
            if (log.email_sent == 1) {
                content += '<span class="gift-card-status status-sent">✓ Inviata</span>';
                if (log.email_sent_at) {
                    content += '<br><small>Inviata il: ' + formatDateTime(log.email_sent_at) + '</small>';
                }
            } else {
                content += '<span class="gift-card-status status-failed">✗ Non inviata</span>';
                if (log.email_error) {
                    content += '<br><small style="color: #dc3232;">Errore: ' + log.email_error + '</small>';
                }
            }
            content += '</div>';
            content += '</div>';

            // Invio manuale
            if (log.manual_sent == 1) {
                content += '<div class="gift-card-detail-row">';
                content += '<div class="gift-card-detail-label">Invio manuale:</div>';
                content += '<div class="gift-card-detail-value">';
                content += '<span class="gift-card-status status-manual">📧 Inviata manualmente</span>';
                if (log.manual_sent_at && log.manual_sent_at !== 'null') {
                    content += '<br><small>Inviata il: ' + formatDateTime(log.manual_sent_at) + '</small>';
                }
                if (log.notes && log.notes.trim()) {
                    content += '<br><small><strong>Note:</strong> ' + log.notes + '</small>';
                }
                content += '</div>';
                content += '</div>';
            }

            content += '</div>';

            document.getElementById('gift-card-modal-content').innerHTML = content;
            document.getElementById('gift-card-modal').style.display = 'block';
        }

        function closeGiftCardModal() {
            document.getElementById('gift-card-modal').style.display = 'none';
        }

        function copyGiftCardCode() {
            if (currentGiftCardCode) {
                navigator.clipboard.writeText(currentGiftCardCode).then(function() {
                    alert('Codice gift card copiato: ' + currentGiftCardCode);
                }).catch(function() {
                    // Fallback per browser più vecchi
                    var textArea = document.createElement('textarea');
                    textArea.value = currentGiftCardCode;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    alert('Codice gift card copiato: ' + currentGiftCardCode);
                });
            }
        }

        function formatDateTime(dateString) {
            if (!dateString || dateString === 'null') return '-';

            var date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;

            var day = ('0' + date.getDate()).slice(-2);
            var month = ('0' + (date.getMonth() + 1)).slice(-2);
            var year = date.getFullYear();
            var hours = ('0' + date.getHours()).slice(-2);
            var minutes = ('0' + date.getMinutes()).slice(-2);

            return day + '/' + month + '/' + year + ' alle ' + hours + ':' + minutes;
        }

        // Chiudi il modal cliccando fuori
        window.onclick = function(event) {
            var modal = document.getElementById('gift-card-modal');
            if (event.target == modal) {
                closeGiftCardModal();
            }
        }

        // Chiudi il modal con ESC
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeGiftCardModal();
            }
        });
        </script>
        <?php
    }

    /**
     * Marca un log come inviato manualmente
     */
    private function handle_mark_manual_sent() {
        if (!isset($_POST['log_id'])) {
            return;
        }

        $log_id = intval($_POST['log_id']);
        $notes = isset($_POST['notes']) ? sanitize_textarea_field($_POST['notes']) : 'Marcata come inviata dall\'amministratore';

        $result = GiftCard_Database::mark_gift_card_log_manual_sent($log_id, get_current_user_id(), $notes);

        if ($result) {
            add_action('admin_notices', function() {
                echo '<div class="notice notice-success is-dismissible"><p>Log marcato come inviato manualmente.</p></div>';
            });
        } else {
            add_action('admin_notices', function() {
                echo '<div class="notice notice-error is-dismissible"><p>Errore nell\'aggiornamento del log.</p></div>';
            });
        }
    }
}