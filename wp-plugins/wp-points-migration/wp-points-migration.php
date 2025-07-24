<?php
/**
 * Plugin Name: WP Points Migration Tool
 * Description: Plugin per migrare i punti utente da woocommerce-points-and-rewards a dreamshop-points
 * Version: 1.0.0
 * Author: Migration Tool
 * Text Domain: wp-points-migration
 */

// Se questo file viene chiamato direttamente, interrompi l'esecuzione.
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe principale del plugin di migrazione
 */
class WP_Points_Migration {
    
    /**
     * Inizializza il plugin
     */
    public function __construct() {
        // Aggiungi il menu di amministrazione
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Aggiungi le azioni AJAX
        add_action('wp_ajax_wp_points_migration_start', array($this, 'ajax_start_migration'));
    }
    
    /**
     * Aggiunge la voce di menu per il plugin
     */
    public function add_admin_menu() {
        add_submenu_page(
            'woocommerce',
            'Migrazione Punti',
            'Migrazione Punti',
            'manage_woocommerce',
            'wp-points-migration',
            array($this, 'render_admin_page')
        );
    }
    
    /**
     * Verifica se entrambi i plugin richiesti sono attivi
     *
     * @return bool
     */
    private function check_required_plugins() {
        return class_exists('WC_Points_Rewards') && class_exists('DreamShop_Points');
    }
    
    /**
     * Renderizza la pagina di amministrazione
     */
    public function render_admin_page() {
        // Verifica se entrambi i plugin sono attivi
        if (!$this->check_required_plugins()) {
            echo '<div class="notice notice-error"><p>Entrambi i plugin <strong>WooCommerce Points and Rewards</strong> e <strong>DreamShop Points</strong> devono essere attivi per utilizzare questo strumento.</p></div>';
            return;
        }
        
        ?>
        <div class="wrap">
            <h1>Migrazione Punti</h1>
            <p>Questo strumento migrerà i punti degli utenti dal plugin <strong>WooCommerce Points and Rewards</strong> al plugin <strong>DreamShop Points</strong>.</p>
            
            <?php
            // Mostra il conteggio degli utenti con punti
            global $wpdb;
            $wc_points_table = $wpdb->prefix . 'wc_points_rewards_user_points';
            
            $users_count = $wpdb->get_var("
                SELECT COUNT(DISTINCT user_id) 
                FROM {$wc_points_table}
            ");
            ?>
            
            <div class="notice notice-info">
                <p>Sono stati trovati <strong><?php echo intval($users_count); ?></strong> utenti con punti da migrare.</p>
            </div>
            
            <div class="card" style="max-width: 600px; padding: 20px; margin-top: 20px;">
                <h2>Avvia Migrazione</h2>
                <p>Premi il pulsante qui sotto per avviare la migrazione dei punti.</p>
                <p><strong>Attenzione:</strong> Prima di procedere, assicurati di avere un backup completo del database.</p>
                
                <div id="migration-progress" style="display: none;">
                    <p>Migrazione in corso... <span id="progress-status">0%</span></p>
                    <div class="progress-bar" style="height: 20px; background-color: #f0f0f0; border-radius: 4px; margin-bottom: 10px;">
                        <div id="progress-bar-inner" style="height: 100%; width: 0%; background-color: #0073aa; border-radius: 4px; transition: width 0.3s;"></div>
                    </div>
                    <p id="migration-log"></p>
                </div>
                
                <div id="migration-results" style="display: none;">
                    <h3>Risultati della migrazione</h3>
                    <p id="migration-summary"></p>
                </div>
                
                <button id="start-migration" class="button button-primary">Avvia Migrazione</button>
            </div>
            
            <script>
                jQuery(document).ready(function($) {
                    $('#start-migration').on('click', function() {
                        if (!confirm('Sei sicuro di voler avviare la migrazione dei punti? Questa operazione non può essere annullata.')) {
                            return;
                        }
                        
                        // Disabilita il pulsante
                        $(this).prop('disabled', true);
                        
                        // Mostra la barra di avanzamento
                        $('#migration-progress').show();
                        
                        // Avvia la migrazione
                        $.ajax({
                            url: ajaxurl,
                            type: 'POST',
                            data: {
                                action: 'wp_points_migration_start',
                                nonce: '<?php echo wp_create_nonce('wp_points_migration_nonce'); ?>'
                            },
                            success: function(response) {
                                $('#migration-summary').html(response);
                                $('#migration-results').show();
                                $('#progress-status').text('100%');
                                $('#progress-bar-inner').css('width', '100%');
                                $('#migration-log').append('<p>Migrazione completata!</p>');
                            },
                            error: function() {
                                $('#migration-log').append('<p style="color: red;">Errore durante la migrazione!</p>');
                                $('#start-migration').prop('disabled', false);
                            }
                        });
                    });
                });
            </script>
        </div>
        <?php
    }
    
    /**
     * Gestisce la richiesta AJAX per avviare la migrazione
     */
    public function ajax_start_migration() {
        // Verifica il nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'wp_points_migration_nonce')) {
            wp_send_json_error('Errore di sicurezza');
            exit;
        }
        
        // Verifica i permessi
        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error('Permessi insufficienti');
            exit;
        }
        
        // Avvia la migrazione
        $results = $this->do_migration();
        
        // Restituisci i risultati
        wp_send_json_success($results);
    }
    
    /**
     * Esegue la migrazione dei punti
     *
     * @return string Risultati della migrazione in formato HTML
     */
    private function do_migration() {
        global $wpdb;
        
        $output = '';
        $migrated_count = 0;
        $error_count = 0;
        $skipped_count = 0;
        
        // Nome delle tabelle
        $wc_points_table = $wpdb->prefix . 'wc_points_rewards_user_points';
        
        // Ottieni tutti gli utenti con punti
        $users_with_points = $wpdb->get_results("
            SELECT user_id, SUM(points_balance) as total_points 
            FROM {$wc_points_table} 
            GROUP BY user_id
            HAVING total_points > 0
        ");
        
        if (empty($users_with_points)) {
            return 'Nessun utente trovato con punti da migrare.';
        }
        
        // Ottieni l'istanza di DreamShop Points DB
        $dreamshop_db = new DreamShop_Points_DB();
        
        // Per ogni utente, migra i punti
        foreach ($users_with_points as $user) {
            // Verifica se l'utente esiste ancora
            if (!get_user_by('ID', $user->user_id)) {
                $skipped_count++;
                continue;
            }
            
            // Ottieni i punti correnti nel plugin dreamshop
            $current_points = $dreamshop_db->get_user_points($user->user_id);
            
            // Aggiungi i punti
            $success = $dreamshop_db->add_points(
                $user->user_id,
                $user->total_points,
                'Migrazione da WooCommerce Points and Rewards',
                'migration'
            );
            
            if ($success) {
                $migrated_count++;
            } else {
                $error_count++;
            }
        }
        
        // Registra i risultati in un'opzione di WordPress
        update_option('wp_points_migration_results', [
            'timestamp' => current_time('mysql'),
            'migrated' => $migrated_count,
            'errors' => $error_count,
            'skipped' => $skipped_count,
            'total' => count($users_with_points)
        ]);
        
        // Formatta l'output
        $output .= '<p>Migrazione completata!</p>';
        $output .= '<ul>';
        $output .= '<li>Utenti processati: <strong>' . count($users_with_points) . '</strong></li>';
        $output .= '<li>Utenti migrati con successo: <strong>' . $migrated_count . '</strong></li>';
        if ($error_count > 0) {
            $output .= '<li>Errori: <strong>' . $error_count . '</strong></li>';
        }
        if ($skipped_count > 0) {
            $output .= '<li>Utenti saltati (non esistenti): <strong>' . $skipped_count . '</strong></li>';
        }
        $output .= '</ul>';
        
        return $output;
    }
}

// Inizializza il plugin
new WP_Points_Migration();
