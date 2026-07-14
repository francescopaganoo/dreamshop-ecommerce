'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchOrderEligibility } from '@/lib/returns';
import type { OrderEligibility } from '@/types/returns';

/**
 * Pulsante di recesso ex art. 54-bis.
 *
 * L'etichetta "Recedi qui dal contratto" è quella indicata dalla norma: non sostituirla con
 * formule ambigue ("Assistenza", "Problemi con l'ordine?"). Deve restare chiaramente visibile
 * e facilmente accessibile per tutta la durata del periodo di recesso.
 */
export default function WithdrawalButton({ orderId }: { orderId: number | string }) {
  const [eligibility, setEligibility] = useState<OrderEligibility | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchOrderEligibility(orderId)
      .then((data) => {
        if (!cancelled) setEligibility(data);
      })
      .catch(() => {
        // Un errore qui non deve rompere la pagina ordine: il pulsante semplicemente non compare.
        if (!cancelled) setEligibility(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (isLoading || !eligibility?.eligible) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-2 text-gray-600">Diritto di recesso</h2>

      <p className="text-sm text-gray-600 mb-4">
        Puoi recedere dal contratto entro 14 giorni dalla consegna, senza doverne indicare le ragioni.
        {eligibility.days_left !== null && (
          <>
            {' '}Ti restano <strong>{eligibility.days_left} giorni</strong>.
          </>
        )}
      </p>

      <Link
        href={`/account/orders/${orderId}/recesso`}
        className="block w-full text-center px-5 py-3 bg-bred-500 text-white font-semibold rounded-md hover:bg-bred-700"
      >
        Recedi qui dal contratto
      </Link>
    </div>
  );
}
