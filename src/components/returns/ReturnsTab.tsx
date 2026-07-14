'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithdrawals, formatDateTime } from '@/lib/returns';
import type { ReturnStatus, Withdrawal } from '@/types/returns';

/**
 * Elenco dei recessi/resi del cliente.
 *
 * Lo stato mostrato è quello del RESO FISICO. Il recesso in sé non ha stati intermedi:
 * è valido dal momento della trasmissione, e il testo lo dice esplicitamente.
 */

const STATUS_STYLES: Record<ReturnStatus, string> = {
  declared: 'bg-blue-100 text-blue-800',
  authorized: 'bg-indigo-100 text-indigo-800',
  rejected: 'bg-red-100 text-red-800',
  shipped: 'bg-amber-100 text-amber-800',
  received: 'bg-purple-100 text-purple-800',
  refunded: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

const STATUS_HINTS: Record<ReturnStatus, string> = {
  declared: 'Recesso registrato. Ti invieremo a breve le istruzioni per restituire i beni.',
  authorized: 'Reso autorizzato: trovi le istruzioni di spedizione qui sotto e nella tua email.',
  rejected: 'Non abbiamo potuto autorizzare la restituzione dei beni.',
  shipped: 'Stiamo aspettando che la merce arrivi al nostro magazzino.',
  received: 'Abbiamo ricevuto la merce. Procediamo con la verifica e il rimborso.',
  refunded: 'Rimborso emesso.',
  closed: 'Pratica chiusa.',
};

export default function ReturnsTab() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchWithdrawals()
      .then((data) => {
        if (!cancelled) setWithdrawals(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Errore nel caricamento dei resi.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2 text-gray-600">Resi e recessi</h2>
      <p className="text-gray-600 mb-6">
        Per avviare un reso apri l&apos;ordine che ti interessa dalla sezione{' '}
        <Link href="/account?tab=orders" className="text-bred-500 hover:text-bred-700">
          I miei ordini
        </Link>{' '}
        e usa il pulsante &laquo;Recedi qui dal contratto&raquo;.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg">{error}</div>
      )}

      {isLoading ? (
        <p className="text-gray-600">Caricamento in corso...</p>
      ) : withdrawals.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">Non hai ancora effettuato nessun reso.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {withdrawals.map((withdrawal) => (
            <div key={withdrawal.id} className="border border-gray-200 rounded-lg p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{withdrawal.reference}</p>
                  <p className="text-sm text-gray-600">
                    Ordine{' '}
                    <Link
                      href={`/account/orders/${withdrawal.order_id}`}
                      className="text-bred-500 hover:text-bred-700"
                    >
                      #{withdrawal.order_id}
                    </Link>{' '}
                    · Recesso trasmesso il {formatDateTime(withdrawal.declared_at)}
                  </p>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[withdrawal.status]}`}>
                  {withdrawal.status_label}
                </span>
              </div>

              <p className="text-sm text-gray-700 mb-3">{STATUS_HINTS[withdrawal.status]}</p>

              <ul className="text-sm text-gray-600 mb-3 space-y-1">
                {withdrawal.items.map((item) => (
                  <li key={item.line_item_id}>
                    {item.name} — quantità: {item.quantity}
                  </li>
                ))}
              </ul>

              {withdrawal.return_instructions && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-md p-4 mb-3">
                  <p className="text-sm font-medium text-indigo-900 mb-1">Istruzioni per la restituzione</p>
                  <pre className="whitespace-pre-wrap text-sm text-indigo-900 font-sans">
                    {withdrawal.return_instructions}
                  </pre>
                </div>
              )}

              {withdrawal.rejection_reason && (
                <div className="bg-red-50 border border-red-100 rounded-md p-4 mb-3">
                  <p className="text-sm font-medium text-red-900 mb-1">Motivo</p>
                  <p className="text-sm text-red-900">{withdrawal.rejection_reason}</p>
                </div>
              )}

              {withdrawal.refund_amount !== null && withdrawal.refunded_at && (
                <p className="text-sm text-green-800">
                  Rimborso di <strong>€{withdrawal.refund_amount.toFixed(2)}</strong> emesso il{' '}
                  {formatDateTime(withdrawal.refunded_at)}.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
