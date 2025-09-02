<?php
// Evita l'accesso diretto
if (!defined('ABSPATH')) {
    exit;
}

// Salva le impostazioni se il form è stato inviato
if (isset($_POST['submit'])) {
    check_admin_referer('dreamshop_pending_cleanup_settings');
    
    update_option('dreamshop_pending_timeout_hours', intval($_POST['timeout_hours']));
    update_option('dreamshop_pending_statuses', $_POST['statuses']);
    update_option('dreamshop_pending_enable_logging', isset($_POST['enable_logging']) ? 1 : 0);
    
    echo '<div class="notice notice-success"><p>Impostazioni salvate con successo!</p></div>';
}

// Ottieni le impostazioni correnti
$timeout_hours = get_option('dreamshop_pending_timeout_hours', 3);
$monitored_statuses = get_option('dreamshop_pending_statuses', array('pending', 'on-hold'));
$enable_logging = get_option('dreamshop_pending_enable_logging', 1);
$stats = get_option('dreamshop_pending_cleanup_stats', array());
$log = get_option('dreamshop_pending_cleanup_log', array());

// Statistiche degli ultimi cleanup
$total_deleted = array_sum(array_column($stats, 'deleted'));
$last_run = !empty($stats) ? end($stats)['date'] : 'Mai eseguito';

// Analisi del log
$guest_orders = 0;
$registered_orders = 0;
$repeated_users = array();

foreach ($log as $entry) {
    if ($entry['customer_type'] === 'guest') {
        $guest_orders++;
    } else {
        $registered_orders++;
        $email = $entry['customer_email'];
        $repeated_users[$email] = ($repeated_users[$email] ?? 0) + 1;
    }
}

// Trova utenti che abbandonano spesso
$frequent_abandoners = array_filter($repeated_users, function($count) { return $count >= 3; });
arsort($frequent_abandoners);

?>

<div class="wrap">
    <h1>Pulizia Ordini in Attesa</h1>
    
    <div class="nav-tab-wrapper">
        <a href="#settings" class="nav-tab nav-tab-active" onclick="showTab('settings')">Impostazioni</a>
        <a href="#stats" class="nav-tab" onclick="showTab('stats')">Statistiche</a>
        <a href="#log" class="nav-tab" onclick="showTab('log')">Log Cancellazioni</a>
        <a href="#analysis" class="nav-tab" onclick="showTab('analysis')">Analisi Utenti</a>
    </div>

    <!-- Tab Impostazioni -->
    <div id="settings-tab" class="tab-content">
        <form method="post" action="">
            <?php wp_nonce_field('dreamshop_pending_cleanup_settings'); ?>
            
            <table class="form-table">
                <tr>
                    <th scope="row">Timeout Cancellazione (ore)</th>
                    <td>
                        <input type="number" name="timeout_hours" value="<?php echo esc_attr($timeout_hours); ?>" min="1" max="168" />
                        <p class="description">Dopo quante ore cancellare gli ordini in attesa (default: 3 ore)</p>
                    </td>
                </tr>
                
                <tr>
                    <th scope="row">Stati da Monitorare</th>
                    <td>
                        <fieldset>
                            <label><input type="checkbox" name="statuses[]" value="pending" <?php checked(in_array('pending', $monitored_statuses)); ?> /> In Attesa di Pagamento (pending)</label><br>
                            <label><input type="checkbox" name="statuses[]" value="on-hold" <?php checked(in_array('on-hold', $monitored_statuses)); ?> /> In Sospeso (on-hold)</label><br>
                            <label><input type="checkbox" name="statuses[]" value="failed" <?php checked(in_array('failed', $monitored_statuses)); ?> /> Fallito (failed)</label>
                        </fieldset>
                        <p class="description">Seleziona quali stati di ordini monitorare per la cancellazione automatica</p>
                    </td>
                </tr>
                
                <tr>
                    <th scope="row">Abilita Logging</th>
                    <td>
                        <input type="checkbox" name="enable_logging" value="1" <?php checked($enable_logging); ?> />
                        <p class="description">Mantieni un log dettagliato delle cancellazioni per analisi</p>
                    </td>
                </tr>
            </table>
            
            <?php submit_button('Salva Impostazioni'); ?>
        </form>
        
        <hr>
        
        <h3>Azioni Manuali</h3>
        <p>
            <button type="button" id="manual-cleanup" class="button button-secondary">
                Esegui Pulizia Manuale Ora
            </button>
            <span class="description">Esegue immediatamente la pulizia degli ordini scaduti</span>
        </p>
        
        <div id="cleanup-result" style="margin-top: 10px;"></div>
    </div>

    <!-- Tab Statistiche -->
    <div id="stats-tab" class="tab-content" style="display:none;">
        <h3>Statistiche Generali</h3>
        <table class="widefat">
            <tr>
                <td><strong>Ultima Esecuzione:</strong></td>
                <td><?php echo esc_html($last_run); ?></td>
            </tr>
            <tr>
                <td><strong>Totale Ordini Cancellati:</strong></td>
                <td><?php echo esc_html($total_deleted); ?></td>
            </tr>
            <tr>
                <td><strong>Prossima Esecuzione:</strong></td>
                <td><?php 
                    $next_run = wp_next_scheduled('dreamshop_cleanup_pending_orders');
                    echo $next_run ? date('Y-m-d H:i:s', $next_run) : 'Non schedulata';
                ?></td>
            </tr>
        </table>
        
        <?php if (!empty($stats)): ?>
        <h3>Ultime Esecuzioni</h3>
        <table class="widefat">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Ordini Trovati</th>
                    <th>Ordini Cancellati</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach (array_slice(array_reverse($stats), 0, 20) as $stat): ?>
                <tr>
                    <td><?php echo esc_html($stat['date']); ?></td>
                    <td><?php echo esc_html($stat['found']); ?></td>
                    <td><?php echo esc_html($stat['deleted']); ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>

    <!-- Tab Log -->
    <div id="log-tab" class="tab-content" style="display:none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0;">Log Cancellazioni (ultimi 50)</h3>
            <?php if (!empty($log)): ?>
            <button type="button" id="clear-log" class="button" style="background: #dc3545; color: white; border-color: #dc3545;">
                🗑️ Cancella Log
            </button>
            <?php endif; ?>
        </div>
        
        <div id="clear-log-result" style="margin-bottom: 10px;"></div>
        
        <?php if (!empty($log)): ?>
        <table class="widefat">
            <thead>
                <tr>
                    <th>ID Ordine</th>
                    <th>Data Ordine</th>
                    <th>Data Cancellazione</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Totale</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach (array_slice($log, 0, 50) as $entry): ?>
                <tr>
                    <td>#<?php echo esc_html($entry['order_id']); ?></td>
                    <td><?php echo esc_html($entry['order_date']); ?></td>
                    <td><?php echo esc_html($entry['deleted_at']); ?></td>
                    <td>
                        <?php if ($entry['customer_type'] === 'guest'): ?>
                            <?php echo esc_html($entry['customer_email']); ?>
                        <?php else: ?>
                            <?php echo esc_html($entry['customer_name']); ?><br>
                            <small><?php echo esc_html($entry['customer_email']); ?></small>
                        <?php endif; ?>
                    </td>
                    <td>
                        <span class="<?php echo $entry['customer_type'] === 'guest' ? 'guest' : 'registered'; ?>">
                            <?php echo $entry['customer_type'] === 'guest' ? 'Ospite' : 'Registrato'; ?>
                        </span>
                    </td>
                    <td>€<?php echo esc_html(number_format($entry['order_total'], 2)); ?></td>
                    <td><?php echo esc_html($entry['order_status']); ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php else: ?>
        <p>Nessun ordine ancora cancellato.</p>
        <?php endif; ?>
    </div>

    <!-- Tab Analisi -->
    <div id="analysis-tab" class="tab-content" style="display:none;">
        <h3>Analisi Tipologie Clienti</h3>
        <div style="display: flex; gap: 20px; margin-bottom: 20px;">
            <div class="postbox" style="padding: 15px; flex: 1;">
                <h4>Tipologia Cliente</h4>
                <p><strong>Ospiti:</strong> <?php echo $guest_orders; ?> ordini</p>
                <p><strong>Registrati:</strong> <?php echo $registered_orders; ?> ordini</p>
                <?php if ($guest_orders + $registered_orders > 0): ?>
                <p><strong>% Ospiti:</strong> <?php echo round(($guest_orders / ($guest_orders + $registered_orders)) * 100, 1); ?>%</p>
                <?php endif; ?>
            </div>
        </div>
        
        <?php if (!empty($frequent_abandoners)): ?>
        <h3>Utenti con Abbandoni Frequenti (≥3 ordini cancellati)</h3>
        <table class="widefat">
            <thead>
                <tr>
                    <th>Email Cliente</th>
                    <th>Ordini Abbandonati</th>
                    <th>Azioni</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($frequent_abandoners as $email => $count): ?>
                <tr>
                    <td><?php echo esc_html($email); ?></td>
                    <td><?php echo esc_html($count); ?></td>
                    <td>
                        <small>Considera l'invio di email di follow-up o assistenza</small>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php else: ?>
        <p>Nessun utente con abbandoni frequenti identificato.</p>
        <?php endif; ?>
    </div>
</div>

<style>
.tab-content {
    background: white;
    padding: 20px;
    border: 1px solid #ccd0d4;
    border-top: none;
}

.nav-tab-active {
    background: white !important;
    border-bottom-color: white !important;
}

.guest {
    color: #666;
    font-style: italic;
}

.registered {
    color: #0073aa;
    font-weight: bold;
}

.postbox {
    background: white;
    border: 1px solid #c3c4c7;
    border-radius: 4px;
}
</style>

<script>
function showTab(tabName) {
    // Nascondi tutti i tab
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Rimuovi classe active da tutti i nav-tab
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('nav-tab-active');
    });
    
    // Mostra il tab selezionato
    document.getElementById(tabName + '-tab').style.display = 'block';
    
    // Aggiungi classe active al nav-tab cliccato
    event.target.classList.add('nav-tab-active');
}

// Gestisci cleanup manuale
document.addEventListener('DOMContentLoaded', function() {
    const manualButton = document.getElementById('manual-cleanup');
    const resultDiv = document.getElementById('cleanup-result');
    
    if (manualButton) {
        manualButton.addEventListener('click', function() {
            this.disabled = true;
            this.textContent = 'Esecuzione in corso...';
            resultDiv.innerHTML = '';
            
            const formData = new FormData();
            formData.append('action', 'dreamshop_manual_cleanup');
            formData.append('nonce', '<?php echo wp_create_nonce('dreamshop_manual_cleanup'); ?>');
            
            fetch(ajaxurl, {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    resultDiv.innerHTML = '<div class="notice notice-success"><p>' + data.data.message + '</p></div>';
                    // Ricarica la pagina dopo 2 secondi per aggiornare le statistiche
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    resultDiv.innerHTML = '<div class="notice notice-error"><p>Errore durante l\'esecuzione</p></div>';
                }
            })
            .catch(error => {
                resultDiv.innerHTML = '<div class="notice notice-error"><p>Errore di connessione</p></div>';
            })
            .finally(() => {
                this.disabled = false;
                this.textContent = 'Esegui Pulizia Manuale Ora';
            });
        });
    }
    
    // Gestisci cancellazione log
    const clearLogButton = document.getElementById('clear-log');
    const clearLogResultDiv = document.getElementById('clear-log-result');
    
    if (clearLogButton) {
        clearLogButton.addEventListener('click', function() {
            if (!confirm('Sei sicuro di voler cancellare tutto il log? Questa azione non può essere annullata.')) {
                return;
            }
            
            this.disabled = true;
            this.textContent = '🗑️ Cancellazione...';
            clearLogResultDiv.innerHTML = '';
            
            const formData = new FormData();
            formData.append('action', 'dreamshop_clear_log');
            formData.append('nonce', '<?php echo wp_create_nonce('dreamshop_clear_log'); ?>');
            
            fetch(ajaxurl, {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    clearLogResultDiv.innerHTML = '<div class="notice notice-success"><p>' + data.data.message + '</p></div>';
                    // Ricarica la pagina dopo 1 secondo per aggiornare la vista
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    clearLogResultDiv.innerHTML = '<div class="notice notice-error"><p>Errore durante la cancellazione del log</p></div>';
                }
            })
            .catch(error => {
                clearLogResultDiv.innerHTML = '<div class="notice notice-error"><p>Errore di connessione</p></div>';
            })
            .finally(() => {
                this.disabled = false;
                this.textContent = '🗑️ Cancella Log';
            });
        });
    }
});
</script>