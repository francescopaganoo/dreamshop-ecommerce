<?php
// Previene l'accesso diretto
if (!defined('ABSPATH')) {
    exit;
}

// Mostra eventuali errori o messaggi
settings_errors('dreamshop_points');
?>
<div class="wrap dreamshop-points-users">
    <h1><?php _e('Gestione Utenti Punti Fedeltà', 'dreamshop-points'); ?></h1>

    <?php if ($user_details && $user_history) : ?>
        <div class="user-history-section">
            <h2>
                <?php echo sprintf(__('Cronologia punti per %s', 'dreamshop-points'), $user_details->display_name); ?> 
                <a href="<?php echo esc_url(admin_url('admin.php?page=dreamshop-points-users')); ?>" class="page-title-action">
                    <?php _e('Torna alla lista utenti', 'dreamshop-points'); ?>
                </a>
            </h2>
            
            <div class="user-info">
                <p>
                    <strong><?php _e('Nome:', 'dreamshop-points'); ?></strong> <?php echo esc_html($user_details->display_name); ?><br>
                    <strong><?php _e('Email:', 'dreamshop-points'); ?></strong> <?php echo esc_html($user_details->user_email); ?><br>
                    <strong><?php _e('Punti attuali:', 'dreamshop-points'); ?></strong> <?php echo number_format($this->db->get_user_points($user_details->ID)); ?>
                </p>
            </div>
            
            <form method="post" action="" class="points-update-form">
                <?php wp_nonce_field('dreamshop_points_update_user'); ?>
                <input type="hidden" name="dreamshop_points_update_user" value="1">
                <input type="hidden" name="user_id" value="<?php echo esc_attr($user_details->ID); ?>">
                
                <h3><?php _e('Aggiorna punti', 'dreamshop-points'); ?></h3>
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php _e('Azione', 'dreamshop-points'); ?></th>
                        <td>
                            <select name="points_action" required>
                                <option value="add"><?php _e('Aggiungi punti', 'dreamshop-points'); ?></option>
                                <option value="remove"><?php _e('Rimuovi punti', 'dreamshop-points'); ?></option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php _e('Punti', 'dreamshop-points'); ?></th>
                        <td>
                            <input type="number" name="points" min="1" step="1" required>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php _e('Descrizione', 'dreamshop-points'); ?></th>
                        <td>
                            <input type="text" name="description" class="regular-text" required>
                        </td>
                    </tr>
                </table>
                
                <?php submit_button(__('Aggiorna punti', 'dreamshop-points')); ?>
            </form>
            
            <h3><?php _e('Cronologia punti', 'dreamshop-points'); ?></h3>
            
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th><?php _e('ID', 'dreamshop-points'); ?></th>
                        <th><?php _e('Punti', 'dreamshop-points'); ?></th>
                        <th><?php _e('Tipo', 'dreamshop-points'); ?></th>
                        <th><?php _e('Descrizione', 'dreamshop-points'); ?></th>
                        <th><?php _e('Ordine', 'dreamshop-points'); ?></th>
                        <th><?php _e('Data', 'dreamshop-points'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($user_history)) : ?>
                    <tr>
                        <td colspan="6"><?php _e('Nessuna transazione trovata', 'dreamshop-points'); ?></td>
                    </tr>
                    <?php else : ?>
                        <?php foreach ($user_history as $item) : ?>
                        <tr>
                            <td><?php echo esc_html($item['id']); ?></td>
                            <td><?php echo esc_html($item['points']); ?></td>
                            <td>
                                <?php if ($item['type'] === 'earn') : ?>
                                    <span class="points-earn"><?php _e('Guadagnati', 'dreamshop-points'); ?></span>
                                <?php else : ?>
                                    <span class="points-redeem"><?php _e('Riscattati', 'dreamshop-points'); ?></span>
                                <?php endif; ?>
                            </td>
                            <td><?php echo esc_html($item['description']); ?></td>
                            <td>
                                <?php if (!empty($item['order_id'])) : ?>
                                    <a href="<?php echo esc_url(admin_url('post.php?post=' . $item['order_id'] . '&action=edit')); ?>">
                                        #<?php echo esc_html($item['order_id']); ?>
                                    </a>
                                <?php else : ?>
                                    -
                                <?php endif; ?>
                            </td>
                            <td>
                                <?php echo esc_html(date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($item['date']))); ?>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    
    <?php else : ?>
        <div class="tablenav top">
            <div class="alignleft actions">
                <input type="text" id="dreamshop-points-search" class="regular-text" placeholder="<?php _e('Cerca utente per nome o email...', 'dreamshop-points'); ?>" value="">
                <button type="button" id="dreamshop-points-search-btn" class="button"><?php _e('Cerca', 'dreamshop-points'); ?></button>
                <button type="button" id="dreamshop-points-reset-btn" class="button" style="display:none;"><?php _e('Reset', 'dreamshop-points'); ?></button>
                <span class="spinner" id="dreamshop-points-search-spinner" style="float: none; margin: 0 10px;"></span>
            </div>
        </div>

        <table class="wp-list-table widefat fixed striped users-table" id="dreamshop-points-users-table">
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
        </table>

        <?php if (!empty($users) && $total_pages > 1) : ?>
        <div class="tablenav bottom">
            <div class="tablenav-pages">
                <?php
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
                    echo '<span class="displaying-num">' .
                         sprintf(_n('%s utente', '%s utenti', $total_users, 'dreamshop-points'), number_format_i18n($total_users)) .
                         '</span>';
                    echo $page_links;
                }
                ?>
            </div>
        </div>
        <?php endif; ?>
    <?php endif; ?>
</div>

<style>
.user-history-section {
    background: #fff;
    border: 1px solid #ccd0d4;
    padding: 20px;
    margin-top: 20px;
    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.04);
}

.user-info {
    background: #f9f9f9;
    padding: 15px;
    margin-bottom: 20px;
    border-left: 4px solid #0073aa;
}

.points-earn {
    color: #46b450;
    font-weight: 600;
}

.points-redeem {
    color: #dc3232;
    font-weight: 600;
}

.points-update-form {
    background: #f9f9f9;
    padding: 15px;
    margin-bottom: 20px;
    border: 1px solid #e5e5e5;
}
</style>
