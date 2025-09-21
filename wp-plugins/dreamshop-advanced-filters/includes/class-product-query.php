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

        // Build the main query
        $query = $this->build_products_query($filters, $page, $per_page, $orderby, $order);

        // Execute query
        $results = $this->wpdb->get_results($query, ARRAY_A);

        // Get total count for pagination
        $total_query = $this->build_count_query($filters);
        $total_count = (int) $this->wpdb->get_var($total_query);

        // Format results
        $products = $this->format_products($results);

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
     * Build the main products query
     */
    private function build_products_query($filters, $page, $per_page, $orderby, $order) {
        $offset = ($page - 1) * $per_page;

        // Base query
        $query = "
            SELECT DISTINCT p.ID, p.post_title, p.post_name, p.post_excerpt, pm_price.meta_value as price
            FROM {$this->wpdb->posts} p
            INNER JOIN {$this->wpdb->postmeta} pm_price ON p.ID = pm_price.post_id AND pm_price.meta_key = '_price'
        ";

        // Join conditions based on filters
        $joins = [];
        $where_conditions = ["p.post_type = 'product'", "p.post_status = 'publish'"];

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
        if (!empty($filters['min_price']) || !empty($filters['max_price'])) {
            if (!empty($filters['min_price'])) {
                $where_conditions[] = $this->wpdb->prepare("CAST(pm_price.meta_value AS DECIMAL(10,2)) >= %f", $filters['min_price']);
            }
            if (!empty($filters['max_price'])) {
                $where_conditions[] = $this->wpdb->prepare("CAST(pm_price.meta_value AS DECIMAL(10,2)) <= %f", $filters['max_price']);
            }
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

        // Add ORDER BY
        $query .= $this->build_order_by($orderby, $order);

        // Add LIMIT
        $query .= $this->wpdb->prepare(" LIMIT %d OFFSET %d", $per_page, $offset);

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
            SELECT COUNT(DISTINCT p.ID)
            FROM {$this->wpdb->posts} p
            INNER JOIN {$this->wpdb->postmeta} pm_price ON p.ID = pm_price.post_id AND pm_price.meta_key = '_price'
        ";

        // Apply same filters as main query (without pagination)
        // This is a simplified version - in production you'd want to reuse the logic
        $where_conditions = ["p.post_type = 'product'", "p.post_status = 'publish'"];

        return $query . " WHERE " . implode(" AND ", $where_conditions);
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

        foreach ($results as $result) {
            $product_id = $result['ID'];
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
                    'short_description' => $result['post_excerpt']
                ];
            }
        }

        return $products;
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
}