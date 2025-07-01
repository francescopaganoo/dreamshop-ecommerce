<?php
// Previene l'accesso diretto
if (!defined('ABSPATH')) {
    exit;
}
?>
<div class="wrap dreamshop-points-dashboard">
    <h1><?php _e('Dashboard Punti Fedeltà', 'dreamshop-points'); ?></h1>
    
    <div class="dreamshop-points-stats">
        <div class="stats-grid">
            <div class="stat-box">
                <h3><?php _e('Punti Totali', 'dreamshop-points'); ?></h3>
                <div class="stat-value"><?php echo number_format($total_points); ?></div>
            </div>
            
            <div class="stat-box">
                <h3><?php _e('Utenti Con Punti', 'dreamshop-points'); ?></h3>
                <div class="stat-value"><?php echo number_format($total_users); ?></div>
            </div>
            
            <div class="stat-box">
                <h3><?php _e('Punti Guadagnati', 'dreamshop-points'); ?></h3>
                <div class="stat-value"><?php echo number_format($total_earned ?: 0); ?></div>
            </div>
            
            <div class="stat-box">
                <h3><?php _e('Punti Riscattati', 'dreamshop-points'); ?></h3>
                <div class="stat-value"><?php echo number_format($total_redeemed ?: 0); ?></div>
            </div>
        </div>
    </div>
    
    <div class="dreamshop-points-recent">
        <h2><?php _e('Transazioni Recenti', 'dreamshop-points'); ?></h2>
        
        <table class="wp-list-table widefat fixed striped">
            <thead>
                <tr>
                    <th><?php _e('Utente', 'dreamshop-points'); ?></th>
                    <th><?php _e('Punti', 'dreamshop-points'); ?></th>
                    <th><?php _e('Tipo', 'dreamshop-points'); ?></th>
                    <th><?php _e('Descrizione', 'dreamshop-points'); ?></th>
                    <th><?php _e('Ordine', 'dreamshop-points'); ?></th>
                    <th><?php _e('Data', 'dreamshop-points'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($recent_transactions)) : ?>
                <tr>
                    <td colspan="6"><?php _e('Nessuna transazione trovata', 'dreamshop-points'); ?></td>
                </tr>
                <?php else : ?>
                    <?php foreach ($recent_transactions as $transaction) : ?>
                    <tr>
                        <td>
                            <a href="<?php echo esc_url(admin_url('user-edit.php?user_id=' . $transaction['user_id'])); ?>">
                                <?php echo esc_html($transaction['display_name']); ?> 
                                <small>(<?php echo esc_html($transaction['user_email']); ?>)</small>
                            </a>
                        </td>
                        <td>
                            <?php echo esc_html($transaction['points']); ?>
                        </td>
                        <td>
                            <?php if ($transaction['type'] === 'earn') : ?>
                                <span class="points-earn"><?php _e('Guadagnati', 'dreamshop-points'); ?></span>
                            <?php else : ?>
                                <span class="points-redeem"><?php _e('Riscattati', 'dreamshop-points'); ?></span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php echo esc_html($transaction['description']); ?>
                        </td>
                        <td>
                            <?php if (!empty($transaction['order_id'])) : ?>
                                <a href="<?php echo esc_url(admin_url('post.php?post=' . $transaction['order_id'] . '&action=edit')); ?>">
                                    #<?php echo esc_html($transaction['order_id']); ?>
                                </a>
                            <?php else : ?>
                                -
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php echo esc_html(date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($transaction['date']))); ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
        
        <p class="dreamshop-points-see-all">
            <a href="<?php echo esc_url(admin_url('admin.php?page=dreamshop-points-users')); ?>" class="button">
                <?php _e('Visualizza tutti gli utenti e le transazioni', 'dreamshop-points'); ?>
            </a>
        </p>
    </div>
</div>

<style>
.dreamshop-points-stats {
    margin: 20px 0 30px;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    grid-gap: 20px;
}

.stat-box {
    background: #fff;
    border: 1px solid #ccd0d4;
    padding: 20px;
    text-align: center;
    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.04);
}

.stat-box h3 {
    margin-top: 0;
    color: #23282d;
}

.stat-value {
    font-size: 24px;
    font-weight: 600;
    color: #0073aa;
}

.points-earn {
    color: #46b450;
    font-weight: 600;
}

.points-redeem {
    color: #dc3232;
    font-weight: 600;
}

.dreamshop-points-see-all {
    margin-top: 20px;
    text-align: right;
}

.dreamshop-points-recent {
    margin-top: 30px;
}
</style>
