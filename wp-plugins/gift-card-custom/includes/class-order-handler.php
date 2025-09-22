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

                        // Invia email con il codice gift card
                        $this->send_gift_card_email($order, $gift_card_code, $total_amount, $recipient_email, $recipient_name, $message);
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

        $subject = 'Hai ricevuto una Gift Card da ' . get_bloginfo('name');

        // Costruisci il messaggio email
        $email_message = sprintf(
            "Ciao %s,\n\n" .
            "Hai ricevuto una Gift Card da %s!\n\n" .
            "Dettagli della Gift Card:\n" .
            "- Codice: %s\n" .
            "- Valore: €%.2f\n" .
            "- Da: %s\n\n",
            $recipient_name ?: 'Cliente',
            $purchaser_name,
            $gift_card_code,
            $amount,
            $purchaser_name
        );

        // Aggiungi il messaggio personalizzato se presente
        if (!empty($message)) {
            $email_message .= "Messaggio personalizzato:\n\"" . $message . "\"\n\n";
        }

        $email_message .= sprintf(
            "Come utilizzare la Gift Card:\n" .
            "1. Vai sul sito %s\n" .
            "2. Accedi al tuo account o registrati\n" .
            "3. Vai nella sezione Gift Card del tuo account\n" .
            "4. Inserisci il codice: %s\n" .
            "5. Il saldo verrà aggiunto al tuo account e potrai utilizzarlo per i tuoi acquisti\n\n" .
            "La Gift Card non ha scadenza.\n\n" .
            "Buono shopping!\n" .
            "Team %s",
            get_site_url(),
            $gift_card_code,
            get_bloginfo('name')
        );

        // Headers per email HTML (opzionale)
        $headers = array('Content-Type: text/plain; charset=UTF-8');

        // Invia l'email
        $sent = wp_mail($recipient_email, $subject, $email_message, $headers);

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