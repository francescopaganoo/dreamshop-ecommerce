'use client';

import React, { useState } from 'react';
import { PayPalButtons, PayPalMessages } from '@paypal/react-paypal-js';
import { Product } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import PayPalExpressProvider from './PayPalExpressProvider';

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
  const { user } = useAuth();
  const router = useRouter();

  // Verifica se il prodotto è valido per l'acquisto
  const hasValidPrice = product.price && parseFloat(product.price) > 0;
  const isInStock = product.stock_status === 'instock' && hasValidPrice;

  if (!isInStock) {
    return null;
  }

  // Crea l'ordine PayPal diretto
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createPayPalOrder = async (data: any, actions: any) => {
    try {
      setIsProcessing(true);
      setError(null);

      // Calcola il prezzo totale
      const unitPrice = parseFloat(product.sale_price || product.price || '0');
      const totalAmount = (unitPrice * quantity).toFixed(2);

      // Crea ordine PayPal usando actions.order.create
      return actions.order.create({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'EUR',
              value: totalAmount,
            },
            description: `${product.name} x${quantity}`,
            custom_id: `product_${product.id}_qty_${quantity}_deposit_${enableDeposit}`,
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
    console.error('Errore PayPal:', err);
    setError('Errore durante il processo di pagamento PayPal');
    setIsProcessing(false);
  };

  const onCancel = () => {
    console.log('Pagamento PayPal annullato dall\'utente');
    setIsProcessing(false);
  };

  return (
    <PayPalExpressProvider>
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
            onError={onError}
            onCancel={onCancel}
            disabled={isProcessing}
          />
        </div>

        {/* Banner PayPal Pay Later */}
        <div className="mb-3">
          <PayPalMessages
            amount={parseFloat(product.sale_price || product.price || '0') * quantity}
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
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">Elaborazione...</span>
          </div>
        )}
      </div>
    </PayPalExpressProvider>
  );
}