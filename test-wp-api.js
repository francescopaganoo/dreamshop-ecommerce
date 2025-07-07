// Test diretto dell'API WordPress per gli acconti

// Definisci direttamente l'URL dell'API WordPress
const WORDPRESS_API_URL = 'https://be.dreamshop18.com';
const productId = 54595; // ID del prodotto da testare

console.log(`Test API per acconto - usando WORDPRESS_API_URL: ${WORDPRESS_API_URL}`);

const depositEndpoint = `${WORDPRESS_API_URL}/wp-json/dreamshop/v1/products/${productId}/deposit-options`;

console.log(`Calling endpoint: ${depositEndpoint}`);

// Funzione per testare l'API
async function testDepositAPI() {
  try {
    const response = await fetch(depositEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('Response status:', response.status);
    
    const responseText = await response.text();
    console.log('Response text length:', responseText.length);
    
    try {
      const data = JSON.parse(responseText);
      console.log('Response data:', JSON.stringify(data, null, 2));
      
      if (!data.success) {
        console.log('API error:', data.message);
      }
    } catch (parseError) {
      console.error('Error parsing response as JSON:', parseError.message);
      console.log('Raw response (first 500 chars):', responseText.substring(0, 500));
    }
  } catch (error) {
    console.error('Error calling API:', error);
  }
}

// Esegui il test
testDepositAPI();
