<?php
/**
 * Plugin Name: DreamShop Product Notifications
 * Plugin URI: https://planstudios.it
 * Description: Gestisce le notifiche quando i prodotti tornano disponibili. Gli utenti possono iscriversi per ricevere email quando un prodotto esaurito torna in stock.
 * Version: 1.0.0
 * Author: Plan Studios Group - FP
 * License: GPL v2 or later
 * Text Domain: dreamshop-product-notifications
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('DSPN_VERSION', '1.0.0');
define('DSPN_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('DSPN_PLUGIN_URL', plugin_dir_url(__FILE__));
define('DSPN_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Main plugin class
 */
class DreamShop_Product_Notifications {
    
    /**
     * Constructor
     */
    public function __construct() {
        add_action('init', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    /**
     * Initialize the plugin
     */
    public function init() {
        // Check and update template if needed
        $this->maybe_update_template();

        // Load includes
        $this->load_dependencies();

        // Initialize components
        if (is_admin()) {
            new DSPN_Admin();
        }

        new DSPN_Database();
        new DSPN_API();
        new DSPN_Stock_Monitor();
        new DSPN_Email_Handler();
    }
    
    /**
     * Load plugin dependencies
     */
    private function load_dependencies() {
        require_once DSPN_PLUGIN_DIR . 'includes/class-dspn-database.php';
        require_once DSPN_PLUGIN_DIR . 'includes/class-dspn-api.php';
        require_once DSPN_PLUGIN_DIR . 'includes/class-dspn-stock-monitor.php';
        require_once DSPN_PLUGIN_DIR . 'includes/class-dspn-email-handler.php';
        
        if (is_admin()) {
            require_once DSPN_PLUGIN_DIR . 'admin/class-dspn-admin.php';
        }
    }
    
    /**
     * Plugin activation
     */
    public function activate() {
        // Load database class before using it
        require_once DSPN_PLUGIN_DIR . 'includes/class-dspn-database.php';

        // Create database tables
        $database = new DSPN_Database();
        $database->create_tables();

        // Set default options
        add_option('dspn_email_template', $this->get_default_email_template());
        add_option('dspn_from_email', get_option('admin_email'));
        add_option('dspn_from_name', get_bloginfo('name'));
        add_option('dspn_enabled', '1');

        // Update template version
        update_option('dspn_template_version', '2.0');
    }
    
    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Clean up if needed
    }
    
    /**
     * Get default email template
     */
    private function get_default_email_template() {
        return '
        <div style="max-width: 600px; margin: 0 auto; font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #a2180e 0%, #8b1508 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🔥 PRODOTTO DISPONIBILE!</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Il tuo desiderio è esaudito</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px; background-color: #ffffff;">
                <h2 style="color: #333333; font-size: 24px; margin: 0 0 20px 0; text-align: center;">
                    Ciao {customer_name}! 👋
                </h2>

                <div style="background-color: #f8f9fa; padding: 25px; border-radius: 10px; border-left: 4px solid #a2180e; margin: 20px 0;">
                    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                        Abbiamo <strong style="color: #a2180e;">ottime notizie</strong> per te! Il prodotto che stavi aspettando è finalmente tornato disponibile nel nostro store.
                    </p>
                </div>

                <!-- Product Section -->
                <div style="background-color: #ffffff; border: 2px solid #e9ecef; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
                    {product_image}
                    <h3 style="color: #a2180e; font-size: 22px; margin: 15px 0 10px 0; font-weight: bold;">
                        {product_name}
                    </h3>
                    <div style="font-size: 20px; font-weight: bold; color: #333333; margin: 10px 0;">
                        {product_price}
                    </div>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 35px 0;">
                    <a href="{product_url}" style="background: linear-gradient(135deg, #a2180e 0%, #8b1508 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(162, 24, 14, 0.3); transition: all 0.3s ease;">
                        🛒 ACQUISTA ORA
                    </a>
                </div>

                <!-- Urgency Message -->
                <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 1px solid #ffc107; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
                    <p style="margin: 0; color: #856404; font-size: 16px; font-weight: bold;">
                        ⚡ Non perdere questa opportunità! Le quantità potrebbero essere limitate.
                    </p>
                </div>

                <!-- Footer Message -->
                <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e9ecef; margin-top: 30px;">
                    <p style="margin: 0 0 10px 0; color: #666666; font-size: 16px;">
                        Cordiali saluti,
                    </p>
                    <p style="margin: 0; color: #a2180e; font-size: 18px; font-weight: bold;">
                        Il team di {shop_name}
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-radius: 0 0 10px 10px; border-top: 1px solid #e9ecef;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                    Visita il nostro store: <a href="{shop_url}" style="color: #a2180e; text-decoration: none;">{shop_name}</a>
                </p>
                <p style="margin: 0; font-size: 12px; color: #999999;">
                    Non vuoi più ricevere queste notifiche? <a href="{unsubscribe_url}" style="color: #a2180e; text-decoration: none;">Disiscriviti qui</a>
                </p>
            </div>
        </div>
        ';
    }

    /**
     * Check if template needs to be updated and update if needed
     */
    private function maybe_update_template() {
        $current_version = get_option('dspn_template_version', '1.0');

        // If version is older than 2.0, update the template
        if (version_compare($current_version, '2.0', '<')) {
            $existing_template = get_option('dspn_email_template', '');

            // Only update if the template hasn't been heavily customized
            // Check if it contains the old simple structure
            if (strpos($existing_template, 'Il prodotto che stavi aspettando') !== false ||
                strpos($existing_template, '<h2>Il prodotto che stavi aspettando è tornato disponibile!</h2>') !== false) {

                // Update to new template
                update_option('dspn_email_template', $this->get_default_email_template());
                update_option('dspn_template_version', '2.0');

                // Log the update
                error_log('DSPN: Email template updated to version 2.0');
            }
        }
    }
}

// Initialize the plugin
new DreamShop_Product_Notifications();