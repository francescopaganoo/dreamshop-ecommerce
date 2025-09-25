<?php
/**
 * Email handling for DreamShop Product Notifications
 */

if (!defined('ABSPATH')) {
    exit;
}

class DSPN_Email_Handler {
    
    /**
     * Send stock notification email
     */
    public function send_stock_notification($email, $customer_name, $product, $notification_id) {
        // Get email settings
        $from_email = get_option('dspn_from_email', get_option('admin_email'));
        $from_name = get_option('dspn_from_name', get_bloginfo('name'));
        $template = get_option('dspn_email_template');
        
        // Prepare email content
        $subject = sprintf('🔥 %s è di nuovo disponibile!', $product->get_name());
        
        $placeholders = array(
            '{customer_name}' => !empty($customer_name) ? $customer_name : 'Cliente',
            '{product_name}' => $product->get_name(),
            '{product_url}' => $this->get_product_url($product),
            '{product_price}' => $product->get_price_html(),
            '{product_image}' => $this->get_product_image($product),
            '{shop_name}' => get_bloginfo('name'),
            '{shop_url}' => $this->get_shop_url(),
            '{unsubscribe_url}' => $this->get_unsubscribe_url($email, $product->get_id(), $notification_id)
        );
        
        $message = str_replace(array_keys($placeholders), array_values($placeholders), $template);

        // Normalize line breaks and ensure proper spacing
        $message = $this->normalize_email_formatting($message);
        
        // Set email headers
        $headers = array(
            'Content-Type: text/html; charset=UTF-8',
            sprintf('From: %s <%s>', $from_name, $from_email),
        );
        
        // Add unsubscribe link to footer if not already in template
        if (strpos($message, '{unsubscribe_url}') === false) {
            $message .= sprintf(
                '<hr><p style="font-size: 12px; color: #666;">Non vuoi più ricevere queste notifiche? <a href="%s">Disiscriviti</a></p>',
                $placeholders['{unsubscribe_url}']
            );
        }
        
        // Send email
        $sent = wp_mail($email, $subject, $message, $headers);
        
        // Log email attempt
        if ($sent) {
            error_log("DSPN: Email sent successfully to {$email} for product {$product->get_name()}");
        } else {
            error_log("DSPN: Failed to send email to {$email} for product {$product->get_name()}");
        }
        
        return $sent;
    }
    
    /**
     * Get unsubscribe URL
     */
    private function get_unsubscribe_url($email, $product_id, $notification_id) {
        $token = $this->generate_unsubscribe_token($email, $product_id, $notification_id);
        
        return add_query_arg(array(
            'dspn_action' => 'unsubscribe',
            'email' => urlencode($email),
            'product_id' => $product_id,
            'token' => $token
        ), home_url());
    }
    
    /**
     * Generate secure unsubscribe token
     */
    private function generate_unsubscribe_token($email, $product_id, $notification_id) {
        $data = $email . '|' . $product_id . '|' . $notification_id;
        return wp_hash($data, 'nonce');
    }
    
    /**
     * Verify unsubscribe token
     */
    public function verify_unsubscribe_token($email, $product_id, $notification_id, $token) {
        $expected_token = $this->generate_unsubscribe_token($email, $product_id, $notification_id);
        return hash_equals($expected_token, $token);
    }
    
    /**
     * Handle unsubscribe requests
     */
    public function handle_unsubscribe_request() {
        if (!isset($_GET['dspn_action']) || $_GET['dspn_action'] !== 'unsubscribe') {
            return;
        }
        
        $email = urldecode($_GET['email'] ?? '');
        $product_id = intval($_GET['product_id'] ?? 0);
        $token = $_GET['token'] ?? '';
        
        if (empty($email) || empty($product_id) || empty($token)) {
            wp_die('Link di disiscrizione non valido.');
        }
        
        global $wpdb;
        
        // Find the notification
        $notification = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}dspn_notifications WHERE email = %s AND product_id = %d AND status = 'pending'",
            $email,
            $product_id
        ));
        
        if (!$notification) {
            wp_die('Iscrizione non trovata o già cancellata.');
        }
        
        // Verify token
        if (!$this->verify_unsubscribe_token($email, $product_id, $notification->id, $token)) {
            wp_die('Token di sicurezza non valido.');
        }
        
        // Update subscription status
        $result = $wpdb->update(
            $wpdb->prefix . 'dspn_notifications',
            array('status' => 'cancelled'),
            array('id' => $notification->id),
            array('%s'),
            array('%d')
        );
        
        if ($result) {
            wp_die('Disiscrizione completata con successo. Non riceverai più notifiche per questo prodotto.', 'Disiscrizione Completata', array('response' => 200));
        } else {
            wp_die('Errore durante la disiscrizione. Riprova più tardi.');
        }
    }

    /**
     * Get product URL (frontend or backend)
     */
    private function get_product_url($product) {
        $frontend_url = get_option('dspn_frontend_url');

        if (!empty($frontend_url)) {
            // Use frontend URL with configurable pattern
            $frontend_url = rtrim($frontend_url, '/');
            $pattern = get_option('dspn_product_url_pattern', '/product/{slug}');

            // Replace placeholders
            $product_path = str_replace(
                array('{slug}', '{id}'),
                array($product->get_slug(), $product->get_id()),
                $pattern
            );

            return $frontend_url . $product_path;
        }

        // Fallback to WordPress permalink
        return get_permalink($product->get_id());
    }

    /**
     * Get shop URL (frontend or backend)
     */
    private function get_shop_url() {
        $frontend_url = get_option('dspn_frontend_url');

        if (!empty($frontend_url)) {
            return rtrim($frontend_url, '/');
        }

        // Fallback to WordPress home URL
        return home_url();
    }

    /**
     * Normalize email formatting to ensure proper line breaks and spacing
     */
    private function normalize_email_formatting($message) {
        // Convert WordPress autop formatting
        $message = wpautop($message);

        // Ensure proper spacing around buttons/links
        $message = preg_replace('/(<p[^>]*>)(\s*<a[^>]*style="[^"]*display:\s*inline-block[^"]*"[^>]*>)/', '$1<br>$2', $message);
        $message = preg_replace('/(<\/a>\s*)(<\/p>)/', '$1<br>$2', $message);

        // Add margin to button containers
        $message = preg_replace('/(<p[^>]*>)([^<]*<a[^>]*style="[^"]*display:\s*inline-block[^"]*"[^>]*>[^<]*<\/a>[^<]*)(<\/p>)/',
            '<p style="margin: 20px 0; text-align: center;">$2</p>', $message);

        return $message;
    }

    /**
     * Get product image for email
     */
    private function get_product_image($product) {
        $image_id = $product->get_image_id();

        if (!$image_id) {
            return '';
        }

        $image_url = wp_get_attachment_image_url($image_id, 'medium');

        if (!$image_url) {
            return '';
        }

        return sprintf(
            '<img src="%s" alt="%s" style="max-width: 200px; height: auto; border-radius: 8px; display: block;">',
            esc_url($image_url),
            esc_attr($product->get_name())
        );
    }
}

// Handle unsubscribe requests early
add_action('init', function() {
    if (isset($_GET['dspn_action'])) {
        $handler = new DSPN_Email_Handler();
        $handler->handle_unsubscribe_request();
    }
});