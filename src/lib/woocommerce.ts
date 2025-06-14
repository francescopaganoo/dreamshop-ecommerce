import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";

// Initialize the WooCommerce API
const api = new WooCommerceRestApi({
  url: process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://be.dreamshop18.com/',
  consumerKey: process.env.WC_CONSUMER_KEY || 'ck_56956244a9dd0650ae126115f5e5c5a100af6a99',
  consumerSecret: process.env.WC_CONSUMER_SECRET || 'cs_ec3a6b069694465a1a769795892bf8b5d67b1773',
  version: "wc/v3",
});

export default api;
