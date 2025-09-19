'use client';

import React, { useState, useEffect } from 'react';
import { PayPalButtons, PayPalMessages } from '@paypal/react-paypal-js';
import { Product, calculateShipping, ShippingAddress } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface PayPalExpressButtonProps {
  product: Product;
  quantity: number;
  enableDeposit?: 'yes' | 'no';
}

export default function PayPalExpressButton({
  product,
  quantity,
  enableDeposit = 'no'
}: PayPalExpressButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingCost, setShippingCost] = useState<number>(7.00); // Default Italia
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  // Verifica se il prodotto è valido per l'acquisto
  const hasValidPrice = product.price && parseFloat(product.price) > 0;
  const isInStock = product.stock_status === 'instock' && hasValidPrice;

  // Effetto per calcolare la spedizione quando il componente viene montato
  useEffect(() => {
    const calculateDefaultShipping = async () => {
      setIsCalculatingShipping(true);
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

        const calculatedShipping = await calculateShipping(defaultAddress);
        setShippingCost(calculatedShipping);
      } catch (error) {
        console.error('Errore nel calcolo della spedizione di default:', error);
        setShippingCost(7.00); // Fallback per l'Italia
      } finally {
        setIsCalculatingShipping(false);
      }
    };

    calculateDefaultShipping();
  }, [product.id, quantity]);

  if (!isInStock) {
    return null;
  }

  // Calcola il totale con commissione PayPal del 3% e spedizione
  const calculatePayPalTotal = () => {
    const unitPrice = parseFloat(product.sale_price || product.price || '0');
    const subtotal = unitPrice * quantity;
    const subtotalWithShipping = subtotal + shippingCost;
    const paypalFee = subtotalWithShipping * 0.03; // 3% di commissione su subtotale + spedizione
    const totalWithFeeAndShipping = subtotalWithShipping + paypalFee;
    return {
      subtotal: subtotal.toFixed(2),
      shipping: shippingCost.toFixed(2),
      subtotalWithShipping: subtotalWithShipping.toFixed(2),
      fee: paypalFee.toFixed(2),
      total: totalWithFeeAndShipping.toFixed(2)
    };
  };

  const { subtotal, shipping, fee, total } = calculatePayPalTotal();

  // Crea l'ordine PayPal diretto
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createPayPalOrder = async (_data: any, actions: any) => {
    try {
      setIsProcessing(true);
      setError(null);

      // Usa il totale con commissione PayPal
      const totalAmount = total;

      // Crea ordine PayPal usando actions.order.create
      return actions.order.create({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'EUR',
              value: totalAmount,
            },
            description: `${product.name} x${quantity} + Spedizione €${shipping} + Commissione PayPal 3%`,
            custom_id: `product_${product.id}_qty_${quantity}_deposit_${enableDeposit}_paypal_fee_shipping`,
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
      console.log('Dettagli ordine PayPal:', orderDetails);
      
      // Estrai i dati dell'acquirente da PayPal
      const payer = orderDetails.payer;
      const shipping = orderDetails.purchase_units[0]?.shipping;
      
      // Ora crea l'ordine in WooCommerce con i dati reali
      const response = await fetch('/api/paypal/product-express-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paypalOrderId: data.orderID,
          paypalOrderDetails: orderDetails,
          productId: product.id,
          quantity: quantity,
          userId: user?.id || 0,
          enableDeposit: enableDeposit,
          billingData: {
            first_name: payer?.name?.given_name || '',
            last_name: payer?.name?.surname || '',
            email: payer?.email_address || '',
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
    console.log('Pagamento PayPal annullato dall\'utente');
    setIsProcessing(false);
  };

  return (
    <div className="mb-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Messaggio informativo sulla commissione PayPal e spedizione */}
        <div className="mb-3 p-3 bg-bred-50 border border-bred-100 rounded-md">
          <div className="flex items-start text-sm text-bred-700">
            <svg className="w-4 h-4 mr-2 mt-0.5 text-bred-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="font-medium">Pagamento PayPal Express</p>
              <div className="text-xs mt-1 space-y-1">
                <div>Subtotale prodotto: €{subtotal}</div>
                <div className="flex items-center">
                  Spedizione: €{shipping}
                  {isCalculatingShipping && (
                    <div className="ml-2 w-3 h-3 border border-bred-500 border-t-transparent rounded-full animate-spin"></div>
                  )}
                </div>
                <div>Commissione PayPal (3%): €{fee}</div>
                <div className="border-t border-bred-100 pt-1 mt-2">
                  <strong>Totale: €{total}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
        
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