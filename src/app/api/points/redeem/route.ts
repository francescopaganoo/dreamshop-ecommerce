import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// Definiamo le interfacce per i tipi
interface CouponLine {
  id?: number;
  code: string;
  discount?: string;
  discount_tax?: string;
}

// Interfaccia per i dati dell'ordine WooCommerce
interface WooOrder {
  id: number;
  coupon_lines: CouponLine[];
  // Aggiungiamo solo i campi effettivamente usati
  [key: string]: unknown; 
}

/**
 * API per decurtare punti dall'utente
 * POST /api/points/redeem
 */
export async function POST(request: NextRequest) {
  console.log('[POINTS API] Richiesta decurtazione punti ricevuta');
  
  // Verifica l'autenticazione
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[POINTS API] Token non fornito');
    return NextResponse.json({ error: 'Token non fornito', success: false }, { status: 401 });
  }
  
  const token = authHeader.substring(7); // Rimuovi 'Bearer ' dal token
  
  try {
    // Decodifica il token per ottenere l'ID utente
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    
    if (!decoded || !decoded.id) {
      console.error('[POINTS API] Token decodificato non valido o mancante ID utente');
      return NextResponse.json({ error: 'Token non valido o ID utente mancante', success: false }, { status: 401 });
    }
    
    const userId = decoded.id;
    console.log(`[POINTS API] Utente autenticato: ${userId}`);
    
    // Ottieni i dati dalla richiesta
    let requestData;
    try {
      requestData = await request.json();
      console.log('[POINTS API] Dati richiesta:', JSON.stringify(requestData));
    } catch (parseError) {
      console.error('[POINTS API] Errore nel parsing del JSON della richiesta:', parseError);
      return NextResponse.json({ error: 'Formato richiesta non valido', success: false }, { status: 400 });
    }
    
    // Verifica che i dati necessari siano presenti
    if (!requestData.points || requestData.points <= 0) {
      console.error(`[POINTS API] Punti non validi: ${requestData.points}`);
      return NextResponse.json({ 
        error: 'Dati mancanti o non validi: points deve essere un numero positivo', 
        success: false 
      }, { status: 400 });
    }
    
    // Verifica order_id
    const orderId = requestData.order_id || 0;
    console.log(`[POINTS API] Decurto ${requestData.points} punti per utente ${userId}, ordine #${orderId}`);
    
    // Configurazioni di base per la richiesta
    const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://be.dreamshop18.com/';
    const baseUrl = wordpressUrl.endsWith('/') ? wordpressUrl : `${wordpressUrl}/`;
    const requestBody = {
      user_id: userId, // Aggiungiamo esplicitamente l'ID utente
      points: requestData.points,
      description: requestData.description || `Punti utilizzati per uno sconto`,
      order_id: orderId
    };
    
    console.log(`[POINTS API] Parametri richiesta:`, JSON.stringify(requestBody));
    
    // Utilizza il nuovo endpoint sicuro con chiave API
    try {
      console.log('[POINTS API] Chiamata al nuovo endpoint sicuro secure-redeem');
      
      // Chiave API condivisa con il plugin WordPress tramite variabile d'ambiente
      const apiKey = process.env.POINTS_API_KEY;
      
      if (!apiKey) {
        console.error('[POINTS API] Errore: POINTS_API_KEY non configurata nelle variabili d\'ambiente');
        return NextResponse.json({
          error: 'Errore di configurazione del server',
          success: false,
          message: 'Chiave API non configurata'
        }, { status: 500 });
      }
      
      // Costruisci il corpo della richiesta includendo il valore monetario dei punti (discount_amount)
      // La formula di conversione può essere personalizzata (qui 1 punto = 0.01€)
      const pointsDiscountAmount = requestData.points / 100;
      const completeRequestBody = {
        ...requestBody,
        discount_amount: pointsDiscountAmount
      };
      
      console.log(`[POINTS API] Valore sconto calcolato: ${pointsDiscountAmount}€ per ${requestData.points} punti`);
      
      // Chiamata all'endpoint sicuro per generare il coupon e riscattare i punti
      const secureEndpointResponse = await fetch(`${baseUrl}wp-json/dreamshop-points/v1/points/secure-redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey, // Utilizziamo la chiave API invece del token JWT
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(completeRequestBody)
      });
      
      // Log della risposta per debug
      const responseStatus = secureEndpointResponse.status;
      console.log(`[POINTS API] Risposta endpoint secure-redeem: status ${responseStatus}`);
      
      if (secureEndpointResponse.ok) {
        // Risposta di successo
        const responseData = await secureEndpointResponse.json();
        console.log('[POINTS API] Punti decurtati con successo:', JSON.stringify(responseData));
        
        // Estrai i dati del coupon dalla risposta
        interface CouponResponse {
          coupon_code: string;
          expiry_date?: string;
          [key: string]: unknown;
        }
        
        const couponData = (responseData.coupon as CouponResponse) || {};
        const couponCode = couponData.coupon_code || '';
        const discountAmount = responseData.discount_amount || (requestData.points / 100);
        
        console.log(`[POINTS API] Coupon generato: ${couponCode} con valore ${discountAmount}€`);
        
        // Se abbiamo un ordine ID, proviamo ad applicare il coupon tramite l'API WooCommerce
        let couponApplied = false;
        if (orderId && couponCode) {
          try {
            console.log(`[POINTS API] Tentativo di applicare il coupon ${couponCode} all'ordine ${orderId}`);
            
            // Ottieni le credenziali WooCommerce dalle variabili d'ambiente
            const wcConsumerKey = process.env.WC_CONSUMER_KEY || '';
            const wcConsumerSecret = process.env.WC_CONSUMER_SECRET || '';
            
            if (!wcConsumerKey || !wcConsumerSecret) {
              console.error('[POINTS API] Credenziali WooCommerce mancanti nelle variabili d\'ambiente');
            } else {
              try {
                // Aggiungi il coupon all'ordine con l'API WooCommerce
                const applyUrl = `${baseUrl}wp-json/wc/v3/orders/${orderId}?consumer_key=${wcConsumerKey}&consumer_secret=${wcConsumerSecret}`;
                
                // Ottieni prima l'ordine corrente per verificare i coupon esistenti
                const getOrderResponse = await fetch(applyUrl, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
                
                if (getOrderResponse.ok) {
                  const orderData = await getOrderResponse.json();
                  
                  // Verifica se il coupon è già applicato all'ordine
                  const currentCoupons = orderData.coupon_lines || [];
                  const couponAlreadyApplied = currentCoupons.some(
                    (coupon: CouponLine) => coupon.code === couponCode
                  );
                  
                  if (couponAlreadyApplied) {
                    console.log(`[POINTS API] Il coupon ${couponCode} è già applicato all'ordine ${orderId}`);
                    couponApplied = true;
                  } else {
                    try {
                      // Metodo alternativo: invece di aggiornare i coupon_lines direttamente,
                      // usiamo l'endpoint specifico per l'applicazione dei coupon
                      const applyCouponUrl = `${baseUrl}wp-json/wc/v3/orders/${orderId}/apply_coupon?consumer_key=${wcConsumerKey}&consumer_secret=${wcConsumerSecret}`;
                      
                      console.log(`[POINTS API] Utilizzo endpoint specializzato per applicare il coupon: ${applyCouponUrl}`);
                      
                      const applyCouponResponse = await fetch(applyCouponUrl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          code: couponCode
                        })
                      });
                      
                      if (applyCouponResponse.ok) {
                        console.log(`[POINTS API] Coupon ${couponCode} applicato con successo tramite endpoint specializzato`);
                        couponApplied = true;
                      } else {
                        // Se fallisce l'endpoint specializzato, proviamo il metodo standard di aggiornamento dell'ordine
                        console.log(`[POINTS API] Fallback al metodo standard di aggiornamento dell'ordine`);
                        
                        try {
                          // Questo approccio mantiene i coupon esistenti e aggiunge il nuovo
                          // Prima otteniamo tutti i coupon esistenti sull'ordine
                          const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://be.dreamshop18.com/';
                          const domain = wordpressUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
                          const orderDetailsUrl = `https://${domain}/wp-json/wc/v3/orders/${orderId}?consumer_key=${process.env.WC_CONSUMER_KEY}&consumer_secret=${process.env.WC_CONSUMER_SECRET}`;
                          const orderResponse = await fetch(orderDetailsUrl);
                          const orderData = await orderResponse.json() as WooOrder;
                          
                          // Estraiamo i codici coupon esistenti
                          const existingCoupons = orderData.coupon_lines || [];
                          const existingCouponCodes = existingCoupons.map((coupon: CouponLine) => ({ code: coupon.code }));
                          
                          console.log(`[POINTS API] Coupon esistenti sull'ordine: ${JSON.stringify(existingCouponCodes)}`);
                          
                          // Ora aggiungiamo il nuovo coupon punti alla lista
                          const updatedCouponCodes = [
                            ...existingCouponCodes,
                            { code: couponCode }
                          ];
                          
                          const updateOrderResponse = await fetch(applyUrl, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              coupon_lines: updatedCouponCodes
                            })
                          });
                        
                          if (updateOrderResponse.ok) {
                            await updateOrderResponse.json();
                            console.log(`[POINTS API] Coupon ${couponCode} applicato con successo all'ordine ${orderId}`);
                            couponApplied = true;
                          } else {
                            const errorText = await updateOrderResponse.text();
                            console.error(`[POINTS API] Errore nell'applicazione del coupon all'ordine:`, errorText);
                          }
                        } catch (fallbackError) {
                          console.error(`[POINTS API] Errore nel metodo fallback:`, fallbackError);
                        }
                      }
                    } catch (applyCouponError) {
                      console.error(`[POINTS API] Errore nell'applicazione del coupon via endpoint specializzato:`, applyCouponError);
                    }
                  }
                } else {
                  const errorText = await getOrderResponse.text();
                  console.error(`[POINTS API] Errore nel recupero dell'ordine:`, errorText);
                }
              } catch (apiError) {
                console.error(`[POINTS API] Errore generale nella chiamata all'API WooCommerce:`, apiError);
              }
            }
          } catch (couponError) {
            console.error(`[POINTS API] Errore nell'applicazione del coupon:`, couponError);
          }
        }
        
        return NextResponse.json({
          success: true,
          message: couponApplied 
            ? `Punti decurtati con successo e coupon ${couponCode} applicato all'ordine` 
            : `Punti decurtati con successo. Usa il coupon ${couponCode} per completare l'ordine`,
          points: responseData.points || responseData.new_balance,
          user_id: userId,
          order_id: orderId,
          points_redeemed: requestData.points,
          coupon: {
            code: couponCode,
            discount_amount: discountAmount,
            expiry_date: couponData.expiry_date || '',
            applied: couponApplied
          }
        });
      } else {
        // Risposta di errore
        let errorMessage = 'Errore sconosciuto';
        try {
          const errorResponse = await secureEndpointResponse.json();
          errorMessage = errorResponse.message || JSON.stringify(errorResponse);
          console.error(`[POINTS API] Errore dall'endpoint secure-redeem:`, errorMessage);
        } catch {
          // Se non riusciamo a parsificare la risposta come JSON, prova con il testo
          try {
            const errorText = await secureEndpointResponse.text();
            errorMessage = errorText || `Errore HTTP ${responseStatus}`;
            console.error(`[POINTS API] Errore dall'endpoint secure-redeem (testo):`, errorText);
          } catch (textError) {
            console.error(`[POINTS API] Impossibile leggere la risposta di errore:`, textError);
          }
        }
        
        return NextResponse.json({
          error: 'Errore nella decurtazione dei punti',
          success: false,
          message: errorMessage,
          status: responseStatus
        }, { status: responseStatus || 500 });
      }
    } catch (error) {
      // Errore di rete o altro errore non gestito
      console.error('[POINTS API] Errore durante la chiamata all\'endpoint secure-redeem:', error);
      
      return NextResponse.json({
        error: 'Errore di connessione',
        success: false,
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      }, { status: 500 });
    }
  } catch (error: unknown) {
    // Log dettagliato dell'errore generale
    const err = error as Error;
    console.error('[POINTS API] Errore durante la decurtazione dei punti:', err.message);
    console.error('[POINTS API] Stack trace:', err.stack);
    
    return NextResponse.json({ 
      error: 'Errore interno del server', 
      success: false,
      message: err.message 
    }, { status: 500 });
  }
}
