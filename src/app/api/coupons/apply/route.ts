import { NextResponse } from 'next/server';
import api from '../../../../lib/woocommerce';

const WP_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL;

interface WcCoupon {
  id: number;
  code: string;
  usage_limit_per_user: number | null;
  used_by?: Array<string | number>;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, items, email, userId } = body;

    if (!code) {
      return NextResponse.json(
        { message: 'Codice coupon mancante' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: 'Carrello vuoto o non valido' },
        { status: 400 }
      );
    }

    // CONTROLLO LIMITE UTILIZZI PER UTENTE
    // WooCommerce non blocca questo caso in fase di validazione carrello, ma rifiuta
    // l'ordine (HTTP 400) al momento della creazione: il cliente verrebbe addebitato
    // dello scontato mentre l'ordine resta in bozza al totale pieno. Lo blocchiamo qui.
    if (userId || email) {
      try {
        const couponResp = await api.get('coupons', { code });
        const wcCoupon = (Array.isArray(couponResp.data) ? couponResp.data[0] : null) as WcCoupon | null;

        if (wcCoupon && wcCoupon.usage_limit_per_user && wcCoupon.usage_limit_per_user > 0) {
          // WooCommerce registra in used_by l'ID utente (se loggato) oppure l'email
          const usedBy = (wcCoupon.used_by || []).map((u) => String(u).toLowerCase());
          const aliases: string[] = [];
          if (userId) aliases.push(String(userId).toLowerCase());
          if (email) aliases.push(String(email).toLowerCase());

          const timesUsed = usedBy.filter((u) => aliases.includes(u)).length;

          if (timesUsed >= wcCoupon.usage_limit_per_user) {
            console.log(`[COUPON] "${code}" bloccato: usato ${timesUsed}/${wcCoupon.usage_limit_per_user} volte da userId=${userId ?? '-'}, email=${email ?? '-'}`);
            return NextResponse.json(
              { message: 'Hai già utilizzato questo coupon: è valido una sola volta per cliente.' },
              { status: 400 }
            );
          }
        }
      } catch (usageErr) {
        // Se il controllo fallisce (es. coupon non trovato qui), non blocchiamo:
        // la validazione completa avviene comunque nell'endpoint WP qui sotto.
        console.error('[COUPON] Controllo limite per-utente non riuscito (procedo con validazione WP):', usageErr);
      }
    }

    // Prepara gli items per l'endpoint WP
    const wpItems = items.map((item: Record<string, unknown>) => ({
      id: item.id,
      quantity: item.quantity || 1,
      price: item.price || item.regular_price || '0',
      sale_price: item.sale_price || '',
      variation_id: item.variation_id || 0,
      categories: item.categories || [],
    }));

    // Chiama il plugin WordPress per la validazione completa
    const wpResponse = await fetch(`${WP_URL}/wp-json/dreamshop/v1/validate-coupon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        items: wpItems,
        email: email || '',
      }),
    });

    const wpData = await wpResponse.json();

    if (!wpResponse.ok || !wpData.valid) {
      return NextResponse.json(
        { message: wpData.message || 'Coupon non valido' },
        { status: wpResponse.status || 400 }
      );
    }

    // Restituisci il risultato al frontend
    return NextResponse.json({
      discount: wpData.discount,
      free_shipping: wpData.free_shipping || false,
      coupon: wpData.coupon,
      items,
    });

  } catch (error: unknown) {
    console.error('Errore nell\'applicazione del coupon:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Errore nell\'applicazione del coupon' },
      { status: 500 }
    );
  }
}
