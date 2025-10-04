<?php
/**
 * Product Query Class
 * Handles optimized database queries for product filtering
 */

if (!defined('ABSPATH')) {
    exit;
}

class DreamShop_Filters_Product_Query {

    private $wpdb;
    private $cache_manager;

    public function __construct() {
        global $wpdb;
        $this->wpdb = $wpdb;
        $this->cache_manager = new DreamShop_Filters_Cache_Manager();
    }

    /**
     * Main method to get filtered products
     */
    public function get_filtered_products($filters = [], $page = 1, $per_page = 12, $orderby = 'date', $order = 'DESC') {
        // Generate cache key based on filters
        $cache_key = $this->generate_cache_key($filters, $page, $per_page, $orderby, $order);

        // Try to get from cache first
        $cached_result = $this->cache_manager->get($cache_key);
        if ($cached_result !== false) {
            return $cached_result;
        }

        // Get products with backfill logic to ensure we get the requested number
        $products = $this->get_products_with_backfill($filters, $page, $per_page, $orderby, $order);

        // Get total count for pagination
        $total_query = $this->build_count_query($filters);
        $total_count = (int) $this->wpdb->get_var($total_query);

        $response = [
            'products' => $products,
            'total' => $total_count,
            'page' => $page,
            'per_page' => $per_page,
            'total_pages' => ceil($total_count / $per_page)
        ];

        // Cache the result
        $this->cache_manager->set($cache_key, $response, 300); // 5 minutes cache

        return $response;
    }

    /**
     * Get products - simplified without backfill that breaks pagination
     */
    private function get_products_with_backfill($filters, $page, $per_page, $orderby, $order) {
        // Simply execute the query with exact pagination parameters
        $query = $this->build_products_query($filters, $page, $per_page, $per_page, $orderby, $order);
        $results = $this->wpdb->get_results($query, ARRAY_A);

        error_log("DreamShop Filter: SQL query returned " . count($results) . " products for page $page");

        // Format results
        $products = $this->format_products($results);

        error_log("DreamShop Filter: Returning " . count($products) . " formatted products");

        return $products;
    }

    /**
     * Build the main products query
     *
     * @param array $filters Filter criteria
     * @param int $page Current page number
     * @param int $per_page Items per page (used for offset calculation)
     * @param int $fetch_count Actual number of items to fetch (may be higher for backfill)
     * @param string $orderby Order by field
     * @param string $order Order direction
     */
    private function build_products_query($filters, $page, $per_page, $fetch_count, $orderby, $order) {
        // Calculate offset using per_page (the expected page size), not fetch_count
        $offset = ($page - 1) * $per_page;

        // Base query - use GROUP BY instead of DISTINCT to handle multiple joins better
        $query = "
            SELECT p.ID, p.post_title, p.post_name, p.post_excerpt, pm_price.meta_value as price
            FROM {$this->wpdb->posts} p
            INNER JOIN {$this->wpdb->postmeta} pm_price ON p.ID = pm_price.post_id AND pm_price.meta_key = '_price'
        ";

        // Join conditions based on filters
        $joins = [];
        $where_conditions = [
            "p.post_type = 'product'",
            "p.post_status = 'publish'",
            "p.post_password = ''"  // Exclude password protected products (often used for private products)
        ];

        // Add join to check product visibility and catalog visibility
        $joins[] = "LEFT JOIN {$this->wpdb->postmeta} pm_visibility ON p.ID = pm_visibility.post_id AND pm_visibility.meta_key = '_visibility'";
        $joins[] = "LEFT JOIN {$this->wpdb->postmeta} pm_catalog_visibility ON p.ID = pm_catalog_visibility.post_id AND pm_catalog_visibility.meta_key = '_catalog_visibility'";
        $where_conditions[] = "(pm_visibility.meta_value IS NULL OR pm_visibility.meta_value = 'visible')";
        $where_conditions[] = "(pm_catalog_visibility.meta_value IS NULL OR pm_catalog_visibility.meta_value = 'visible')";

        // Category filter
        if (!empty($filters['category_slug'])) {
            $joins[] = "INNER JOIN {$this->wpdb->term_relationships} tr_cat ON p.ID = tr_cat.object_id";
            $joins[] = "INNER JOIN {$this->wpdb->term_taxonomy} tt_cat ON tr_cat.term_taxonomy_id = tt_cat.term_taxonomy_id AND tt_cat.taxonomy = 'product_cat'";
            $joins[] = "INNER JOIN {$this->wpdb->terms} t_cat ON tt_cat.term_id = t_cat.term_id";
            $where_conditions[] = $this->wpdb->prepare("t_cat.slug = %s", $filters['category_slug']);
        }

        // Brand filter
        if (!empty($filters['brand_slugs']) && is_array($filters['brand_slugs'])) {
            $brand_placeholders = implode(',', array_fill(0, count($filters['brand_slugs']), '%s'));
            $joins[] = "INNER JOIN {$this->wpdb->term_relationships} tr_brand ON p.ID = tr_brand.object_id";
            $joins[] = "INNER JOIN {$this->wpdb->term_taxonomy} tt_brand ON tr_brand.term_taxonomy_id = tt_brand.term_taxonomy_id AND tt_brand.taxonomy = 'product_brand'";
            $joins[] = "INNER JOIN {$this->wpdb->terms} t_brand ON tt_brand.term_id = t_brand.term_id";
            $where_conditions[] = "t_brand.slug IN ($brand_placeholders)";
        }

        // Price filter - add conditions but defer parameter preparation
        if (!empty($filters['min_price']) && $filters['min_price'] > 0) {
            $where_conditions[] = "CAST(pm_price.meta_value AS DECIMAL(10,2)) >= " . floatval($filters['min_price']);
        }
        if (!empty($filters['max_price']) && $filters['max_price'] > 0) {
            $where_conditions[] = "CAST(pm_price.meta_value AS DECIMAL(10,2)) <= " . floatval($filters['max_price']);
        }

        // Exclude sold out products filter
        if (!empty($filters['exclude_sold_out']) && $filters['exclude_sold_out']) {
            $joins[] = "LEFT JOIN {$this->wpdb->postmeta} pm_stock ON p.ID = pm_stock.post_id AND pm_stock.meta_key = '_stock_status'";
            $where_conditions[] = "(pm_stock.meta_value IS NULL OR pm_stock.meta_value != 'outofstock')";
        }

        // Filter only products on sale
        if (!empty($filters['on_sale']) && $filters['on_sale']) {
            $joins[] = "INNER JOIN {$this->wpdb->postmeta} pm_sale_price ON p.ID = pm_sale_price.post_id AND pm_sale_price.meta_key = '_sale_price'";
            $joins[] = "INNER JOIN {$this->wpdb->postmeta} pm_regular_price ON p.ID = pm_regular_price.post_id AND pm_regular_price.meta_key = '_regular_price'";
            $where_conditions[] = "pm_sale_price.meta_value != '' AND pm_sale_price.meta_value IS NOT NULL AND CAST(pm_sale_price.meta_value AS DECIMAL(10,2)) > 0 AND CAST(pm_sale_price.meta_value AS DECIMAL(10,2)) < CAST(pm_regular_price.meta_value AS DECIMAL(10,2))";
        }

        // Attribute filters (availability and shipping)
        $attribute_conditions = $this->build_attribute_conditions($filters);
        if (!empty($attribute_conditions)) {
            $joins = array_merge($joins, $attribute_conditions['joins']);
            $where_conditions = array_merge($where_conditions, $attribute_conditions['conditions']);
        }

        // Add joins to query
        if (!empty($joins)) {
            $query .= " " . implode(" ", array_unique($joins));
        }

        // Add WHERE conditions
        $query .= " WHERE " . implode(" AND ", $where_conditions);

        // Add GROUP BY to eliminate duplicates from JOINs
        $query .= " GROUP BY p.ID";

        // Add ORDER BY
        $query .= $this->build_order_by($orderby, $order);

        // Add LIMIT - use fetch_count for LIMIT, per_page for OFFSET calculation
        $query .= $this->wpdb->prepare(" LIMIT %d OFFSET %d", $fetch_count, $offset);

        // Prepare query with parameters
        $params = [];

        // Collect brand parameters
        if (!empty($filters['brand_slugs']) && is_array($filters['brand_slugs'])) {
            $params = array_merge($params, $filters['brand_slugs']);
        }

        // Collect availability parameters
        if (!empty($filters['availability_slugs']) && is_array($filters['availability_slugs'])) {
            $params = array_merge($params, $filters['availability_slugs']);
        }

        // Collect shipping parameters
        if (!empty($filters['shipping_time_slugs']) && is_array($filters['shipping_time_slugs'])) {
            $params = array_merge($params, $filters['shipping_time_slugs']);
        }

        // Apply parameters if any exist
        if (!empty($params)) {
            $query = $this->wpdb->prepare($query, ...$params);
        }

        // Log the final query for debugging
        error_log("DreamShop Filter: Final SQL Query: " . $query);

        return $query;
    }

    /**
     * Build attribute filtering conditions
     */
    private function build_attribute_conditions($filters) {
        $joins = [];
        $conditions = [];

        // Availability filter - using taxonomy approach like categories
        if (!empty($filters['availability_slugs']) && is_array($filters['availability_slugs'])) {
            $joins[] = "INNER JOIN {$this->wpdb->term_relationships} tr_avail ON p.ID = tr_avail.object_id";
            $joins[] = "INNER JOIN {$this->wpdb->term_taxonomy} tt_avail ON tr_avail.term_taxonomy_id = tt_avail.term_taxonomy_id AND tt_avail.taxonomy = 'pa_disponibilita'";
            $joins[] = "INNER JOIN {$this->wpdb->terms} t_avail ON tt_avail.term_id = t_avail.term_id";

            $availability_placeholders = implode(',', array_fill(0, count($filters['availability_slugs']), '%s'));
            $conditions[] = "t_avail.slug IN ($availability_placeholders)";
        }

        // Shipping time filters - check for presence of shipping attributes
        if (!empty($filters['shipping_time_slugs']) && is_array($filters['shipping_time_slugs'])) {
            $shipping_conditions = [];
            $attr_counter = 0;

            foreach ($filters['shipping_time_slugs'] as $shipping_slug) {
                // Map shipping option slugs to attribute names
                $attribute_map = [
                    'spedizione-in-4-giorni' => 'pa_spedizione-dallitalia',
                    'spedizione-in-15-giorni' => 'pa_spedizione-dalloriente',
                    'spedizione-in-60-giorni' => 'pa_spedizione-in-60-giorni'
                ];

                if (isset($attribute_map[$shipping_slug])) {
                    $attr_name = $attribute_map[$shipping_slug];
                    $attr_counter++;

                    // Check if product has this shipping attribute (term relationship)
                    $joins[] = "LEFT JOIN {$this->wpdb->term_relationships} tr_ship{$attr_counter} ON p.ID = tr_ship{$attr_counter}.object_id";
                    $joins[] = "LEFT JOIN {$this->wpdb->term_taxonomy} tt_ship{$attr_counter} ON tr_ship{$attr_counter}.term_taxonomy_id = tt_ship{$attr_counter}.term_taxonomy_id AND tt_ship{$attr_counter}.taxonomy = '{$attr_name}'";

                    $shipping_conditions[] = "tt_ship{$attr_counter}.taxonomy IS NOT NULL";
                }
            }

            if (!empty($shipping_conditions)) {
                $conditions[] = "(" . implode(" OR ", $shipping_conditions) . ")";
            }
        }

        return [
            'joins' => $joins,
            'conditions' => $conditions
        ];
    }

    /**
     * Build count query for pagination
     */
    private function build_count_query($filters) {
        $query = "
            SELECT COUNT(*) FROM (
                SELECT p.ID
                FROM {$this->wpdb->posts} p
                INNER JOIN {$this->wpdb->postmeta} pm_price ON p.ID = pm_price.post_id AND pm_price.meta_key = '_price'
        ";

        // Apply same filters as main query (without pagination)
        $joins = [];
        $where_conditions = [
            "p.post_type = 'product'",
            "p.post_status = 'publish'",
            "p.post_password = ''"  // Exclude password protected products (often used for private products)
        ];

        // Add join to check product visibility and catalog visibility
        $joins[] = "LEFT JOIN {$this->wpdb->postmeta} pm_visibility ON p.ID = pm_visibility.post_id AND pm_visibility.meta_key = '_visibility'";
        $joins[] = "LEFT JOIN {$this->wpdb->postmeta} pm_catalog_visibility ON p.ID = pm_catalog_visibility.post_id AND pm_catalog_visibility.meta_key = '_catalog_visibility'";
        $where_conditions[] = "(pm_visibility.meta_value IS NULL OR pm_visibility.meta_value = 'visible')";
        $where_conditions[] = "(pm_catalog_visibility.meta_value IS NULL OR pm_catalog_visibility.meta_value = 'visible')";

        // Category filter
        if (!empty($filters['category_slug'])) {
            $joins[] = "INNER JOIN {$this->wpdb->term_relationships} tr_cat ON p.ID = tr_cat.object_id";
            $joins[] = "INNER JOIN {$this->wpdb->term_taxonomy} tt_cat ON tr_cat.term_taxonomy_id = tt_cat.term_taxonomy_id AND tt_cat.taxonomy = 'product_cat'";
            $joins[] = "INNER JOIN {$this->wpdb->terms} t_cat ON tt_cat.term_id = t_cat.term_id";
            $where_conditions[] = $this->wpdb->prepare("t_cat.slug = %s", $filters['category_slug']);
        }

        // Brand filter
        if (!empty($filters['brand_slugs']) && is_array($filters['brand_slugs'])) {
            $brand_placeholders = implode(',', array_fill(0, count($filters['brand_slugs']), '%s'));
            $joins[] = "INNER JOIN {$this->wpdb->term_relationships} tr_brand ON p.ID = tr_brand.object_id";
            $joins[] = "INNER JOIN {$this->wpdb->term_taxonomy} tt_brand ON tr_brand.term_taxonomy_id = tt_brand.term_taxonomy_id AND tt_brand.taxonomy = 'product_brand'";
            $joins[] = "INNER JOIN {$this->wpdb->terms} t_brand ON tt_brand.term_id = t_brand.term_id";
            $where_conditions[] = "t_brand.slug IN ($brand_placeholders)";
        }

        // Price filter
        if (!empty($filters['min_price']) && $filters['min_price'] > 0) {
            $where_conditions[] = "CAST(pm_price.meta_value AS DECIMAL(10,2)) >= " . floatval($filters['min_price']);
        }
        if (!empty($filters['max_price']) && $filters['max_price'] > 0) {
            $where_conditions[] = "CAST(pm_price.meta_value AS DECIMAL(10,2)) <= " . floatval($filters['max_price']);
        }

        // Exclude sold out products filter
        if (!empty($filters['exclude_sold_out']) && $filters['exclude_sold_out']) {
            $joins[] = "LEFT JOIN {$this->wpdb->postmeta} pm_stock ON p.ID = pm_stock.post_id AND pm_stock.meta_key = '_stock_status'";
            $where_conditions[] = "(pm_stock.meta_value IS NULL OR pm_stock.meta_value != 'outofstock')";
        }

        // Filter only products on sale
        if (!empty($filters['on_sale']) && $filters['on_sale']) {
            $joins[] = "INNER JOIN {$this->wpdb->postmeta} pm_sale_price ON p.ID = pm_sale_price.post_id AND pm_sale_price.meta_key = '_sale_price'";
            $joins[] = "INNER JOIN {$this->wpdb->postmeta} pm_regular_price ON p.ID = pm_regular_price.post_id AND pm_regular_price.meta_key = '_regular_price'";
            $where_conditions[] = "pm_sale_price.meta_value != '' AND pm_sale_price.meta_value IS NOT NULL AND CAST(pm_sale_price.meta_value AS DECIMAL(10,2)) > 0 AND CAST(pm_sale_price.meta_value AS DECIMAL(10,2)) < CAST(pm_regular_price.meta_value AS DECIMAL(10,2))";
        }

        // Attribute filters
        $attribute_conditions = $this->build_attribute_conditions($filters);
        if (!empty($attribute_conditions)) {
            $joins = array_merge($joins, $attribute_conditions['joins']);
            $where_conditions = array_merge($where_conditions, $attribute_conditions['conditions']);
        }

        // Add joins to query
        if (!empty($joins)) {
            $query .= " " . implode(" ", array_unique($joins));
        }

        // Add WHERE conditions
        $query .= " WHERE " . implode(" AND ", $where_conditions);

        // Add GROUP BY to eliminate duplicates from JOINs in count query too
        $query .= " GROUP BY p.ID) as unique_products";

        // Prepare query with parameters
        $params = [];

        // Collect brand parameters
        if (!empty($filters['brand_slugs']) && is_array($filters['brand_slugs'])) {
            $params = array_merge($params, $filters['brand_slugs']);
        }

        // Collect availability parameters
        if (!empty($filters['availability_slugs']) && is_array($filters['availability_slugs'])) {
            $params = array_merge($params, $filters['availability_slugs']);
        }

        // Collect shipping parameters
        if (!empty($filters['shipping_time_slugs']) && is_array($filters['shipping_time_slugs'])) {
            $params = array_merge($params, $filters['shipping_time_slugs']);
        }

        // Apply parameters if any exist
        if (!empty($params)) {
            $query = $this->wpdb->prepare($query, ...$params);
        }

        return $query;
    }

    /**
     * Build ORDER BY clause
     */
    private function build_order_by($orderby, $order) {
        $order = strtoupper($order) === 'ASC' ? 'ASC' : 'DESC';

        switch ($orderby) {
            case 'price':
                return " ORDER BY CAST(pm_price.meta_value AS DECIMAL(10,2)) $order";
            case 'title':
                return " ORDER BY p.post_title $order";
            case 'date':
            default:
                return " ORDER BY p.post_date $order";
        }
    }

    /**
     * Format products data
     */
    private function format_products($results) {
        $products = [];
        $skipped_products = [];
        $seen_ids = [];

        error_log("DreamShop Format: Input results count: " . count($results));
        error_log("DreamShop Format: Input IDs: " . implode(', ', array_column($results, 'ID')));

        foreach ($results as $result) {
            $product_id = $result['ID'];

            // Check for duplicates in SQL results
            if (in_array($product_id, $seen_ids)) {
                error_log("DreamShop Format: DUPLICATE ID detected in SQL results: $product_id");
                continue;
            }
            $seen_ids[] = $product_id;

            $product = wc_get_product($product_id);

            if ($product) {
                $products[] = [
                    'id' => $product_id,
                    'name' => $result['post_title'],
                    'slug' => $result['post_name'],
                    'price' => $product->get_price(),
                    'regular_price' => $product->get_regular_price(),
                    'sale_price' => $product->get_sale_price(),
                    'on_sale' => $product->is_on_sale(),
                    'stock_status' => $product->get_stock_status(),
                    'images' => $this->get_product_images($product),
                    'permalink' => get_permalink($product_id),
                    'short_description' => $result['post_excerpt'],
                    'attributes' => $this->get_product_attributes($product),
                    'has_deposit_option' => $this->check_deposit_enabled($product),
                    'shipping_class_id' => $product->get_shipping_class_id() ?: 0
                ];
            } else {
                // Log skipped product for debugging
                $skipped_products[] = $product_id;
                error_log("DreamShop Filter: Skipped product ID {$product_id} - wc_get_product returned false");
            }
        }

        // Log summary of skipped products
        if (!empty($skipped_products)) {
            error_log("DreamShop Filter: Total skipped products: " . count($skipped_products) . " - IDs: " . implode(', ', $skipped_products));
        }

        return $products;
    }

    /**
     * Check if product has deposit option enabled
     */
    private function check_deposit_enabled($product) {
        // Check if WooCommerce Deposits plugin is active
        if (!class_exists('WC_Deposits')) {
            return false;
        }

        $product_id = $product->get_id();

        // Check multiple meta keys for deposit options
        $deposit_enabled = get_post_meta($product_id, '_wc_deposit_enabled', true);
        if ($deposit_enabled === 'yes' || $deposit_enabled === 'optional') {
            return true;
        }

        // Also check for _wc_convert_to_deposit which is used by some deposit configurations
        $convert_to_deposit = get_post_meta($product_id, '_wc_convert_to_deposit', true);
        if ($convert_to_deposit === 'yes') {
            return true;
        }

        // Check if product has a deposit type set (plan, percent, or fixed)
        $deposit_type = get_post_meta($product_id, '_wc_deposit_type', true);
        if (!empty($deposit_type) && in_array($deposit_type, ['plan', 'percent', 'fixed'])) {
            return true;
        }

        return false;
    }

    /**
     * Get product images
     */
    private function get_product_images($product) {
        $images = [];

        // Main image
        $image_id = $product->get_image_id();
        if ($image_id) {
            $images[] = [
                'id' => $image_id,
                'src' => wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail'),
                'src_large' => wp_get_attachment_image_url($image_id, 'large'),
                'alt' => get_post_meta($image_id, '_wp_attachment_image_alt', true)
            ];
        }

        return $images;
    }

    /**
     * Get product attributes
     */
    private function get_product_attributes($product) {
        $attributes = [];
        $product_attributes = $product->get_attributes();

        foreach ($product_attributes as $attribute_name => $attribute) {
            $attribute_data = [
                'name' => $attribute_name,
                'slug' => $attribute_name,
                'options' => [],
                'position' => $attribute->get_position(),
                'visible' => $attribute->get_visible(),
                'variation' => $attribute->get_variation(),
                'is_taxonomy' => $attribute->is_taxonomy()
            ];

            // Get attribute options
            if ($attribute->is_taxonomy()) {
                $terms = wp_get_post_terms($product->get_id(), $attribute->get_name());
                foreach ($terms as $term) {
                    if (!is_wp_error($term)) {
                        $attribute_data['options'][] = [
                            'id' => $term->term_id,
                            'name' => $term->name,
                            'slug' => $term->slug
                        ];
                    }
                }
            } else {
                $options = $attribute->get_options();
                foreach ($options as $option) {
                    $attribute_data['options'][] = [
                        'name' => $option,
                        'slug' => sanitize_title($option)
                    ];
                }
            }

            $attributes[] = $attribute_data;
        }

        return $attributes;
    }

    /**
     * Generate cache key
     */
    private function generate_cache_key($filters, $page, $per_page, $orderby, $order) {
        return 'dreamshop_products_' . md5(serialize([$filters, $page, $per_page, $orderby, $order]));
    }

    /**
     * Get filter options (brands, categories, etc.)
     */
    public function get_filter_options() {
        $cache_key = 'dreamshop_filter_options';
        $cached_result = $this->cache_manager->get($cache_key);

        if ($cached_result !== false) {
            return $cached_result;
        }

        $options = [
            'brands' => $this->get_brands(),
            'categories' => $this->get_categories(),
            'availability' => $this->get_availability_options(),
            'shipping_times' => $this->get_shipping_time_options(),
            'price_range' => $this->get_price_range()
        ];

        $this->cache_manager->set($cache_key, $options, 900); // 15 minutes cache
        return $options;
    }

    /**
     * Get filter options for specific category
     */
    public function get_category_filter_options($category_slug) {
        $cache_key = 'dreamshop_category_filter_options_' . $category_slug;
        $cached_result = $this->cache_manager->get($cache_key);

        if ($cached_result !== false) {
            return $cached_result;
        }

        $options = [
            'brands' => $this->get_brands_by_category($category_slug),
            'categories' => $this->get_categories(),
            'availability' => $this->get_availability_options_by_category($category_slug),
            'shipping_times' => $this->get_shipping_time_options_by_category($category_slug),
            'price_range' => $this->get_price_range_by_category($category_slug)
        ];

        $this->cache_manager->set($cache_key, $options, 900); // 15 minutes cache
        return $options;
    }

    /**
     * Get all brands
     */
    private function get_brands() {
        $terms = get_terms([
            'taxonomy' => 'product_brand',
            'hide_empty' => true,
            'orderby' => 'name',
            'order' => 'ASC'
        ]);

        $brands = [];
        foreach ($terms as $term) {
            $brands[] = [
                'id' => $term->term_id,
                'name' => $term->name,
                'slug' => $term->slug,
                'count' => $term->count
            ];
        }

        return $brands;
    }

    /**
     * Get brands for specific category
     */
    private function get_brands_by_category($category_slug) {
        $query = "
            SELECT DISTINCT t_brand.term_id, t_brand.name, t_brand.slug, COUNT(DISTINCT p.ID) as count
            FROM {$this->wpdb->posts} p
            INNER JOIN {$this->wpdb->term_relationships} tr_cat ON p.ID = tr_cat.object_id
            INNER JOIN {$this->wpdb->term_taxonomy} tt_cat ON tr_cat.term_taxonomy_id = tt_cat.term_taxonomy_id AND tt_cat.taxonomy = 'product_cat'
            INNER JOIN {$this->wpdb->terms} t_cat ON tt_cat.term_id = t_cat.term_id
            INNER JOIN {$this->wpdb->term_relationships} tr_brand ON p.ID = tr_brand.object_id
            INNER JOIN {$this->wpdb->term_taxonomy} tt_brand ON tr_brand.term_taxonomy_id = tt_brand.term_taxonomy_id AND tt_brand.taxonomy = 'product_brand'
            INNER JOIN {$this->wpdb->terms} t_brand ON tt_brand.term_id = t_brand.term_id
            WHERE p.post_type = 'product'
            AND p.post_status = 'publish'
            AND t_cat.slug = %s
            GROUP BY t_brand.term_id, t_brand.name, t_brand.slug
            ORDER BY t_brand.name ASC
        ";

        $results = $this->wpdb->get_results($this->wpdb->prepare($query, $category_slug));

        $brands = [];
        foreach ($results as $result) {
            $brands[] = [
                'id' => (int) $result->term_id,
                'name' => $result->name,
                'slug' => $result->slug,
                'count' => (int) $result->count
            ];
        }

        return $brands;
    }

    /**
     * Get categories
     */
    private function get_categories() {
        $terms = get_terms([
            'taxonomy' => 'product_cat',
            'hide_empty' => true,
            'orderby' => 'name',
            'order' => 'ASC'
        ]);

        $categories = [];
        foreach ($terms as $term) {
            $categories[] = [
                'id' => $term->term_id,
                'name' => $term->name,
                'slug' => $term->slug,
                'count' => $term->count
            ];
        }

        return $categories;
    }

    /**
     * Get availability options
     */
    private function get_availability_options() {
        return [
            ['id' => 1, 'name' => 'In Stock', 'slug' => 'in-stock', 'count' => 0],
            ['id' => 2, 'name' => 'In pre-order', 'slug' => 'in-pre-order', 'count' => 0]
        ];
    }

    /**
     * Get shipping time options
     */
    private function get_shipping_time_options() {
        return [
            ['id' => 1, 'name' => 'Spedizione dall\'Italia in 4 giorni', 'slug' => 'spedizione-in-4-giorni', 'count' => 0],
            ['id' => 2, 'name' => 'Spedizione dall\'Oriente in 15 giorni', 'slug' => 'spedizione-in-15-giorni', 'count' => 0],
            ['id' => 3, 'name' => 'Spedizione in 60 giorni', 'slug' => 'spedizione-in-60-giorni', 'count' => 0]
        ];
    }

    /**
     * Get price range
     */
    private function get_price_range() {
        $query = "
            SELECT
                MIN(CAST(meta_value AS DECIMAL(10,2))) as min_price,
                MAX(CAST(meta_value AS DECIMAL(10,2))) as max_price
            FROM {$this->wpdb->postmeta} pm
            INNER JOIN {$this->wpdb->posts} p ON pm.post_id = p.ID
            WHERE pm.meta_key = '_price'
            AND p.post_type = 'product'
            AND p.post_status = 'publish'
            AND pm.meta_value != ''
        ";

        $result = $this->wpdb->get_row($query);

        return [
            'min' => (float) ($result->min_price ?? 0),
            'max' => (float) ($result->max_price ?? 100)
        ];
    }

    /**
     * Get availability options for specific category
     */
    private function get_availability_options_by_category($category_slug) {
        // For now, return static options but we could make this dynamic by checking
        // what availability options actually exist for products in this category
        return $this->get_availability_options();
    }

    /**
     * Get shipping time options for specific category
     */
    private function get_shipping_time_options_by_category($category_slug) {
        // For now, return static options but we could make this dynamic by checking
        // what shipping options actually exist for products in this category
        return $this->get_shipping_time_options();
    }

    /**
     * Get price range for specific category
     */
    private function get_price_range_by_category($category_slug) {
        $query = "
            SELECT
                MIN(CAST(pm.meta_value AS DECIMAL(10,2))) as min_price,
                MAX(CAST(pm.meta_value AS DECIMAL(10,2))) as max_price
            FROM {$this->wpdb->postmeta} pm
            INNER JOIN {$this->wpdb->posts} p ON pm.post_id = p.ID
            INNER JOIN {$this->wpdb->term_relationships} tr ON p.ID = tr.object_id
            INNER JOIN {$this->wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id AND tt.taxonomy = 'product_cat'
            INNER JOIN {$this->wpdb->terms} t ON tt.term_id = t.term_id
            WHERE pm.meta_key = '_price'
            AND p.post_type = 'product'
            AND p.post_status = 'publish'
            AND pm.meta_value != ''
            AND t.slug = %s
        ";

        $result = $this->wpdb->get_row($this->wpdb->prepare($query, $category_slug));

        return [
            'min' => (float) ($result->min_price ?? 0),
            'max' => (float) ($result->max_price ?? 100)
        ];
    }
}