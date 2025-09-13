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
        
        $gift_card_found = false;
        
        // Controlla ogni item nell'ordine
        foreach ($order->get_items() as $item_id => $item) {
            $product_id = $item->get_product_id();
            $variation_id = $item->get_variation_id();
            
            // Se è una variazione, controlla il prodotto padre
            $check_product_id = $variation_id ? $product_id : $product_id;
            
            if ($check_product_id == $gift_card_product_id) {
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
                    // Crea la descrizione
                    $description = sprintf(
                        'Acquisto Gift Card - Ordine #%d - %s (Qtà: %d)',
                        $order_id,
                        $product->get_name(),
                        $quantity
                    );
                    
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
                            '[GIFT CARD] Accreditato €%.2f all\'utente %d per l\'ordine %d (Prodotto: %d, Variazione: %d)',
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
                }
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
     * Gestisce il rimborso delle gift card (opzionale)
     */
    public function handle_gift_card_refund($order_id, $refund_id) {
        // Implementare logica di rimborso se necessario
        // Questa funzione può essere collegata al hook 'woocommerce_order_refunded'
    }
}