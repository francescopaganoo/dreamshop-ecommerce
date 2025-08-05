import { NextRequest, NextResponse } from 'next/server';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';

// Inizializza l'API di WooCommerce
const api = new WooCommerceRestApi({
  url: process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://be2.dreamshop18.com/',
  consumerKey: process.env.WC_CONSUMER_KEY || 'ck_56956244a9dd0650ae126115f5e5c5a100af6a99',
  consumerSecret: process.env.WC_CONSUMER_SECRET || 'cs_ec3a6b069694465a1a769795892bf8b5d67b1773',
  version: 'wc/v3'
});

export async function POST(request: NextRequest) {
  try {
    // Estrai l'ID dell'ordine dalla richiesta
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'ID ordine mancante' }, { status: 400 });
    }

    // Aggiorna lo stato dell'ordine a "cancelled"
    await api.put(`orders/${orderId}`, {
      status: 'cancelled'
    });

    // Restituisci una risposta di successo
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Errore durante la cancellazione dell\'ordine:', error);
    
    // Restituisci una risposta di errore
    return NextResponse.json(
      { success: false, error: 'Errore durante la cancellazione dell\'ordine' },
      { status: 500 }
    );
  }
}
