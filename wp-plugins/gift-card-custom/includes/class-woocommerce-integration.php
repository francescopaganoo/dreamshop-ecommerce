<?php

if (!defined('ABSPATH')) {
    exit;
}

class GiftCard_WooCommerce_Integration {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
    }
    
    public function init() {
        if (!class_exists('WooCommerce')) {
            return;
        }
        
        add_action('woocommerce_order_status_completed', array($this, 'process_gift_card_purchase'));
        add_action('woocommerce_coupon_loaded', array($this, 'load_gift_card_coupon'));
        add_action('woocommerce_coupon_is_valid', array($this, 'validate_gift_card_coupon'), 10, 3);
        add_action('woocommerce_order_status_completed', array($this, 'mark_gift_card_coupon_used'));
        add_filter('woocommerce_coupon_discount_types', array($this, 'add_gift_card_discount_type'));
        add_filter('woocommerce_coupon_get_discount_amount', array($this, 'calculate_gift_card_discount'), 10, 5);
    }
    
    public function process_gift_card_purchase($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) return;
        
        foreach ($order->get_items() as $item_id => $item) {
            $product = $item->get_product();
            if (!$product) continue;
            
            $is_gift_card = $product->get_meta('_is_gift_card', true);
            if ($is_gift_card !== 'yes') continue;
            
            $gift_card_amount = floatval($item->get_subtotal());
            $customer_id = $order->get_customer_id();
            
            if ($customer_id && $gift_card_amount > 0) {
                $description = sprintf(
                    'Acquisto Gift Card - Ordine #%d - %s',
                    $order_id,
                    $product->get_name()
                );
                
                GiftCard_Database::update_user_balance(
                    $customer_id,
                    $gift_card_amount,
                    'credit',
                    $description,
                    $order_id
                );
                
                $order->add_order_note(sprintf(
                    'Gift Card da €%.2f accreditata al cliente (ID: %d)',
                    $gift_card_amount,
                    $customer_id
                ));
            }
        }
    }
    
    public function load_gift_card_coupon($coupon) {
        if (strpos($coupon->get_code(), 'GC') !== 0) {
            return;
        }
        
        $coupon_info = GiftCard_Database::get_coupon_info($coupon->get_code());
        
        if ($coupon_info && $coupon_info->status === 'active') {
            $coupon->set_props(array(
                'discount_type' => 'gift_card',
                'amount' => $coupon_info->amount,
                'individual_use' => false,
                'usage_limit' => 1,
                'usage_count' => $coupon_info->status === 'used' ? 1 : 0,
                'expiry_date' => $coupon_info->expires_at ? strtotime($coupon_info->expires_at) : null
            ));
        }
    }
    
    public function validate_gift_card_coupon($is_valid, $coupon, $discount_object) {
        if (strpos($coupon->get_code(), 'GC') !== 0) {
            return $is_valid;
        }
        
        $coupon_info = GiftCard_Database::get_coupon_info($coupon->get_code());
        
        if (!$coupon_info) {
            throw new Exception('Codice gift card non valido');
        }
        
        if ($coupon_info->status !== 'active') {
            throw new Exception('Gift card già utilizzata o scaduta');
        }
        
        if ($coupon_info->expires_at && strtotime($coupon_info->expires_at) < current_time('timestamp')) {
            throw new Exception('Gift card scaduta');
        }
        
        return true;
    }
    
    public function mark_gift_card_coupon_used($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) return;
        
        foreach ($order->get_coupon_codes() as $coupon_code) {
            if (strpos($coupon_code, 'GC') === 0) {
                GiftCard_Database::mark_coupon_used($coupon_code, $order_id);
                
                $order->add_order_note(sprintf(
                    'Gift Card %s utilizzata',
                    $coupon_code
                ));
            }
        }
    }
    
    public function add_gift_card_discount_type($discount_types) {
        $discount_types['gift_card'] = __('Gift Card', 'gift-card-custom');
        return $discount_types;
    }
    
    public function calculate_gift_card_discount($discount, $discounting_amount, $cart_item, $single, $coupon) {
        if ($coupon->get_discount_type() !== 'gift_card') {
            return $discount;
        }
        
        $coupon_amount = floatval($coupon->get_amount());
        
        if ($single) {
            return min($coupon_amount, $discounting_amount);
        }
        
        static $gift_card_used = array();
        $coupon_code = $coupon->get_code();
        
        if (!isset($gift_card_used[$coupon_code])) {
            $gift_card_used[$coupon_code] = 0;
        }
        
        $remaining_amount = $coupon_amount - $gift_card_used[$coupon_code];
        $discount_for_item = min($remaining_amount, $discounting_amount);
        
        $gift_card_used[$coupon_code] += $discount_for_item;
        
        return $discount_for_item;
    }
}