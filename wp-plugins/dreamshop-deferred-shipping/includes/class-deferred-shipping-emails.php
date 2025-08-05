<?php
/**
 * Email management class
 */

if (!defined('ABSPATH')) {
    exit;
}

class DreamShop_Deferred_Shipping_Emails {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        // Constructor
    }
    
    /**
     * Send shipping payment notification email
     */
    public function send_shipping_payment_notification($shipping_order, $original_order) {
        $customer_email = $shipping_order->get_billing_email();
        
        if (!$customer_email) {
            return false;
        }
        
        $subject = sprintf('Spedizione disponibile per il tuo ordine #%s', $original_order->get_order_number());
        
        $message = $this->get_email_template($shipping_order, $original_order);
        
        $headers = array(
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . get_option('woocommerce_email_from_name') . ' <' . get_option('woocommerce_email_from_address') . '>'
        );
        
        return wp_mail($customer_email, $subject, $message, $headers);
    }
    
    /**
     * Get email template
     */
    private function get_email_template($shipping_order, $original_order) {
        $customer_name = $shipping_order->get_billing_first_name();
        $site_name = get_bloginfo('name');
        $payment_url = $this->get_payment_url($shipping_order);
        
        ob_start();
        ?>
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Spedizione Disponibile</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #f8f8f8; padding: 20px; text-align: center; border-bottom: 3px solid #007cba; }
                .content { padding: 30px 20px; }
                .order-details { background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px; }
                .button { display: inline-block; background: #007cba; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .button:hover { background: #005a87; }
                .footer { background: #f8f8f8; padding: 20px; text-align: center; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1><?php echo esc_html($site_name); ?></h1>
                    <h2>Spedizione Disponibile</h2>
                </div>
                
                <div class="content">
                    <p>Ciao <?php echo esc_html($customer_name); ?>,</p>
                    
                    <p>La spedizione per il tuo ordine è ora disponibile e pronta per essere pagata!</p>
                    
                    <div class="order-details">
                        <h3>Dettagli Ordine</h3>
                        <p><strong>Ordine Originale:</strong> #<?php echo esc_html($original_order->get_order_number()); ?></p>
                        <p><strong>Ordine Spedizione:</strong> #<?php echo esc_html($shipping_order->get_order_number()); ?></p>
                        <p><strong>Importo Spedizione:</strong> <?php echo wc_price($shipping_order->get_total()); ?></p>
                        <p><strong>Data:</strong> <?php echo date_i18n(get_option('date_format'), strtotime($shipping_order->get_date_created())); ?></p>
                    </div>
                    
                    <p>Per completare la spedizione del tuo ordine, è necessario pagare l'importo indicato sopra.</p>
                    
                    <p style="text-align: center;">
                        <a href="<?php echo esc_url($payment_url); ?>" class="button">PAGA ORA</a>
                    </p>
                    
                    <p><small>Puoi anche accedere al tuo account per visualizzare e pagare tutte le spedizioni in sospeso.</small></p>
                    
                    <p>Grazie per aver scelto <?php echo esc_html($site_name); ?>!</p>
                </div>
                
                <div class="footer">
                    <p><?php echo esc_html($site_name); ?> | <?php echo esc_html(get_option('woocommerce_email_from_address')); ?></p>
                    <p>Questa è una email automatica, non rispondere a questo messaggio.</p>
                </div>
            </div>
        </body>
        </html>
        <?php
        
        return ob_get_clean();
    }
    
    /**
     * Get payment URL for shipping order
     */
    private function get_payment_url($shipping_order) {
        // For now, return WooCommerce pay URL
        // Later we can customize this to point to our frontend
        return $shipping_order->get_checkout_payment_url();
    }
    
    /**
     * Send reminder email
     */
    public function send_payment_reminder($shipping_order_id) {
        $shipping_order = wc_get_order($shipping_order_id);
        
        if (!$shipping_order || $shipping_order->get_status() !== 'pending') {
            return false;
        }
        
        $original_order_id = $shipping_order->get_meta('_original_order_id');
        $original_order = wc_get_order($original_order_id);
        
        if (!$original_order) {
            return false;
        }
        
        $customer_email = $shipping_order->get_billing_email();
        $customer_name = $shipping_order->get_billing_first_name();
        $site_name = get_bloginfo('name');
        $payment_url = $this->get_payment_url($shipping_order);
        
        $subject = sprintf('Promemoria: Spedizione in attesa di pagamento - Ordine #%s', $original_order->get_order_number());
        
        $message = sprintf('
            <p>Ciao %s,</p>
            <p>Ti ricordiamo che hai ancora una spedizione in attesa di pagamento per il tuo ordine #%s.</p>
            <p><strong>Importo:</strong> %s</p>
            <p><a href="%s" style="background: #007cba; color: white; padding: 10px 20px; text-decoration: none;">Paga Ora</a></p>
            <p>Grazie,<br>%s</p>
        ', 
            esc_html($customer_name),
            esc_html($original_order->get_order_number()),
            wc_price($shipping_order->get_total()),
            esc_url($payment_url),
            esc_html($site_name)
        );
        
        $headers = array(
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . get_option('woocommerce_email_from_name') . ' <' . get_option('woocommerce_email_from_address') . '>'
        );
        
        return wp_mail($customer_email, $subject, $message, $headers);
    }
}