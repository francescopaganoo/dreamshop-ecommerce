<?php
/**
 * Cache Manager Class
 * Handles caching for better performance
 */

if (!defined('ABSPATH')) {
    exit;
}

class DreamShop_Filters_Cache_Manager {

    private $cache_prefix = 'dreamshop_filters_';
    private $cache_group = 'dreamshop_filters';

    /**
     * Get cached data
     */
    public function get($key) {
        $cache_key = $this->cache_prefix . $key;

        // Try object cache first (Redis, Memcached if available)
        $cached_data = wp_cache_get($cache_key, $this->cache_group);

        if ($cached_data !== false) {
            return $cached_data;
        }

        // Fallback to transient cache
        return get_transient($cache_key);
    }

    /**
     * Set cached data
     */
    public function set($key, $data, $expiration = 300) {
        $cache_key = $this->cache_prefix . $key;

        // Set in object cache
        wp_cache_set($cache_key, $data, $this->cache_group, $expiration);

        // Also set as transient for persistence
        set_transient($cache_key, $data, $expiration);

        return true;
    }

    /**
     * Delete cached data
     */
    public function delete($key) {
        $cache_key = $this->cache_prefix . $key;

        // Delete from object cache
        wp_cache_delete($cache_key, $this->cache_group);

        // Delete transient
        delete_transient($cache_key);

        return true;
    }

    /**
     * Clear all plugin caches
     */
    public function clear_all() {
        global $wpdb;

        // Clear all transients with our prefix
        $wpdb->query($wpdb->prepare("
            DELETE FROM {$wpdb->options}
            WHERE option_name LIKE %s
        ", '_transient_' . $this->cache_prefix . '%'));

        $wpdb->query($wpdb->prepare("
            DELETE FROM {$wpdb->options}
            WHERE option_name LIKE %s
        ", '_transient_timeout_' . $this->cache_prefix . '%'));

        // Flush object cache group
        wp_cache_flush_group($this->cache_group);

        return true;
    }

    /**
     * Get cache statistics
     */
    public function get_stats() {
        global $wpdb;

        $transient_count = $wpdb->get_var($wpdb->prepare("
            SELECT COUNT(*)
            FROM {$wpdb->options}
            WHERE option_name LIKE %s
        ", '_transient_' . $this->cache_prefix . '%'));

        return [
            'transient_count' => (int) $transient_count,
            'cache_prefix' => $this->cache_prefix,
            'cache_group' => $this->cache_group
        ];
    }
}