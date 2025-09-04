'use client';

import { ReactNode } from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { paypalExpressOptions } from '@/lib/paypal-express';

interface PayPalExpressProviderProps {
  children: ReactNode;
}

export default function PayPalExpressProvider({ children }: PayPalExpressProviderProps) {
  return (
    <PayPalScriptProvider options={paypalExpressOptions}>
      {children}
    </PayPalScriptProvider>
  );
}