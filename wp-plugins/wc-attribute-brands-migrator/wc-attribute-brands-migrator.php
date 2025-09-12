<?php
/**
 * Plugin Name:       WooCommerce Brand Attribute Migrator
 * Description:       Migra l'attributo prodotto "brand" (tipicamente pa_brand) verso la tassonomia Marchi.
 * Version:           1.0.0
 * Author:            Codex CLI
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * License:           GPL-2.0-or-later
 * Text Domain:       wcabm
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

if ( ! function_exists( 'add_action' ) ) {
    return;
}

define( 'WCABM_VERSION', '1.0.0' );
define( 'WCABM_PATH', plugin_dir_path( __FILE__ ) );
define( 'WCABM_URL', plugin_dir_url( __FILE__ ) );

// Autoload simple: include class file.
require_once WCABM_PATH . 'includes/class-wcabm-migrator.php';

class WCABM_Plugin {
    public function __construct() {
        add_action( 'admin_menu', [ $this, 'add_admin_menu' ] );
        add_action( 'admin_init', [ $this, 'maybe_run_migration' ] );
        add_action( 'admin_notices', [ $this, 'maybe_show_requirements_notice' ] );
    }

    public function add_admin_menu() {
        add_management_page(
            __( 'Migra Brand → Marchi', 'wcabm' ),
            __( 'Migra Brand → Marchi', 'wcabm' ),
            'manage_woocommerce',
            'wcabm-migrate',
            [ $this, 'render_tools_page' ]
        );
    }

    private function get_source_taxonomy() {
        $default = 'pa_brand';
        // Prova a dedurre da attributi WooCommerce se esiste un attributo con nome "brand".
        if ( function_exists( 'wc_get_attribute_taxonomies' ) ) {
            $atts = wc_get_attribute_taxonomies();
            if ( $atts ) {
                foreach ( $atts as $att ) {
                    if ( strtolower( $att->attribute_name ) === 'brand' ) {
                        $default = 'pa_' . $att->attribute_name;
                        break;
                    }
                }
            }
        }
        /**
         * Filtro per scegliere la taxonomy sorgente (attributo) da migrare.
         * Default: pa_brand
         */
        return apply_filters( 'wcabm_source_taxonomy', $default );
    }

    private function get_target_taxonomy() {
        /**
         * Filtro per impostare la taxonomy target Marchi.
         * Default: product_brand (WooCommerce Brands ufficiale)
         * Per Perfect WooCommerce Brands usare: pwb-brand
         */
        $default = 'product_brand';
        return apply_filters( 'wcabm_target_taxonomy', $default );
    }

    public function maybe_show_requirements_notice() {
        if ( ! current_user_can( 'manage_woocommerce' ) ) return;

        $source = $this->get_source_taxonomy();
        $target = $this->get_target_taxonomy();

        // Avvisa se la taxonomy target non è registrata (plugin Marchi mancante?)
        if ( ! taxonomy_exists( $target ) ) {
            echo '<div class="notice notice-warning"><p>' . esc_html( sprintf(
                /* translators: 1: taxonomy slug */
                __( 'La taxonomy target "%s" non risulta registrata. Installa/attiva il plugin Marchi corrispondente o modifica lo slug con il filtro wcabm_target_taxonomy.', 'wcabm' ),
                $target
            ) ) . '</p></div>';
        }

        // Avvisa se la taxonomy sorgente non esiste
        if ( ! taxonomy_exists( $source ) ) {
            echo '<div class="notice notice-error"><p>' . esc_html( sprintf(
                /* translators: 1: taxonomy slug */
                __( 'La taxonomy sorgente "%s" non esiste. Verifica il nome dell\'attributo o imposta wcabm_source_taxonomy.', 'wcabm' ),
                $source
            ) ) . '</p></div>';
        }
    }

    public function render_tools_page() {
        if ( ! current_user_can( 'manage_woocommerce' ) ) {
            wp_die( __( 'Permessi insufficienti.', 'wcabm' ) );
        }

        $source = $this->get_source_taxonomy();
        $target = $this->get_target_taxonomy();
        $limit  = isset( $_GET['wcabm_limit'] ) ? absint( $_GET['wcabm_limit'] ) : 0;

        echo '<div class="wrap">';
        echo '<h1>' . esc_html__( 'Migrazione Attributo Brand → Marchi', 'wcabm' ) . '</h1>';
        echo '<p>' . esc_html__( 'Questo strumento copia tutti i termini dell\'attributo brand verso la taxonomy Marchi e associa i prodotti ai relativi marchi.', 'wcabm' ) . '</p>';

        echo '<p><strong>' . esc_html__( 'Sorgente (attributo):', 'wcabm' ) . '</strong> <code>' . esc_html( $source ) . '</code></p>';
        echo '<p><strong>' . esc_html__( 'Target (marchi):', 'wcabm' ) . '</strong> <code>' . esc_html( $target ) . '</code></p>';

        if ( isset( $_GET['wcabm_result'] ) ) {
            $result = json_decode( base64_decode( sanitize_text_field( wp_unslash( $_GET['wcabm_result'] ) ) ), true );
            if ( is_array( $result ) ) {
                echo '<div class="notice notice-success"><p>' . esc_html( sprintf(
                    /* translators: 1: terms migrated, 2: products updated */
                    __( 'Migrazione completata: %1$d termini marchio creati/aggiornati, %2$d prodotti assegnati.', 'wcabm' ),
                    (int) $result['terms'],
                    (int) $result['products']
                ) ) . '</p></div>';
            }
        }

        echo '<form method="post">';
        wp_nonce_field( 'wcabm_migrate', 'wcabm_nonce' );
        echo '<p><label for="wcabm_limit"><strong>' . esc_html__( 'Limite prodotti da migrare', 'wcabm' ) . '</strong></label><br />';
        echo '<input type="number" min="1" step="1" id="wcabm_limit" name="wcabm_limit" value="' . esc_attr( $limit ? $limit : '' ) . '" placeholder="(tutti)" /> ';
        echo '<span class="description">' . esc_html__( 'Lascia vuoto per migrare tutti. Inserisci 1 per un test.', 'wcabm' ) . '</span></p>';
        submit_button( __( 'Esegui migrazione', 'wcabm' ) );
        echo '</form>';
        echo '</div>';
    }

    public function maybe_run_migration() {
        if ( ! is_admin() ) return;
        if ( empty( $_POST['wcabm_nonce'] ) ) return;
        if ( ! current_user_can( 'manage_woocommerce' ) ) return;
        if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['wcabm_nonce'] ) ), 'wcabm_migrate' ) ) return;

        $source = $this->get_source_taxonomy();
        $target = $this->get_target_taxonomy();
        $limit  = isset( $_POST['wcabm_limit'] ) ? absint( $_POST['wcabm_limit'] ) : 0;

        $migrator = new WCABM_Migrator( $source, $target );
        $result   = $migrator->run( $limit );

        $encoded = base64_encode( wp_json_encode( $result ) );
        $redirect = add_query_arg(
            [
                'wcabm_result' => rawurlencode( $encoded ),
                'wcabm_limit'  => $limit ? $limit : null,
            ],
            admin_url( 'tools.php?page=wcabm-migrate' )
        );
        wp_safe_redirect( $redirect );
        exit;
    }
}

add_action( 'plugins_loaded', static function() {
    if ( class_exists( 'WooCommerce' ) ) {
        new WCABM_Plugin();
    }
} );
