'use client';

import React, { useState, useEffect } from 'react';
import { PayPalButtons, PayPalMessages } from '@paypal/react-paypal-js';
import { Product, getShippingMethods, ShippingAddress, ShippingMethod } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface PayPalExpressButtonProps {
  product: Product;
  quantity: number;
  enableDeposit?: 'yes' | 'no';
  variationId?: number;
  variationAttributes?: Array<{
    id: number;
    name: string;
    option: string;
  }>;
}

export default function PayPalExpressButton({
  product,
  quantity,
  enableDeposit = 'no',
  variationId,
  variationAttributes
}: PayPalExpressButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<ShippingMethod | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  // Verifica se il prodotto è valido per l'acquisto
  const hasValidPrice = product.price && parseFloat(product.price) > 0;
  const isInStock = product.stock_status === 'instock' && hasValidPrice;

  // Stato per le opzioni di acconto
  const [depositOptions, setDepositOptions] = useState<{
    depositAmount: string;
    depositType: string;
    paymentPlanId?: string;
  } | null>(null);

  // Effetto per recuperare le opzioni di acconto se enableDeposit è 'yes'
  useEffect(() => {
    const fetchDepositOptions = async () => {
      if (enableDeposit !== 'yes') {
        setDepositOptions(null);
        return;
      }

      try {
        // Passa il prezzo del prodotto/variazione per calcolare correttamente l'acconto
        const depositOptionsUrl = product.price
          ? `/api/products/${product.id}/deposit-options?price=${product.price}`
          : `/api/products/${product.id}/deposit-options`;
        const response = await fetch(depositOptionsUrl);
        if (response.ok) {
          const options = await response.json();

          if (options.success && options.deposit_enabled) {
            // Recupera anche il payment plan ID se presente
            const paymentPlanId = options.payment_plan?.id?.toString() ||
                                  (options.is_pianoprova ? '810' : undefined);

            setDepositOptions({
              depositAmount: options.deposit_amount?.toString() || '40',
              depositType: options.deposit_type || 'percent',
              paymentPlanId: paymentPlanId
            });
          } else {
            // Se l'acconto non è abilitato, usa null
            setDepositOptions(null);
          }
        }
      } catch (error) {
        console.error('Errore nel recupero delle opzioni di acconto:', error);
        // Fallback ai valori predefiniti
        setDepositOptions({
          depositAmount: '40',
          depositType: 'percent'
        });
      }
    };

    fetchDepositOptions();
  }, [product.id, product.price, enableDeposit]);

  // Effetto per calcolare i metodi di spedizione quando il componente viene montato
  useEffect(() => {
    const calculateDefaultShipping = async () => {
      try {
        // Utilizziamo un indirizzo di default per l'Italia per il calcolo iniziale
        const defaultAddress: ShippingAddress = {
          first_name: '',
          last_name: '',
          address_1: 'Via Roma 1',
          city: 'Roma',
          state: 'RM',
          postcode: '00100',
          country: 'IT'
        };

        const unitPrice = parseFloat(product.sale_price || product.price || '0');
        const cartTotal = unitPrice * quantity;

        // Prepara gli item del carrello per il calcolo spedizione
        const cartItems = [{
          product_id: product.id,
          quantity: quantity,
          variation_id: variationId || 0,
          shipping_class_id: product.shipping_class_id || 0
        }];

        const availableMethods = await getShippingMethods(defaultAddress, cartTotal, cartItems);

        // Seleziona automaticamente il primo metodo disponibile
        if (availableMethods.length > 0) {
          setSelectedShippingMethod(availableMethods[0]);
        }
      } catch (error) {
        console.error('Errore nel calcolo della spedizione di default:', error);
        // Fallback con metodo standard
        const fallbackMethod: ShippingMethod = {
          id: 'flat_rate',
          title: 'Spedizione standard',
          description: 'Consegna in 3-5 giorni lavorativi',
          cost: 7.00
        };
        setSelectedShippingMethod(fallbackMethod);
      }
    };

    calculateDefaultShipping();
  }, [product.id, product.price, product.sale_price, product.shipping_class_id, quantity, variationId]);

  if (!isInStock) {
    return null;
  }

  // Calcola il totale con commissione PayPal del 3.5% + €0.35 e spedizione
  const calculatePayPalTotal = () => {
    const unitPrice = parseFloat(product.sale_price || product.price || '0');
    let subtotal = unitPrice * quantity;

    // Se l'acconto è abilitato, calcola l'importo dell'acconto
    if (enableDeposit === 'yes' && depositOptions) {
      const depositAmount = parseFloat(depositOptions.depositAmount);
      if (depositOptions.depositType === 'percent') {
        // Calcola la percentuale dell'acconto
        subtotal = subtotal * (depositAmount / 100);
      } else {
        // Acconto fisso
        subtotal = depositAmount * quantity;
      }
    }

    const shippingCost = selectedShippingMethod?.cost || 0;
    const subtotalWithShipping = subtotal + shippingCost;
    const paypalFee = (subtotalWithShipping * 0.035) + 0.35; // 3.5% di commissione + €0.35 fisso su subtotale + spedizione
    const totalWithFeeAndShipping = subtotalWithShipping + paypalFee;

    return {
      subtotal: subtotal.toFixed(2),
      shipping: shippingCost.toFixed(2),
      subtotalWithShipping: subtotalWithShipping.toFixed(2),
      fee: paypalFee.toFixed(2),
      total: totalWithFeeAndShipping.toFixed(2)
    };
  };

  const { total } = calculatePayPalTotal();

  // Crea l'ordine PayPal diretto
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createPayPalOrder = async (_data: any, actions: any) => {
    try {
      setIsProcessing(true);
      setError(null);

      // Usa il totale con commissione PayPal
      const totalAmount = total;

      // Crea ordine PayPal - senza breakdown perché useremo onShippingChange
      // Crea una descrizione dettagliata
      const productDescription = variationAttributes && variationAttributes.length > 0
        ? `${product.name} (${variationAttributes.map(attr => attr.option).join(', ')}) x${quantity}`
        : `${product.name} x${quantity}`;

      const depositInfo = enableDeposit === 'yes' ? ' - Acconto' : '';
      const orderDescription = `DreamShop - ${productDescription}${depositInfo}`;

      return actions.order.create({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'EUR',
              value: totalAmount
            },
            description: orderDescription,
            custom_id: `product_${product.id}_variation_${variationId || 0}_qty_${quantity}_deposit_${enableDeposit}_paypal_fee`
          },
        ],
        application_context: {
          shipping_preference: 'GET_FROM_FILE',
        },
      });
    } catch (error) {
      console.error('Errore nella creazione dell\'ordine PayPal:', error);
      setError('Errore durante la creazione dell\'ordine');
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Gestisce l'approvazione del pagamento PayPal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onApprove = async (data: any, actions: any) => {
    try {
      setIsProcessing(true);

      // Cattura il pagamento PayPal
      const orderDetails = await actions.order.capture();

      // Estrai il Transaction ID dalla cattura (come nel checkout normale)
      const transactionId = orderDetails.purchase_units?.[0]?.payments?.captures?.[0]?.id || data.orderID;

      // Estrai i dati dell'acquirente da PayPal
      const payer = orderDetails.payer;
      const shipping = orderDetails.purchase_units[0]?.shipping;

      // Estrai il numero di telefono da PayPal
      // Come implementato nel plugin WooCommerce ufficiale PayPal Payments:
      // Il telefono è in payer.phone.phone_number.national_number
      const phone = payer?.phone?.phone_number?.national_number || '';

      // Log per debug
      console.log('📞 [PayPal Express] Dati payer.phone:', payer?.phone);
      console.log('📞 [PayPal Express] Telefono estratto:', phone);
      if (!phone) {
        console.warn('⚠️ [PayPal Express] Nessun numero di telefono ricevuto da PayPal. Verifica che "Require Phone Number" sia abilitato nelle impostazioni del merchant account PayPal.');
      }

      // Ricalcola il metodo di spedizione finale in base all'indirizzo PayPal
      const finalShippingAddress: ShippingAddress = {
        first_name: payer?.name?.given_name || '',
        last_name: payer?.name?.surname || '',
        address_1: shipping?.address?.address_line_1 || '',
        city: shipping?.address?.admin_area_2 || '',
        state: shipping?.address?.admin_area_1 || '',
        postcode: shipping?.address?.postal_code || '',
        country: shipping?.address?.country_code || 'IT'
      };

      const unitPrice = parseFloat(product.sale_price || product.price || '0');
      const cartTotal = unitPrice * quantity;
      const cartItems = [{
        product_id: product.id,
        quantity: quantity,
        variation_id: variationId || 0,
        shipping_class_id: product.shipping_class_id || 0
      }];

      const finalMethods = await getShippingMethods(finalShippingAddress, cartTotal, cartItems);
      const finalShippingMethod = finalMethods.length > 0 ? finalMethods[0] : selectedShippingMethod;

      // Ora crea l'ordine in WooCommerce con i dati reali
      const response = await fetch('/api/paypal/product-express-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paypalOrderId: data.orderID,
          paypalTransactionId: transactionId,
          paypalOrderDetails: orderDetails,
          productId: product.id,
          quantity: quantity,
          userId: user?.id || 0,
          enableDeposit: enableDeposit,
          depositAmount: depositOptions?.depositAmount,
          depositType: depositOptions?.depositType,
          paymentPlanId: depositOptions?.paymentPlanId,
          variationId: variationId,
          variationAttributes: variationAttributes,
          shippingMethod: finalShippingMethod,
          billingData: {
            first_name: payer?.name?.given_name || '',
            last_name: payer?.name?.surname || '',
            email: payer?.email_address || '',
            phone: phone,
            address_1: shipping?.address?.address_line_1 || '',
            address_2: shipping?.address?.address_line_2 || '',
            city: shipping?.address?.admin_area_2 || '',
            state: shipping?.address?.admin_area_1 || '',
            postcode: shipping?.address?.postal_code || '',
            country: shipping?.address?.country_code || 'IT'
          }
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        router.push(`/checkout/success?order_id=${result.order_id}`);
      } else {
        throw new Error(result.error || 'Errore durante la creazione dell\'ordine');
      }
    } catch (error) {
      console.error('Errore durante l\'approvazione del pagamento:', error);
      setError('Errore durante il completamento del pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onError = (err: any) => {
    console.warn('PayPal Error (handled):', err);
    setError('Errore durante il processo di pagamento PayPal');
    setIsProcessing(false);
  };

  const onCancel = () => {
    setIsProcessing(false);
  };

  // Gestisce il cambio di indirizzo di spedizione in PayPal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onShippingChange = async (data: any, actions: any) => {
    try {
      // Estrai l'indirizzo di spedizione da PayPal
      const paypalAddress = data.shipping_address;
      const shippingAddress: ShippingAddress = {
        first_name: '',
        last_name: '',
        address_1: paypalAddress.line1 || '',
        city: paypalAddress.city || '',
        state: paypalAddress.state || '',
        postcode: paypalAddress.postal_code || '',
        country: paypalAddress.country_code || 'IT'
      };

      // Calcola i metodi di spedizione per il nuovo indirizzo
      const unitPrice = parseFloat(product.sale_price || product.price || '0');
      const cartTotal = unitPrice * quantity;
      const cartItems = [{
        product_id: product.id,
        quantity: quantity,
        variation_id: variationId || 0,
        shipping_class_id: product.shipping_class_id || 0
      }];

      const methods = await getShippingMethods(shippingAddress, cartTotal, cartItems);

      if (methods.length > 0) {
        const newShippingMethod = methods[0];
        const shippingCost = newShippingMethod.cost || 0;

        // Ricalcola il totale con la nuova spedizione
        let subtotal = unitPrice * quantity;

        // Se l'acconto è abilitato, calcola l'importo dell'acconto
        if (enableDeposit === 'yes' && depositOptions) {
          const depositAmount = parseFloat(depositOptions.depositAmount);
          if (depositOptions.depositType === 'percent') {
            subtotal = subtotal * (depositAmount / 100);
          } else {
            subtotal = depositAmount * quantity;
          }
        }

        const subtotalWithShipping = subtotal + shippingCost;
        const paypalFee = (subtotalWithShipping * 0.035) + 0.35;
        const totalWithFeeAndShipping = subtotalWithShipping + paypalFee;

        // Aggiorna l'ordine PayPal con il nuovo totale (solo il valore, senza breakdown)
        return actions.order.patch([
          {
            op: 'replace',
            path: "/purchase_units/@reference_id=='default'/amount",
            value: {
              currency_code: 'EUR',
              value: totalWithFeeAndShipping.toFixed(2)
            }
          }
        ]);
      }

      // Se non ci sono metodi disponibili, rifiuta
      return actions.reject();
    } catch (error) {
      console.error('Errore durante l\'aggiornamento della spedizione:', error);
      return actions.reject();
    }
  };

  return (
    <div className="mb-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        
        {/* PayPal Standard */}
        <div className="mb-3">
          <PayPalButtons
            style={{
              layout: 'horizontal',
              color: 'gold',
              shape: 'rect',
              label: 'pay',
              height: 45
            }}
            createOrder={createPayPalOrder}
            onApprove={onApprove}
            onShippingChange={onShippingChange}
            onError={onError}
            onCancel={onCancel}
            disabled={isProcessing}
          />
        </div>

        {/* Banner PayPal Pay Later */}
        <div className="mb-3">
          <PayPalMessages
            amount={parseFloat(total)}
            placement="product"
            style={{
              layout: 'text',
              logo: {
                type: 'inline'
              }
            }}
          />
        </div>

        {/* PayPal Pay Later Button - Forces Pay in 3 */}
        <div className="mb-3">
          <PayPalButtons
            fundingSource="paylater"
            style={{
              layout: 'horizontal',
              color: 'blue',
              shape: 'rect',
              label: 'installment',
              height: 45
            }}
            createOrder={createPayPalOrder}
            onApprove={onApprove}
            onShippingChange={onShippingChange}
            onError={onError}
            onCancel={onCancel}
            disabled={isProcessing}
          />
        </div>
        
        {isProcessing && (
          <div className="mt-3 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-bred-500"></div>
            <span className="ml-2 text-sm text-gray-600">Elaborazione...</span>
          </div>
        )}
      </div>
  );
}