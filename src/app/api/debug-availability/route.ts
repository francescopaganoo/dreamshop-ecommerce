import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL?.replace(/\/$/, '') || '';

    // Test 1: Get filter options to see availability structure
    console.log('🔍 Testing filter options for availability...');
    const optionsUrl = `${baseUrl}/wp-json/dreamshop/v1/filter-options`;
    const optionsResponse = await fetch(optionsUrl);
    const optionsData = await optionsResponse.json();

    console.log('📊 Availability options:', optionsData.data?.availability);

    // Test 2: Test availability filter with in-stock
    console.log('🔍 Testing availability filter with in-stock...');
    const inStockUrl = `${baseUrl}/wp-json/dreamshop/v1/products/filter?availability=in-stock&per_page=5`;
    const inStockResponse = await fetch(inStockUrl);
    const inStockData = await inStockResponse.json();

    // Test 3: Test availability filter with in-pre-order
    console.log('🔍 Testing availability filter with in-pre-order...');
    const preOrderUrl = `${baseUrl}/wp-json/dreamshop/v1/products/filter?availability=in-pre-order&per_page=5`;
    const preOrderResponse = await fetch(preOrderUrl);
    const preOrderData = await preOrderResponse.json();

    // Test 4: Debug a specific product to see its availability attributes
    console.log('🔍 Testing product 175890 to see its availability...');
    const productUrl = `${baseUrl}/wp-json/dreamshop/v1/debug/product/175890`;
    const productResponse = await fetch(productUrl);
    const productData = await productResponse.json();

    // Test 5: Get all products without filters to see what availability data they have
    console.log('🔍 Getting sample products to analyze availability data...');
    const allProductsUrl = `${baseUrl}/wp-json/dreamshop/v1/products/filter?per_page=3`;
    const allProductsResponse = await fetch(allProductsUrl);
    const allProductsData = await allProductsResponse.json();

    return NextResponse.json({
      success: true,
      debug: {
        availabilityOptions: optionsData.data?.availability || [],
        inStockTest: {
          url: inStockUrl,
          status: inStockResponse.status,
          success: inStockData.success,
          productsFound: inStockData.data?.products?.length || 0,
          total: inStockData.data?.total || 0,
          message: inStockData.message || 'No message'
        },
        preOrderTest: {
          url: preOrderUrl,
          status: preOrderResponse.status,
          success: preOrderData.success,
          productsFound: preOrderData.data?.products?.length || 0,
          total: preOrderData.data?.total || 0,
          message: preOrderData.message || 'No message'
        },
        productDebug: {
          url: productUrl,
          status: productResponse.status,
          success: productData.success,
          productAttributes: productData.data?.attributes || {},
          availabilityAttribute: productData.data?.attributes?.pa_disponibilita || null
        },
        sampleProducts: {
          total: allProductsData.data?.total || 0,
          products: allProductsData.data?.products?.slice(0, 2) || []
        }
      }
    });

  } catch (error) {
    console.error('❌ Debug availability error:', error);
    return NextResponse.json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}