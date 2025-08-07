import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";

// Validate required environment variables
if (!process.env.NEXT_PUBLIC_WORDPRESS_URL) {
  throw new Error('NEXT_PUBLIC_WORDPRESS_URL is required');
}
if (!process.env.NEXT_PUBLIC_WC_CONSUMER_KEY) {
  throw new Error('NEXT_PUBLIC_WC_CONSUMER_KEY is required');
}
if (!process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET) {
  throw new Error('NEXT_PUBLIC_WC_CONSUMER_SECRET is required');
}

// Initialize the WooCommerce API
const api = new WooCommerceRestApi({
  url: process.env.NEXT_PUBLIC_WORDPRESS_URL,
  consumerKey: process.env.NEXT_PUBLIC_WC_CONSUMER_KEY,
  consumerSecret: process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET,
  version: "wc/v3",
});

export default api;
