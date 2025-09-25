<?php

if (!defined('ABSPATH')) {
    exit;
}

class GiftCard_Order_Handler {
    
    public function __construct() {
        add_action('woocommerce_order_status_completed', array($this, 'process_gift_card_purchase'));
        add_action('woocommerce_order_status_processing', array($this, 'process_gift_card_purchase'));
    }
    
    /**
     * Processa l'acquisto di gift card quando l'ordine viene completato
     */
    public function process_gift_card_purchase($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        // Ottieni l'ID del prodotto gift card configurato
        $gift_card_product_id = get_option('gift_card_product_id');

        if (!$gift_card_product_id) {
            return;
        }

        $customer_id = $order->get_customer_id();

        if (!$customer_id) {
            return;
        }

        // Verifica se questo ordine è già stato processato per le gift card
        $already_processed = get_post_meta($order_id, '_gift_card_processed', true);
        if ($already_processed) {
            return;
        }

        // SICUREZZA: Verifica che l'ordine non sia un ordine di deposito/rata
        if ($this->is_deposit_or_installment_order($order)) {
            return;
        }

        $gift_card_found = false;
        $order_items = $order->get_items();

        // Controlla ogni item nell'ordine
        foreach ($order_items as $item_id => $item) {
            $product_id = $item->get_product_id();
            $variation_id = $item->get_variation_id();
            $quantity = $item->get_quantity();

            // Se è una variazione, controlla il prodotto padre
            $check_product_id = $variation_id ? $product_id : $product_id;

            // VALIDAZIONE MULTIPLA per identificare correttamente le gift card
            if ($this->is_genuine_gift_card_item($check_product_id, $item, $gift_card_product_id)) {

                // Questo è un acquisto di gift card
                $product = $item->get_product();
                if (!$product) {
                    continue;
                }

                // Ottieni il valore della gift card dal prezzo dell'item
                $gift_card_amount = floatval($item->get_subtotal());
                $quantity = intval($item->get_quantity());

                // Calcola il totale considerando la quantità
                $total_amount = $gift_card_amount * $quantity;

                if ($total_amount > 0) {
                    // Ottieni i dati del destinatario dall'item dell'ordine
                    $recipient_email = $item->get_meta('_gift_card_recipient_email');
                    $recipient_name = $item->get_meta('_gift_card_recipient_name');
                    $message = $item->get_meta('_gift_card_message');

                    // Se non c'è email del destinatario, usa quella del cliente
                    if (empty($recipient_email)) {
                        $customer = new WC_Customer($customer_id);
                        $recipient_email = $customer->get_email();
                        $recipient_name = $customer->get_first_name() . ' ' . $customer->get_last_name();
                    }

                    // Crea il codice gift card
                    $gift_card_code = GiftCard_Database::create_gift_card(
                        $customer_id,
                        $total_amount,
                        $recipient_email,
                        $recipient_name,
                        $message,
                        $order_id
                    );

                    if ($gift_card_code) {
                        // Aggiungi nota all'ordine
                        $order->add_order_note(sprintf(
                            'Gift Card da €%.2f creata con codice %s per %s - Variazione: %s',
                            $total_amount,
                            $gift_card_code,
                            $recipient_email,
                            $variation_id ? wc_get_formatted_variation($product, true) : 'Prodotto semplice'
                        ));

                        $gift_card_found = true;

                        // Prepara i dati per il log
                        $customer = new WC_Customer($customer_id);
                        $purchaser_data = array(
                            'id' => $customer_id,
                            'name' => $customer->get_first_name() . ' ' . $customer->get_last_name(),
                            'email' => $customer->get_email()
                        );

                        $recipient_data = array(
                            'email' => $recipient_email,
                            'name' => $recipient_name,
                            'message' => $message
                        );

                        // Invia email e registra il risultato
                        $email_sent = $this->send_gift_card_email($order, $gift_card_code, $total_amount, $recipient_email, $recipient_name, $message);

                        // Crea il log dell'acquisto
                        $log_id = GiftCard_Database::create_gift_card_log(
                            $order_id,
                            $gift_card_code,
                            $purchaser_data,
                            $recipient_data,
                            $total_amount,
                            $email_sent,
                            $email_sent ? null : 'Errore generico durante l\'invio'
                        );

                        if ($log_id) {
                            $order->add_order_note(sprintf(
                                'Log Gift Card creato con ID: %d - Email %s',
                                $log_id,
                                $email_sent ? 'inviata' : 'NON inviata'
                            ));
                        }
                    }
                }
            }
        }
        
        // Marca l'ordine come processato se abbiamo trovato gift card
        if ($gift_card_found) {
            update_post_meta($order_id, '_gift_card_processed', true);
        }
    }
    
    /**
     * Invia email con il codice gift card al destinatario
     */
    private function send_gift_card_email($order, $gift_card_code, $amount, $recipient_email, $recipient_name, $message) {
        $purchaser = new WC_Customer($order->get_customer_id());
        $purchaser_name = $purchaser->get_first_name() . ' ' . $purchaser->get_last_name();

        $subject = '🎁 Hai ricevuto una Gift Card da ' . get_bloginfo('name');

        // Ottieni la gift card appena creata per includere la data di scadenza
        $gift_card = GiftCard_Database::get_gift_card_by_code($gift_card_code);
        $expires_at = $gift_card ? $gift_card->expires_at : null;

        // Template HTML moderno per la Gift Card
        $email_message = $this->get_gift_card_email_template(
            $recipient_name ?: 'Cliente',
            $purchaser_name,
            $gift_card_code,
            $amount,
            $message,
            get_site_url(),
            get_bloginfo('name'),
            $expires_at
        );

        // Headers per email HTML
        $headers = array('Content-Type: text/html; charset=UTF-8');

        // Personalizza mittente email per questa sessione
        add_filter('wp_mail_from', array($this, 'custom_gift_card_mail_from'));
        add_filter('wp_mail_from_name', array($this, 'custom_gift_card_mail_from_name'));

        // Invia l'email
        $sent = wp_mail($recipient_email, $subject, $email_message, $headers);

        // Rimuovi i filtri dopo l'invio
        remove_filter('wp_mail_from', array($this, 'custom_gift_card_mail_from'));
        remove_filter('wp_mail_from_name', array($this, 'custom_gift_card_mail_from_name'));

        // Log dell'invio
        if ($sent) {
            // Aggiungi nota all'ordine
            $order->add_order_note(sprintf(
                'Email Gift Card inviata a %s con codice %s',
                $recipient_email,
                $gift_card_code
            ));
        } else {
            $order->add_order_note(sprintf(
                'ERRORE: Email Gift Card NON inviata a %s (codice %s)',
                $recipient_email,
                $gift_card_code
            ));
        }

        return $sent;
    }

    /**
     * Template HTML moderno per la Gift Card
     */
    private function get_gift_card_email_template($recipient_name, $purchaser_name, $gift_card_code, $amount, $message, $site_url, $shop_name, $expires_at = null) {
        $formatted_amount = number_format($amount, 2, ',', '.') . ' €';

        $html = '
        <div style="max-width: 600px; margin: 0 auto; font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #a2180e 0%, #8b1508 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🎁 GIFT CARD RICEVUTA!</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Un regalo speciale ti aspetta</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px; background-color: #ffffff;">
                <h2 style="color: #333333; font-size: 24px; margin: 0 0 20px 0; text-align: center;">
                    Ciao ' . esc_html($recipient_name) . '! 👋
                </h2>

                <div style="background-color: #f8f9fa; padding: 25px; border-radius: 10px; border-left: 4px solid #a2180e; margin: 20px 0;">
                    <p style="margin: 0 0 15px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                        <strong style="color: #a2180e;">' . esc_html($purchaser_name) . '</strong> ti ha inviato una Gift Card da utilizzare su ' . esc_html($shop_name) . '!
                    </p>
                </div>

                <!-- Gift Card Section -->
                <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 2px solid #a2180e; border-radius: 15px; padding: 30px; margin: 30px 0; text-align: center; position: relative;">
                    <div style="background: linear-gradient(135deg, #a2180e 0%, #8b1508 100%); color: white; padding: 8px 20px; border-radius: 20px; display: inline-block; margin-bottom: 20px; font-size: 14px; font-weight: bold;">
                        🎁 GIFT CARD
                    </div>

                    <h3 style="color: #a2180e; font-size: 24px; margin: 15px 0 10px 0; font-weight: bold;">
                        VALORE: ' . $formatted_amount . '
                    </h3>

                    <div style="background-color: #ffffff; border: 2px dashed #a2180e; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0 0 5px 0; font-size: 14px; color: #666666; font-weight: bold;">CODICE GIFT CARD:</p>
                        <p style="margin: 0; font-size: 20px; font-weight: bold; color: #a2180e; letter-spacing: 2px; font-family: monospace;">
                            ' . esc_html($gift_card_code) . '
                        </p>
                    </div>
                </div>';

        // Aggiungi messaggio personalizzato se presente
        if (!empty($message)) {
            $html .= '
                <div style="background-color: #e8f5e8; border: 1px solid #28a745; padding: 20px; border-radius: 8px; margin: 25px 0;">
                    <h4 style="margin: 0 0 10px 0; color: #155724; font-size: 16px;">💌 Messaggio da ' . esc_html($purchaser_name) . ':</h4>
                    <p style="margin: 0; color: #155724; font-style: italic; font-size: 15px; line-height: 1.5;">
                        "' . esc_html($message) . '"
                    </p>
                </div>';
        }

        $html .= '
                <!-- Instructions -->
                <div style="background-color: #f8f9fa; border-radius: 10px; padding: 25px; margin: 30px 0;">
                    <h4 style="margin: 0 0 15px 0; color: #a2180e; font-size: 18px; text-align: center;">
                        🛍️ Come utilizzare la tua Gift Card
                    </h4>
                    <ol style="margin: 0; padding-left: 20px; color: #333333; line-height: 1.8;">
                        <li>Vai su <a href="' . esc_url($site_url) . '" style="color: #a2180e; text-decoration: none; font-weight: bold;">' . esc_html($shop_name) . '</a></li>
                        <li>Accedi al tuo account o registrati se non hai ancora un account</li>
                        <li>Vai nella sezione <strong>Gift Card</strong> del tuo account</li>
                        <li>Inserisci il codice: <strong style="color: #a2180e;">' . esc_html($gift_card_code) . '</strong></li>
                        <li>Il saldo verrà aggiunto al tuo account per i tuoi acquisti</li>
                    </ol>
                </div>

                <!-- Expiration Notice -->
                <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 1px solid #ffc107; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
                    <p style="margin: 0; color: #856404; font-size: 16px; font-weight: bold;">
                        ⏰ Scadenza Gift Card: ' . ($expires_at ? date('d/m/Y', strtotime($expires_at)) : 'Nessuna scadenza') . '
                    </p>
                    <p style="margin: 5px 0 0 0; color: #856404; font-size: 14px;">
                        Utilizza la tua Gift Card entro questa data!
                    </p>
                </div>

                <!-- Footer Message -->
                <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e9ecef; margin-top: 30px;">
                    <p style="margin: 0 0 10px 0; color: #666666; font-size: 18px; font-weight: bold;">
                        Buono shopping! 🛒
                    </p>
                    <p style="margin: 0; color: #a2180e; font-size: 18px; font-weight: bold;">
                        Il team di ' . esc_html($shop_name) . '
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-radius: 0 0 10px 10px; border-top: 1px solid #e9ecef;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                    Visita il nostro store: <a href="' . esc_url($site_url) . '" style="color: #a2180e; text-decoration: none; font-weight: bold;">' . esc_html($shop_name) . '</a>
                </p>
                <p style="margin: 0; font-size: 12px; color: #999999;">
                    Conserva questa email per riferimenti futuri
                </p>
            </div>
        </div>
        ';

        return $html;
    }

    /**
     * Personalizza l'indirizzo email del mittente per le Gift Card
     */
    public function custom_gift_card_mail_from($original_email_address) {
        // Usa l'email dell'admin del sito o un'email personalizzata
        $admin_email = get_option('admin_email');
        return $admin_email ? $admin_email : $original_email_address;
    }

    /**
     * Personalizza il nome del mittente per le Gift Card
     */
    public function custom_gift_card_mail_from_name($original_email_from) {
        // Usa il nome del sito invece di "WordPress"
        $site_name = get_bloginfo('name');
        return $site_name ? $site_name : $original_email_from;
    }

    /**
     * Verifica se un ordine è un deposito o una rata per prevenire addebiti impropri
     *
     * @param WC_Order $order Oggetto ordine
     * @return bool True se è un deposito/rata, False altrimenti
     */
    private function is_deposit_or_installment_order($order) {
        // Controlla se l'ordine ha stato 'partial-payment' (depositi)
        if ($order->get_status() === 'partial-payment') {
            return true;
        }

        // Controlla i metadati dell'ordine per indicatori di deposito
        $deposit_indicators = [
            '_wc_deposits_order_has_deposit',
            '_wc_deposits_deposit_paid',
            '_wc_deposits_second_payment',
            '_deposit_payment_schedule',
            'is_vat_exempt' // Spesso presente negli ordini di deposito
        ];

        foreach ($deposit_indicators as $meta_key) {
            if ($order->get_meta($meta_key)) {
                return true;
            }
        }

        // Controlla se ci sono items con metadati di deposito
        foreach ($order->get_items() as $item) {
            $item_deposit_indicators = [
                'is_deposit',
                'deposit_amount',
                'full_amount',
                '_deposit_deposit_amount_ex_tax'
            ];

            foreach ($item_deposit_indicators as $item_meta_key) {
                if ($item->get_meta($item_meta_key)) {
                    return true;
                }
            }
        }

        // Controlla note dell'ordine per keyword di deposito/rate
        $order_notes = wc_get_order_notes(['order_id' => $order->get_id(), 'limit' => 10]);
        $deposit_keywords = ['deposito', 'acconto', 'rata', 'installment', 'deposit', 'partial'];

        foreach ($order_notes as $note) {
            $note_content = strtolower($note->content);
            foreach ($deposit_keywords as $keyword) {
                if (strpos($note_content, $keyword) !== false) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Validazione rigorosa per identificare genuine gift card
     *
     * @param int $product_id ID del prodotto da verificare
     * @param WC_Order_Item $item Item dell'ordine
     * @param int $gift_card_product_id ID del prodotto gift card configurato
     * @return bool True se è una vera gift card, False altrimenti
     */
    private function is_genuine_gift_card_item($product_id, $item, $gift_card_product_id) {
        // Prima verifica: ID prodotto deve corrispondere
        if ($product_id != $gift_card_product_id) {
            return false;
        }

        // Seconda verifica: il prodotto deve esistere e essere del tipo corretto
        $product = wc_get_product($product_id);
        if (!$product) {
            return false;
        }

        // Terza verifica: controlla se il prodotto ha le caratteristiche di una gift card
        $product_name = strtolower($product->get_name());
        $gift_card_keywords = ['gift card', 'buono regalo', 'carta regalo'];
        $has_gift_card_keyword = false;

        foreach ($gift_card_keywords as $keyword) {
            if (strpos($product_name, $keyword) !== false) {
                $has_gift_card_keyword = true;
                break;
            }
        }

        if (!$has_gift_card_keyword) {
            return false;
        }

        // Quarta verifica: l'item non deve avere metadati di deposito
        $item_deposit_indicators = ['is_deposit', 'deposit_amount', 'full_amount'];
        foreach ($item_deposit_indicators as $meta_key) {
            if ($item->get_meta($meta_key)) {
                return false;
            }
        }

        // Quinta verifica: il prodotto deve essere abilitato e pubblicato
        if ($product->get_status() !== 'publish') {
            return false;
        }

        // Se tutte le verifiche sono passate, è una gift card genuina
        return true;
    }

    /**
     * Gestisce il rimborso delle gift card (opzionale)
     */
    public function handle_gift_card_refund($order_id, $refund_id) {
        // Implementare logica di rimborso se necessario
        // Questa funzione può essere collegata al hook 'woocommerce_order_refunded'
    }
}