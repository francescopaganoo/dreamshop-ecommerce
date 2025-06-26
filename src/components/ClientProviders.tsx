'use client';

import { ReactNode } from 'react';
import { CartProvider } from '../context/CartContext';
import { AuthProvider } from '../context/AuthContext';
import { WishlistProvider } from '../context/WishlistContext';
import { Elements } from '@stripe/react-stripe-js';
import { getStripe } from '../lib/stripe';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { paypalOptions } from '../lib/paypal';

interface ClientProvidersProps {
  children: ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <PayPalScriptProvider options={paypalOptions}>
      <Elements stripe={getStripe()}>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              {children}
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </Elements>
    </PayPalScriptProvider>
  );
}
