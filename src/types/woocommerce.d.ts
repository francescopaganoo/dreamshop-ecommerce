declare module '@woocommerce/woocommerce-rest-api' {
  // Define common response type
  export interface WooCommerceResponse {
    [key: string]: unknown;
  }

  // Define common params type
  export interface WooCommerceParams {
    [key: string]: string | number | boolean | undefined;
  }

  // Define common data type
  export interface WooCommerceData {
    [key: string]: unknown;
  }

  export interface WooCommerceRestApiOptions {
    url: string;
    consumerKey: string;
    consumerSecret: string;
    version: string;
    queryStringAuth?: boolean;
    wpAPIPrefix?: string;
    axiosConfig?: Record<string, unknown>;
  }

  class WooCommerceRestApi {
    constructor(options: WooCommerceRestApiOptions);
    get(endpoint: string, params?: WooCommerceParams): Promise<WooCommerceResponse>;
    post(endpoint: string, data: WooCommerceData, params?: WooCommerceParams): Promise<WooCommerceResponse>;
    put(endpoint: string, data: WooCommerceData, params?: WooCommerceParams): Promise<WooCommerceResponse>;
    delete(endpoint: string, params?: WooCommerceParams): Promise<WooCommerceResponse>;
    options(endpoint: string, params?: WooCommerceParams): Promise<WooCommerceResponse>;
  }

  export default WooCommerceRestApi;
}
