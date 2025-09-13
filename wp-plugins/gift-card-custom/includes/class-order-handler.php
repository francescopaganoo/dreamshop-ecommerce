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
            error_log('[GIFT CARD] Ordine non trovato: ' . $order_id);
            return;
        }

        // Ottieni l'ID del prodotto gift card configurato
        $gift_card_product_id = get_option('gift_card_product_id');
        if (!$gift_card_product_id) {
            error_log('[GIFT CARD] ID prodotto gift card non configurato nelle impostazioni');
            return;
        }

        $customer_id = $order->get_customer_id();
        if (!$customer_id) {
            error_log('[GIFT CARD] Cliente non identificato per ordine: ' . $order_id);
            return;
        }

        // Verifica se questo ordine è già stato processato per le gift card
        $already_processed = get_post_meta($order_id, '_gift_card_processed', true);
        if ($already_processed) {
            error_log('[GIFT CARD] Ordine già processato: ' . $order_id);
            return;
        }

        // SICUREZZA: Verifica che l'ordine non sia un ordine di deposito/rata
        if ($this->is_deposit_or_installment_order($order)) {
            error_log('[GIFT CARD] BLOCCATO: Ordine #' . $order_id . ' identificato come deposito/rata - non processando gift card');
            return;
        }

        $gift_card_found = false;

        // Controlla ogni item nell'ordine
        foreach ($order->get_items() as $item_id => $item) {
            $product_id = $item->get_product_id();
            $variation_id = $item->get_variation_id();

            // Se è una variazione, controlla il prodotto padre
            $check_product_id = $variation_id ? $product_id : $product_id;

            // VALIDAZIONE MULTIPLA per identificare correttamente le gift card
            if ($this->is_genuine_gift_card_item($check_product_id, $item, $gift_card_product_id)) {
                // Questo è un acquisto di gift card
                $product = $item->get_product();
                if (!$product) {
                    error_log('[GIFT CARD] Prodotto non trovato per item: ' . $item_id);
                    continue;
                }

                // Ottieni il valore della gift card dal prezzo dell'item
                $gift_card_amount = floatval($item->get_subtotal());
                $quantity = intval($item->get_quantity());

                // Calcola il totale considerando la quantità
                $total_amount = $gift_card_amount * $quantity;

                if ($total_amount > 0) {
                    // Crea la descrizione
                    $description = sprintf(
                        'Acquisto Gift Card - Ordine #%d - %s (Qtà: %d)',
                        $order_id,
                        $product->get_name(),
                        $quantity
                    );

                    // Log dettagliato prima dell'accredito
                    error_log(sprintf(
                        '[GIFT CARD] ACCREDITO CONFERMATO: Ordine #%d, Cliente %d, Prodotto %s (ID: %d), Importo: €%.2f',
                        $order_id,
                        $customer_id,
                        $product->get_name(),
                        $check_product_id,
                        $total_amount
                    ));

                    // Accredita il saldo
                    $result = GiftCard_Database::update_user_balance(
                        $customer_id,
                        $total_amount,
                        'credit',
                        $description,
                        $order_id
                    );

                    if ($result) {
                        // Aggiungi nota all'ordine
                        $order->add_order_note(sprintf(
                            'Gift Card da €%.2f accreditata al cliente (ID: %d) - Variazione: %s',
                            $total_amount,
                            $customer_id,
                            $variation_id ? wc_get_formatted_variation($product, true) : 'Prodotto semplice'
                        ));

                        // Log per debug
                        error_log(sprintf(
                            '[GIFT CARD] SUCCESSO: Accreditato €%.2f all\'utente %d per l\'ordine %d (Prodotto: %d, Variazione: %d)',
                            $total_amount,
                            $customer_id,
                            $order_id,
                            $product_id,
                            $variation_id
                        ));

                        $gift_card_found = true;

                        // Invia email di notifica al cliente (opzionale)
                        $this->send_gift_card_notification($order, $customer_id, $total_amount);
                    }
                } else {
                    error_log('[GIFT CARD] Importo non valido per ordine: ' . $order_id . ', importo: ' . $total_amount);
                }
            } else {
                // Log per tracciare cosa viene scartato
                error_log(sprintf(
                    '[GIFT CARD] SCARTATO: Ordine #%d, Item #%d non è una gift card valida (Prodotto ID: %d vs Gift Card ID: %d)',
                    $order_id,
                    $item_id,
                    $check_product_id,
                    $gift_card_product_id
                ));
            }
        }
        
        // Marca l'ordine come processato se abbiamo trovato gift card
        if ($gift_card_found) {
            update_post_meta($order_id, '_gift_card_processed', true);
        }
    }
    
    /**
     * Invia notifica email al cliente per l'accredito gift card (opzionale)
     */
    private function send_gift_card_notification($order, $customer_id, $amount) {
        $user = get_user_by('id', $customer_id);
        if (!$user) {
            return;
        }
        
        $current_balance = GiftCard_Database::get_user_balance($customer_id);
        
        $subject = 'Gift Card Accreditata - Ordine #' . $order->get_order_number();
        
        $message = sprintf(
            "Ciao %s,\n\n" .
            "La tua Gift Card è stata accreditata con successo!\n\n" .
            "Dettagli:\n" .
            "- Importo accreditato: €%.2f\n" .
            "- Ordine: #%s\n" .
            "- Saldo attuale: €%.2f\n\n" .
            "Puoi utilizzare il tuo saldo per i prossimi acquisti.\n\n" .
            "Grazie per il tuo acquisto!",
            $user->display_name,
            $amount,
            $order->get_order_number(),
            $current_balance
        );
        
        // Invia l'email (commentato per default, decommentare se necessario)
        // wp_mail($user->user_email, $subject, $message);
        
        // Log dell'invio
        error_log('[GIFT CARD] Notifica inviata a ' . $user->user_email . ' per €' . $amount);
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
                error_log('[GIFT CARD] Indicatore deposito trovato: ' . $meta_key);
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
                    error_log('[GIFT CARD] Indicatore item deposito trovato: ' . $item_meta_key);
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
                    error_log('[GIFT CARD] Keyword deposito trovata nelle note: ' . $keyword);
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
            error_log('[GIFT CARD] Prodotto non esistente: ' . $product_id);
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
            error_log('[GIFT CARD] Prodotto non contiene keyword gift card nel nome: ' . $product->get_name());
            return false;
        }

        // Quarta verifica: l'item non deve avere metadati di deposito
        $item_deposit_indicators = ['is_deposit', 'deposit_amount', 'full_amount'];
        foreach ($item_deposit_indicators as $meta_key) {
            if ($item->get_meta($meta_key)) {
                error_log('[GIFT CARD] Item ha metadati di deposito, non è una gift card: ' . $meta_key);
                return false;
            }
        }

        // Quinta verifica: il prodotto deve essere abilitato e pubblicato
        if ($product->get_status() !== 'publish') {
            error_log('[GIFT CARD] Prodotto non pubblicato: ' . $product_id);
            return false;
        }

        // Se tutte le verifiche sono passate, è una gift card genuina
        error_log('[GIFT CARD] VALIDAZIONE SUPERATA: Prodotto ' . $product_id . ' è una gift card valida');
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