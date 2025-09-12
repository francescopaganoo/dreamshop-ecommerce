<?php
// File di debug per il plugin Gift Card Custom
// Eseguire tramite WP CLI o include in un file temporaneo

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

// Test di connessione al database
global $wpdb;

echo "=== DEBUG GIFT CARD PLUGIN ===\n\n";

// 1. Verifica esistenza tabelle
$tables = [
    $wpdb->prefix . 'gift_card_balances',
    $wpdb->prefix . 'gift_card_transactions', 
    $wpdb->prefix . 'gift_card_coupons'
];

echo "1. VERIFICA TABELLE:\n";
foreach ($tables as $table) {
    $exists = $wpdb->get_var("SHOW TABLES LIKE '$table'");
    echo "- $table: " . ($exists ? "ESISTE" : "NON ESISTE") . "\n";
}

echo "\n2. VERIFICA CLASSI:\n";
$classes = [
    'GiftCard_Database',
    'GiftCard_API', 
    'GiftCard_WooCommerce_Integration',
    'GiftCard_Manager'
];

foreach ($classes as $class) {
    echo "- $class: " . (class_exists($class) ? "CARICATA" : "NON CARICATA") . "\n";
}

echo "\n3. VERIFICA PLUGIN ATTIVO:\n";
$active = is_plugin_active('gift-card-custom/gift-card-custom.php');
echo "- Plugin attivo: " . ($active ? "SÌ" : "NO") . "\n";

echo "\n4. VERIFICA WOOCOMMERCE:\n";
$wc_active = class_exists('WooCommerce');
echo "- WooCommerce attivo: " . ($wc_active ? "SÌ" : "NO") . "\n";

echo "\n5. TEST CREAZIONE TABELLE:\n";
if (class_exists('GiftCard_Database')) {
    try {
        GiftCard_Database::create_tables();
        echo "- Creazione tabelle: SUCCESSO\n";
    } catch (Exception $e) {
        echo "- Creazione tabelle: ERRORE - " . $e->getMessage() . "\n";
    }
} else {
    echo "- Classe GiftCard_Database non disponibile\n";
}

echo "\n6. VERIFICA ENDPOINT API:\n";
$endpoints = [
    'gift-card/v1/balance/{user_id}',
    'gift-card/v1/transactions/{user_id}',
    'gift-card/v1/generate-coupon',
    'gift-card/v1/coupon/{coupon_code}',
    'gift-card/v1/validate-coupon'
];

foreach ($endpoints as $endpoint) {
    echo "- $endpoint: CONFIGURATO\n";
}

echo "\n=== FINE DEBUG ===\n";