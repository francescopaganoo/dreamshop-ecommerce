<?php
/**
 * REST API Class
 * Handles custom REST API endpoints for advanced filtering
 */

if (!defined('ABSPATH')) {
    exit;
}

class DreamShop_Filters_REST_API {

    private $namespace = 'dreamshop/v1';
    private $product_query;

    public function __construct() {
        $this->product_query = new DreamShop_Filters_Product_Query();
    }

    /**
     * Register REST API routes
     */
    public function register_routes() {
        // Main products filtering endpoint
        register_rest_route($this->namespace, '/products/filter', [
            'methods' => 'GET',
            'callback' => [$this, 'get_filtered_products'],
            'permission_callback' => '__return_true',
            'args' => $this->get_filter_args()
        ]);

        // Filter options endpoint
        register_rest_route($this->namespace, '/filter-options', [
            'methods' => 'GET',
            'callback' => [$this, 'get_filter_options'],
            'permission_callback' => '__return_true'
        ]);

        // Filter options for specific category endpoint
        register_rest_route($this->namespace, '/filter-options/(?P<category_slug>[a-zA-Z0-9-_]+)', [
            'methods' => 'GET',
            'callback' => [$this, 'get_category_filter_options'],
            'permission_callback' => '__return_true',
            'args' => [
                'category_slug' => [
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_string($param) && !empty($param);
                    }
                ]
            ]
        ]);

        // Product details endpoint
        register_rest_route($this->namespace, '/products/(?P<id>\d+)', [
            'methods' => 'GET',
            'callback' => [$this, 'get_product_details'],
            'permission_callback' => '__return_true',
            'args' => [
                'id' => [
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                ]
            ]
        ]);

        // Debug endpoint to analyze product structure
        register_rest_route($this->namespace, '/debug/product/(?P<id>\d+)', [
            'methods' => 'GET',
            'callback' => [$this, 'debug_product_structure'],
            'permission_callback' => '__return_true',
            'args' => [
                'id' => [
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                ]
            ]
        ]);

        // Related products endpoint by product slug
        register_rest_route($this->namespace, '/products/(?P<slug>[a-zA-Z0-9-_]+)/related', [
            'methods' => 'GET',
            'callback' => [$this, 'get_related_products'],
            'permission_callback' => '__return_true',
            'args' => [
                'slug' => [
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_string($param) && !empty($param);
                    }
                ],
                'limit' => [
                    'default' => 8,
                    'validate_callback' => function($param) {
                        return is_numeric($param) && $param > 0 && $param <= 20;
                    }
                ]
            ]
        ]);

        // Best selling products of the month endpoint
        register_rest_route($this->namespace, '/products/best-selling', [
            'methods' => 'GET',
            'callback' => [$this, 'get_best_selling_products'],
            'permission_callback' => '__return_true',
            'args' => [
                'limit' => [
                    'default' => 10,
                    'validate_callback' => function($param) {
                        return is_numeric($param) && $param > 0 && $param <= 50;
                    }
                ]
            ]
        ]);
    }

    /**
     * Get filtered products
     */
    public function get_filtered_products($request) {
        try {
            // Extract parameters
            $filters = [
                'category_slug' => $request->get_param('category'),
                'brand_slugs' => $this->parse_array_param($request->get_param('brands')),
                'availability_slugs' => $this->parse_array_param($request->get_param('availability')),
                'shipping_time_slugs' => $this->parse_array_param($request->get_param('shipping')),
                'min_price' => $request->get_param('min_price'),
                'max_price' => $request->get_param('max_price'),
                'exclude_sold_out' => $request->get_param('exclude_sold_out') === 'true' || $request->get_param('exclude_sold_out') === true,
                'on_sale' => $request->get_param('on_sale') === 'true' || $request->get_param('on_sale') === true
            ];

            $page = (int) $request->get_param('page') ?: 1;
            $per_page = min((int) $request->get_param('per_page') ?: 12, 100); // Max 100 per page
            $orderby = $request->get_param('orderby') ?: 'date';
            $order = $request->get_param('order') ?: 'DESC';

            // Log the request for debugging
            error_log('DreamShop Filter Request: ' . json_encode([
                'filters' => $filters,
                'page' => $page,
                'per_page' => $per_page,
                'orderby' => $orderby,
                'order' => $order,
                'raw_min_price' => $request->get_param('min_price'),
                'raw_max_price' => $request->get_param('max_price')
            ]));

            // Get filtered products
            $result = $this->product_query->get_filtered_products($filters, $page, $per_page, $orderby, $order);

            return new WP_REST_Response([
                'success' => true,
                'data' => $result,
                'filters_applied' => array_filter($filters), // Show only non-empty filters
                'timestamp' => current_time('timestamp')
            ], 200);

        } catch (Exception $e) {
            error_log('DreamShop Filter Error: ' . $e->getMessage());

            return new WP_REST_Response([
                'success' => false,
                'error' => 'Internal server error',
                'message' => WP_DEBUG ? $e->getMessage() : 'Something went wrong'
            ], 500);
        }
    }

    /**
     * Get filter options
     */
    public function get_filter_options($request) {
        try {
            $options = $this->product_query->get_filter_options();

            return new WP_REST_Response([
                'success' => true,
                'data' => $options,
                'timestamp' => current_time('timestamp')
            ], 200);

        } catch (Exception $e) {
            error_log('DreamShop Filter Options Error: ' . $e->getMessage());

            return new WP_REST_Response([
                'success' => false,
                'error' => 'Internal server error',
                'message' => WP_DEBUG ? $e->getMessage() : 'Something went wrong'
            ], 500);
        }
    }

    /**
     * Get filter options for specific category
     */
    public function get_category_filter_options($request) {
        try {
            $category_slug = $request->get_param('category_slug');
            $options = $this->product_query->get_category_filter_options($category_slug);

            return new WP_REST_Response([
                'success' => true,
                'data' => $options,
                'category_slug' => $category_slug,
                'timestamp' => current_time('timestamp')
            ], 200);

        } catch (Exception $e) {
            error_log('DreamShop Category Filter Options Error: ' . $e->getMessage());

            return new WP_REST_Response([
                'success' => false,
                'error' => 'Internal server error',
                'message' => WP_DEBUG ? $e->getMessage() : 'Something went wrong'
            ], 500);
        }
    }

    /**
     * Get detailed product information
     */
    public function get_product_details($request) {
        try {
            $product_id = (int) $request->get_param('id');
            $product = wc_get_product($product_id);

            if (!$product) {
                return new WP_REST_Response([
                    'success' => false,
                    'error' => 'Product not found'
                ], 404);
            }

            $product_data = [
                'id' => $product_id,
                'name' => $product->get_name(),
                'slug' => $product->get_slug(),
                'description' => $product->get_description(),
                'short_description' => $product->get_short_description(),
                'price' => $product->get_price(),
                'regular_price' => $product->get_regular_price(),
                'sale_price' => $product->get_sale_price(),
                'on_sale' => $product->is_on_sale(),
                'stock_status' => $product->get_stock_status(),
                'stock_quantity' => $product->get_stock_quantity(),
                'categories' => $this->get_product_categories($product),
                'tags' => $this->get_product_tags($product),
                'attributes' => $this->get_product_attributes($product),
                'images' => $this->get_product_images($product),
                'permalink' => get_permalink($product_id),
                'shipping_class_id' => $product->get_shipping_class_id() ?: 0
            ];

            return new WP_REST_Response([
                'success' => true,
                'data' => $product_data,
                'timestamp' => current_time('timestamp')
            ], 200);

        } catch (Exception $e) {
            error_log('DreamShop Product Details Error: ' . $e->getMessage());

            return new WP_REST_Response([
                'success' => false,
                'error' => 'Internal server error',
                'message' => WP_DEBUG ? $e->getMessage() : 'Something went wrong'
            ], 500);
        }
    }

    /**
     * Debug product structure - helps understand how attributes are stored
     */
    public function debug_product_structure($request) {
        try {
            $product_id = (int) $request->get_param('id');
            $product = wc_get_product($product_id);

            if (!$product) {
                return new WP_REST_Response([
                    'success' => false,
                    'error' => 'Product not found'
                ], 404);
            }

            global $wpdb;

            // Get all post meta for this product
            $all_meta = $wpdb->get_results($wpdb->prepare("
                SELECT meta_key, meta_value
                FROM {$wpdb->postmeta}
                WHERE post_id = %d
                ORDER BY meta_key
            ", $product_id), ARRAY_A);

            // Get product terms (categories, brands, etc.)
            $terms = $wpdb->get_results($wpdb->prepare("
                SELECT tt.taxonomy, t.name, t.slug, t.term_id
                FROM {$wpdb->term_relationships} tr
                INNER JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
                INNER JOIN {$wpdb->terms} t ON tt.term_id = t.term_id
                WHERE tr.object_id = %d
                ORDER BY tt.taxonomy, t.name
            ", $product_id), ARRAY_A);

            // Get WooCommerce product attributes
            $wc_attributes = $product->get_attributes();
            $formatted_attributes = [];

            foreach ($wc_attributes as $attribute_name => $attribute) {
                $formatted_attributes[$attribute_name] = [
                    'name' => $attribute->get_name(),
                    'options' => $attribute->get_options(),
                    'position' => $attribute->get_position(),
                    'visible' => $attribute->get_visible(),
                    'variation' => $attribute->get_variation(),
                    'is_taxonomy' => $attribute->is_taxonomy()
                ];
            }

            $debug_data = [
                'product_id' => $product_id,
                'product_name' => $product->get_name(),
                'product_type' => $product->get_type(),
                'all_meta' => $all_meta,
                'terms' => $terms,
                'wc_attributes' => $formatted_attributes,
                'raw_attributes' => $this->get_product_attributes($product),
                'categories' => $this->get_product_categories($product),
                'brands' => $this->get_product_brands($product)
            ];

            return new WP_REST_Response([
                'success' => true,
                'data' => $debug_data,
                'timestamp' => current_time('timestamp')
            ], 200);

        } catch (Exception $e) {
            error_log('DreamShop Debug Error: ' . $e->getMessage());

            return new WP_REST_Response([
                'success' => false,
                'error' => 'Internal server error',
                'message' => WP_DEBUG ? $e->getMessage() : 'Something went wrong'
            ], 500);
        }
    }

    /**
     * Get filter arguments for validation
     */
    private function get_filter_args() {
        return [
            'category' => [
                'description' => 'Category slug',
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field'
            ],
            'brands' => [
                'description' => 'Comma-separated brand slugs',
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field'
            ],
            'availability' => [
                'description' => 'Comma-separated availability options',
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field'
            ],
            'shipping' => [
                'description' => 'Comma-separated shipping time options',
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field'
            ],
            'min_price' => [
                'description' => 'Minimum price',
                'type' => 'number',
                'minimum' => 0
            ],
            'max_price' => [
                'description' => 'Maximum price',
                'type' => 'number',
                'minimum' => 0
            ],
            'page' => [
                'description' => 'Page number',
                'type' => 'integer',
                'minimum' => 1,
                'default' => 1
            ],
            'per_page' => [
                'description' => 'Products per page',
                'type' => 'integer',
                'minimum' => 1,
                'maximum' => 100,
                'default' => 12
            ],
            'orderby' => [
                'description' => 'Order by field',
                'type' => 'string',
                'enum' => ['date', 'title', 'price'],
                'default' => 'date'
            ],
            'order' => [
                'description' => 'Order direction',
                'type' => 'string',
                'enum' => ['ASC', 'DESC'],
                'default' => 'DESC'
            ],
            'exclude_sold_out' => [
                'description' => 'Exclude sold out products',
                'type' => 'boolean',
                'default' => false
            ],
            'on_sale' => [
                'description' => 'Filter only products on sale',
                'type' => 'boolean',
                'default' => false
            ]
        ];
    }

    /**
     * Parse comma-separated string to array
     */
    private function parse_array_param($param) {
        if (empty($param)) {
            return [];
        }

        return array_map('trim', explode(',', $param));
    }

    /**
     * Get product categories
     */
    private function get_product_categories($product) {
        $categories = [];
        $category_ids = $product->get_category_ids();

        foreach ($category_ids as $category_id) {
            $category = get_term($category_id, 'product_cat');
            if ($category && !is_wp_error($category)) {
                $categories[] = [
                    'id' => $category->term_id,
                    'name' => $category->name,
                    'slug' => $category->slug
                ];
            }
        }

        return $categories;
    }

    /**
     * Get product tags
     */
    private function get_product_tags($product) {
        $tags = [];
        $tag_ids = $product->get_tag_ids();

        foreach ($tag_ids as $tag_id) {
            $tag = get_term($tag_id, 'product_tag');
            if ($tag && !is_wp_error($tag)) {
                $tags[] = [
                    'id' => $tag->term_id,
                    'name' => $tag->name,
                    'slug' => $tag->slug
                ];
            }
        }

        return $tags;
    }

    /**
     * Get product brands
     */
    private function get_product_brands($product) {
        $brands = [];
        $brand_terms = wp_get_post_terms($product->get_id(), 'product_brand');

        foreach ($brand_terms as $brand) {
            if (!is_wp_error($brand)) {
                $brands[] = [
                    'id' => $brand->term_id,
                    'name' => $brand->name,
                    'slug' => $brand->slug
                ];
            }
        }

        return $brands;
    }

    /**
     * Get product attributes
     */
    private function get_product_attributes($product) {
        $attributes = [];
        $product_attributes = $product->get_attributes();

        foreach ($product_attributes as $attribute_name => $attribute) {
            $attribute_data = [
                'name' => $attribute->get_name(),
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

        // Gallery images
        $gallery_ids = $product->get_gallery_image_ids();
        foreach ($gallery_ids as $gallery_id) {
            $images[] = [
                'id' => $gallery_id,
                'src' => wp_get_attachment_image_url($gallery_id, 'woocommerce_thumbnail'),
                'src_large' => wp_get_attachment_image_url($gallery_id, 'large'),
                'alt' => get_post_meta($gallery_id, '_wp_attachment_image_alt', true)
            ];
        }

        return $images;
    }

    /**
     * Get related products by product slug
     */
    public function get_related_products($request) {
        try {
            $product_slug = $request->get_param('slug');
            $limit = (int) $request->get_param('limit') ?: 4;

            // Get product by slug
            $product_post = get_page_by_path($product_slug, OBJECT, 'product');
            if (!$product_post) {
                return new WP_REST_Response([
                    'success' => false,
                    'error' => 'Product not found'
                ], 404);
            }

            $product = wc_get_product($product_post->ID);
            if (!$product) {
                return new WP_REST_Response([
                    'success' => false,
                    'error' => 'Product not found'
                ], 404);
            }

            // Get related products ordered by date (most recent first) using primary category
            $primary_category_id = $this->get_primary_category_id($product);
            $related_ids = $this->get_recent_related_products($product->get_id(), $primary_category_id, $limit);

            $related_products = [];
            foreach ($related_ids as $related_id) {
                $related_product = wc_get_product($related_id);
                if ($related_product) {
                    $related_products[] = [
                        'id' => $related_id,
                        'name' => $related_product->get_name(),
                        'slug' => $related_product->get_slug(),
                        'price' => $related_product->get_price(),
                        'regular_price' => $related_product->get_regular_price(),
                        'sale_price' => $related_product->get_sale_price(),
                        'on_sale' => $related_product->is_on_sale(),
                        'stock_status' => $related_product->get_stock_status(),
                        'images' => $this->get_product_images($related_product),
                        'permalink' => get_permalink($related_id),
                        'short_description' => $related_product->get_short_description(),
                        'categories' => $this->get_product_categories($related_product),
                        'attributes' => $this->get_product_attributes($related_product),
                        'has_deposit_option' => $this->check_deposit_enabled($related_product)
                    ];
                }
            }

            return new WP_REST_Response([
                'success' => true,
                'data' => [
                    'product' => [
                        'id' => $product->get_id(),
                        'name' => $product->get_name(),
                        'slug' => $product->get_slug()
                    ],
                    'related_products' => $related_products,
                    'total' => count($related_products)
                ],
                'timestamp' => current_time('timestamp')
            ], 200);

        } catch (Exception $e) {
            error_log('DreamShop Related Products Error: ' . $e->getMessage());

            return new WP_REST_Response([
                'success' => false,
                'error' => 'Internal server error',
                'message' => WP_DEBUG ? $e->getMessage() : 'Something went wrong'
            ], 500);
        }
    }

    /**
     * Get best selling products of the month
     */
    public function get_best_selling_products($request) {
        try {
            $limit = (int) $request->get_param('limit') ?: 10;

            // Calculate date range for current month
            $start_date = date('Y-m-01');
            $end_date = date('Y-m-t');

            global $wpdb;

            // Query to get best selling products based on order items in the current month
            $query = "
                SELECT p.ID, p.post_title, p.post_name, SUM(oim.meta_value) as total_sales
                FROM {$wpdb->posts} p
                INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim_product ON p.ID = oim_product.meta_value
                INNER JOIN {$wpdb->prefix}woocommerce_order_items oi ON oim_product.order_item_id = oi.order_item_id
                INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim ON oi.order_item_id = oim.order_item_id
                INNER JOIN {$wpdb->posts} o ON oi.order_id = o.ID
                WHERE p.post_type = 'product'
                AND p.post_status = 'publish'
                AND oim_product.meta_key = '_product_id'
                AND oim.meta_key = '_qty'
                AND o.post_type = 'shop_order'
                AND o.post_status IN ('wc-completed', 'wc-processing')
                AND DATE(o.post_date) BETWEEN %s AND %s
                GROUP BY p.ID, p.post_title, p.post_name
                ORDER BY total_sales DESC
                LIMIT %d
            ";

            $results = $wpdb->get_results($wpdb->prepare($query, $start_date, $end_date, $limit));

            // If no sales data for current month, fallback to overall best sellers
            if (empty($results)) {
                $fallback_query = "
                    SELECT p.ID, p.post_title, p.post_name, pm.meta_value as total_sales
                    FROM {$wpdb->posts} p
                    LEFT JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = 'total_sales'
                    WHERE p.post_type = 'product'
                    AND p.post_status = 'publish'
                    ORDER BY CAST(COALESCE(pm.meta_value, '0') AS UNSIGNED) DESC
                    LIMIT %d
                ";

                $results = $wpdb->get_results($wpdb->prepare($fallback_query, $limit));
            }

            $best_selling_products = [];
            foreach ($results as $result) {
                $product = wc_get_product($result->ID);
                if ($product) {
                    $best_selling_products[] = [
                        'id' => $result->ID,
                        'name' => $result->post_title,
                        'slug' => $result->post_name,
                        'price' => $product->get_price(),
                        'regular_price' => $product->get_regular_price(),
                        'sale_price' => $product->get_sale_price(),
                        'on_sale' => $product->is_on_sale(),
                        'stock_status' => $product->get_stock_status(),
                        'images' => $this->get_product_images($product),
                        'permalink' => get_permalink($result->ID),
                        'short_description' => $product->get_short_description(),
                        'categories' => $this->get_product_categories($product),
                        'attributes' => $this->get_product_attributes($product),
                        'sales_count' => (int) $result->total_sales,
                        'has_deposit_option' => $this->check_deposit_enabled($product)
                    ];
                }
            }

            return new WP_REST_Response([
                'success' => true,
                'data' => [
                    'products' => $best_selling_products,
                    'total' => count($best_selling_products),
                    'period' => [
                        'start_date' => $start_date,
                        'end_date' => $end_date,
                        'month' => date('F Y')
                    ]
                ],
                'timestamp' => current_time('timestamp')
            ], 200);

        } catch (Exception $e) {
            error_log('DreamShop Best Selling Products Error: ' . $e->getMessage());

            return new WP_REST_Response([
                'success' => false,
                'error' => 'Internal server error',
                'message' => WP_DEBUG ? $e->getMessage() : 'Something went wrong'
            ], 500);
        }
    }

    /**
     * Get primary category ID (Yoast primary or first category)
     */
    private function get_primary_category_id($product) {
        $product_id = $product->get_id();

        // Cerca la categoria primaria di Yoast
        $primary_cat_id = get_post_meta($product_id, '_yoast_wpseo_primary_product_cat', true);

        if (!empty($primary_cat_id) && is_numeric($primary_cat_id)) {
            return (int) $primary_cat_id;
        }

        // Fallback alla prima categoria
        $category_ids = $product->get_category_ids();
        return !empty($category_ids) ? $category_ids[0] : null;
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
     * Get related products ordered by date (most recent first) using primary category only
     */
    private function get_recent_related_products($product_id, $primary_category_id, $limit) {
        global $wpdb;

        // Se non c'è categoria primaria, fallback ai prodotti più recenti
        if (empty($primary_category_id)) {
            return wc_get_related_products($product_id, $limit);
        }

        // Query per prodotti SOLO nella categoria primaria ordinati per data (prendiamo più prodotti per randomizzare)
        $fetch_limit = $limit * 3; // Prendiamo 3 volte i prodotti richiesti per avere varietà

        $query = "
            SELECT DISTINCT p.ID
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->term_relationships} tr ON p.ID = tr.object_id
            INNER JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
            LEFT JOIN {$wpdb->postmeta} pm_stock ON p.ID = pm_stock.post_id AND pm_stock.meta_key = '_stock_status'
            WHERE p.post_type = 'product'
            AND p.post_status = 'publish'
            AND p.ID != %d
            AND tt.taxonomy = 'product_cat'
            AND tt.term_id = %d
            AND (pm_stock.meta_value = 'instock' OR pm_stock.meta_value IS NULL)
            ORDER BY p.post_date DESC
            LIMIT %d
        ";

        $all_related_ids = $wpdb->get_col($wpdb->prepare($query, $product_id, $primary_category_id, $fetch_limit));

        // Randomizza e prendi solo il numero richiesto
        if (!empty($all_related_ids)) {
            shuffle($all_related_ids);
            $related_ids = array_slice($all_related_ids, 0, $limit);
        } else {
            $related_ids = [];
        }

        // Se non troviamo risultati nella categoria primaria, usa il fallback originale
        if (empty($related_ids)) {
            return wc_get_related_products($product_id, $limit);
        }

        return $related_ids;
    }
}