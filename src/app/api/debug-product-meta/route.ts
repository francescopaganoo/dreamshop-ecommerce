import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const productId = url.searchParams.get('productId') || '54595';
  
  console.log(`Debug prodotto metadati - product ID: ${productId}`);
  
  try {
    // Ottieni l'URL corretto dall'ambiente
    const wpUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://be.dreamshop18.com';
    
    // Crea una chiamata API per ottenere i dettagli completi del prodotto tramite WooCommerce REST API
    const wcEndpoint = `${wpUrl}/wp-json/wc/v3/products/${productId}`;
    
    // Aggiungi le credenziali WooCommerce
    const consumerKey = process.env.WC_CONSUMER_KEY || 'ck_56956244a9dd0650ae126115f5e5c5a100af6a99';
    const consumerSecret = process.env.WC_CONSUMER_SECRET || 'cs_ec3a6b069694465a1a769795892bf8b5d67b1773';
    
    const wcApiUrl = `${wcEndpoint}?consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`;
    
    console.log('Calling WooCommerce API:', wcApiUrl);
    
    // Effettua la chiamata all'endpoint WooCommerce
    const wcResponse = await fetch(wcApiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const wcData = await wcResponse.json();
    
    // Estrai i metadati del prodotto
    const metaData = wcData.meta_data || [];
    
    // Definizione dell'interfaccia per i metadati
    interface ProductMeta {
      key: string;
      value: string | number | boolean | object;
    }
    
    // Filtra i metadati relativi agli acconti
    const depositMeta = metaData.filter((meta: ProductMeta) => 
      meta.key.includes('_wc_deposit') || 
      meta.key.includes('deposit') ||
      meta.key.includes('_wc_pp_')
    );
    
    // Chiamata all'endpoint personalizzato per gli acconti
    const depositEndpoint = `${wpUrl}/wp-json/dreamshop/v1/products/${productId}/deposit-options`;
    
    console.log('Calling Deposits API:', depositEndpoint);
    
    // Effettua la chiamata all'endpoint degli acconti
    let depositResponse, depositData;
    try {
      depositResponse = await fetch(depositEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const depositText = await depositResponse.text();
      try {
        depositData = JSON.parse(depositText);
      } catch {
        // Se non è possibile parsare come JSON, restituisci il testo grezzo
        depositData = { raw: depositText };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      depositData = { error: errorMessage };
    }
    
    // Dati di risposta completi
    return NextResponse.json({
      debug: {
        productId,
        wcApiUrl,
        depositEndpoint,
      },
      product: {
        id: wcData.id,
        name: wcData.name,
        type: wcData.type,
        price: wcData.price,
      },
      depositMetadata: depositMeta,
      allMetadata: metaData,
      depositApiResponse: {
        status: depositResponse?.status,
        data: depositData
      }
    });
    
  } catch (error: Error | unknown) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    console.error('Error testing product meta:', errorObj);
    return NextResponse.json({
      error: errorObj.message,
      stack: errorObj.stack
    }, { status: 500 });
  }
}
