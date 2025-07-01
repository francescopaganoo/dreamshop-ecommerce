<?php
/**
 * Test SQL diretto per la tabella dei punti DreamShop
 * 
 * Questo script consente di interrogare direttamente il database per verificare
 * i punti di un utente specifico, bypassando l'API REST.
 */

// Includi i file di WordPress per accedere alle funzioni di database
define('WP_USE_THEMES', false);
require_once('wp-load.php');

// Imposta header JSON per la risposta
header('Content-Type: application/json');

// Abilita la visualizzazione degli errori per il debug
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Funzione per generare log dettagliati
function debug_log($message, $type = 'info') {
    return [
        'type' => $type,
        'message' => $message,
        'time' => date('Y-m-d H:i:s')
    ];
}

$response = [
    'success' => false,
    'logs' => [],
    'data' => null,
    'query_info' => []
];

// Verifica l'ID utente
if (!isset($_GET['user_id']) || empty($_GET['user_id'])) {
    $response['logs'][] = debug_log('ID utente non fornito', 'error');
    echo json_encode($response);
    exit;
}

$user_id = intval($_GET['user_id']);
$response['query_info']['user_id'] = $user_id;

// Verifica se l'utente esiste
$user = get_user_by('id', $user_id);
if (!$user) {
    $response['logs'][] = debug_log("Utente con ID {$user_id} non trovato nel database WordPress", 'error');
    echo json_encode($response);
    exit;
}

$response['logs'][] = debug_log("Utente trovato: {$user->user_login} (ID: {$user_id})", 'success');

// Ottieni il prefisso della tabella WordPress
global $wpdb;
$table_prefix = $wpdb->prefix;
$response['query_info']['table_prefix'] = $table_prefix;

// Nome della tabella dei punti (controlla se corrisponde alla definizione nel plugin)
$points_table = $table_prefix . 'dreamshop_points_users';
$response['query_info']['points_table'] = $points_table;

// Verifica se la tabella esiste
$table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$points_table}'");
if (!$table_exists) {
    $response['logs'][] = debug_log("La tabella {$points_table} non esiste nel database", 'error');
    
    // Lista di tutte le tabelle per debug
    $all_tables = $wpdb->get_results("SHOW TABLES", ARRAY_N);
    $tables_list = [];
    foreach ($all_tables as $table) {
        $tables_list[] = $table[0];
    }
    $response['query_info']['available_tables'] = $tables_list;
    
    echo json_encode($response);
    exit;
}

$response['logs'][] = debug_log("Tabella dei punti trovata: {$points_table}", 'success');

// Esegui query diretta per ottenere i punti dell'utente
$query = $wpdb->prepare("SELECT * FROM {$points_table} WHERE user_id = %d", $user_id);
$points_record = $wpdb->get_row($query);

$response['query_info']['query'] = $query;

if ($points_record === null) {
    $response['logs'][] = debug_log("Nessun record di punti trovato per l'utente {$user_id}", 'warning');
    
    // Controlla se ci sono altri record nella tabella
    $total_records = $wpdb->get_var("SELECT COUNT(*) FROM {$points_table}");
    $response['query_info']['total_records_in_table'] = $total_records;
    
    if ($total_records > 0) {
        // Mostra alcuni esempi di record esistenti per debug
        $sample_records = $wpdb->get_results("SELECT * FROM {$points_table} LIMIT 5");
        $response['query_info']['sample_records'] = $sample_records;
    }
} else {
    $response['logs'][] = debug_log("Record punti trovato per l'utente {$user_id}", 'success');
    $response['data'] = $points_record;
    $response['success'] = true;
    
    // Ottenere anche la cronologia punti se esiste una tabella per questo
    $history_table = $table_prefix . 'dreamshop_points_history';
    $history_exists = $wpdb->get_var("SHOW TABLES LIKE '{$history_table}'");
    
    if ($history_exists) {
        $history_query = $wpdb->prepare("SELECT * FROM {$history_table} WHERE user_id = %d ORDER BY date DESC LIMIT 10", $user_id);
        $history_records = $wpdb->get_results($history_query);
        $response['data']['history'] = $history_records;
        $response['logs'][] = debug_log("Recuperate " . count($history_records) . " voci di cronologia punti", 'info');
    } else {
        $response['logs'][] = debug_log("Tabella cronologia punti non trovata", 'warning');
    }
}

// Aggiungi informazioni di sistema per debug
$response['system_info'] = [
    'wp_version' => get_bloginfo('version'),
    'php_version' => phpversion(),
    'time' => current_time('mysql'),
    'timezone' => wp_timezone_string()
];

echo json_encode($response, JSON_PRETTY_PRINT);
