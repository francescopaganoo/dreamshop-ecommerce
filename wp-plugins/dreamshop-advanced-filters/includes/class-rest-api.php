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
                'exclude_sold_out' => $request->get_param('exclude_sold_out') === 'true' || $request->get_param('exclude_sold_out') === true
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
                'permalink' => get_permalink($product_id)
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
}