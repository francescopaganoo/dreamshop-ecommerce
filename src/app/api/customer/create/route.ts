import { NextRequest, NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';

interface WooCommerceCustomer {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { email, password, first_name, last_name, billing, shipping } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e password sono richiesti' },
        { status: 400 }
      );
    }

    // Prepara i dati del customer per WooCommerce
    const customerData = {
      email,
      first_name: first_name || '',
      last_name: last_name || '',
      username: email, // Usa l'email come username
      password,
      billing: billing || undefined,
      shipping: shipping || undefined
    };

    console.log('[CREATE CUSTOMER] Creazione customer con email:', email);

    // Crea il customer tramite WooCommerce API
    const response = await api.post('customers', customerData);

    if (!response.data) {
      throw new Error('Errore nella creazione del customer');
    }

    const customer = response.data as WooCommerceCustomer;

    console.log('[CREATE CUSTOMER] Customer creato con successo, ID:', customer.id);

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        username: customer.username
      }
    });

  } catch (error: unknown) {
    console.error('[CREATE CUSTOMER] Errore:', error);

    // Gestisci errori specifici di WooCommerce
    interface WooCommerceError {
      response?: {
        data?: {
          message?: string;
          code?: string;
        };
      };
    }

    if (error && typeof error === 'object' && (error as WooCommerceError).response?.data) {
      const wooError = error as WooCommerceError;
      const errorMessage = wooError.response?.data?.message || 'Errore nella creazione del customer';
      const errorCode = wooError.response?.data?.code;

      // Se l'email esiste già, restituisci un errore specifico
      if (errorCode === 'registration-error-email-exists') {
        return NextResponse.json(
          { error: 'Un account con questa email esiste già. Effettua il login.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Errore durante la creazione dell\'account' },
      { status: 500 }
    );
  }
}
