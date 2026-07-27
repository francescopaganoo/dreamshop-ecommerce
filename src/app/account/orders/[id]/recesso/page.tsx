'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../../../../context/AuthContext';
import { fetchOrderEligibility, formatDateTime, submitWithdrawal } from '@/lib/returns';
import { RETURN_REASONS, type OrderEligibility, type Withdrawal } from '@/types/returns';

/**
 * Funzione di recesso ex art. 54-bis Cod. Consumo.
 *
 * La norma impone due passaggi distinti: la compilazione della dichiarazione e un comando
 * separato di conferma. Non unire i due step in un solo click: la conferma deve essere
 * un atto consapevole e riconoscibile.
 */

type Step = 'select' | 'confirm' | 'done';

export default function WithdrawalPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [eligibility, setEligibility] = useState<OrderEligibility | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('select');
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [reason, setReason] = useState('');
  const [reasonNote, setReasonNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Withdrawal | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isAuthLoading, router]);

  useEffect(() => {
    if (!orderId || !isAuthenticated) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchOrderEligibility(orderId);
        if (cancelled) return;

        setEligibility(data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Errore nel caricamento dell\'ordine.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [orderId, isAuthenticated]);

  const selectedItems = useMemo(
    () => (eligibility ? eligibility.items.filter((item) => (quantities[item.line_item_id] ?? 0) > 0) : []),
    [eligibility, quantities]
  );

  const toggleItem = (lineItemId: number, available: number) => {
    setQuantities((prev) => {
      const next = { ...prev };
      if (next[lineItemId]) {
        delete next[lineItemId];
      } else {
        next[lineItemId] = available;
      }
      return next;
    });
  };

  const setQuantity = (lineItemId: number, quantity: number) => {
    setQuantities((prev) => ({ ...prev, [lineItemId]: quantity }));
  };

  const handleConfirm = useCallback(async () => {
    if (!eligibility || selectedItems.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const withdrawal = await submitWithdrawal({
        orderId: eligibility.order_id,
        items: selectedItems.map((item) => ({
          line_item_id: item.line_item_id,
          quantity: quantities[item.line_item_id],
        })),
        reason,
        reasonNote,
      });

      setReceipt(withdrawal);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non è stato possibile trasmettere il recesso.');
      setStep('select');
    } finally {
      setIsSubmitting(false);
    }
  }, [eligibility, selectedItems, quantities, reason, reasonNote]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-600">Caricamento in corso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-6">
          <Link href={`/account/orders/${orderId}`} className="text-bred-500 hover:text-bred-700">
            ← Torna all&apos;ordine
          </Link>
        </div>

        {step !== 'done' && (
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Recedi dal contratto</h1>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg">{error}</div>
        )}

        {/* Ordine non idoneo: spieghiamo il perché, non lasciamo un vicolo cieco. */}
        {eligibility && !eligibility.eligible && step !== 'done' && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <p className="text-gray-700 mb-4">{eligibility.reason}</p>
            <p className="text-sm text-gray-600">
              Se ritieni si tratti di un errore, o se il prodotto è difettoso, contattaci: la{' '}
              <strong>garanzia legale di conformità di 2 anni</strong> resta valida a prescindere dal diritto di recesso.
            </p>
            <Link
              href={`/account/orders/${orderId}`}
              className="inline-block mt-6 px-5 py-2.5 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
            >
              Torna all&apos;ordine
            </Link>
          </div>
        )}

        {/* STEP 1 — selezione degli articoli e compilazione della dichiarazione */}
        {eligibility?.eligible && step === 'select' && (
          <>
            <p className="text-gray-600 mb-6">
              Hai diritto di recedere entro 14 giorni dalla consegna, senza doverne indicare le ragioni.
              {eligibility.days_left !== null && (
                <>
                  {' '}Per l&apos;ordine <strong>#{eligibility.order_number}</strong> ti restano{' '}
                  <strong>{eligibility.days_left} giorni</strong>.
                </>
              )}
            </p>

            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Quali articoli vuoi restituire?
              </h2>

              <div className="space-y-3">
                {eligibility.items.map((item) => {
                  const isSelected = (quantities[item.line_item_id] ?? 0) > 0;
                  const disabled = !item.eligible;

                  return (
                    <div
                      key={item.line_item_id}
                      className={`flex items-start gap-4 p-4 rounded-lg border ${
                        disabled
                          ? 'bg-gray-50 border-gray-200 opacity-70'
                          : isSelected
                          ? 'bg-red-50 border-bred-500'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        id={`item-${item.line_item_id}`}
                        className="mt-1 h-5 w-5"
                        checked={isSelected}
                        disabled={disabled}
                        onChange={() => toggleItem(item.line_item_id, item.quantity_available)}
                      />

                      {item.image && (
                        <Image
                          src={item.image}
                          alt={item.name}
                          width={56}
                          height={56}
                          className="w-14 h-14 object-cover rounded-md flex-shrink-0"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={`item-${item.line_item_id}`}
                          className="font-medium text-gray-900 block cursor-pointer"
                        >
                          {item.name}
                        </label>

                        {disabled ? (
                          <p className="text-sm text-gray-600 mt-1">
                            {item.exclusion_reason ||
                              (item.quantity_available === 0
                                ? 'Hai già esercitato il recesso per questo articolo.'
                                : 'Articolo non restituibile.')}
                          </p>
                        ) : (
                          <div className="mt-2 flex items-center gap-3">
                            <label htmlFor={`qty-${item.line_item_id}`} className="text-sm text-gray-600">
                              Quantità
                            </label>
                            <select
                              id={`qty-${item.line_item_id}`}
                              className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900"
                              value={quantities[item.line_item_id] ?? item.quantity_available}
                              disabled={!isSelected}
                              onChange={(e) => setQuantity(item.line_item_id, Number(e.target.value))}
                            >
                              {Array.from({ length: item.quantity_available }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                            <span className="text-sm text-gray-500">di {item.quantity_ordered}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Motivo del recesso</h2>
              <p className="text-sm text-gray-500 mb-4">
                Facoltativo. Per legge non sei tenuto a motivare il recesso: ci aiuta solo a migliorare.
              </p>

              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {RETURN_REASONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {reason !== '' && (
                <textarea
                  className="mt-3 w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
                  rows={3}
                  placeholder="Vuoi aggiungere qualcosa? (facoltativo)"
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                />
              )}
            </div>

            <button
              type="button"
              disabled={selectedItems.length === 0}
              onClick={() => setStep('confirm')}
              className="w-full px-6 py-3 bg-bred-500 text-white font-semibold rounded-md hover:bg-bred-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Prosegui
            </button>
          </>
        )}

        {/* STEP 2 — conferma separata, richiesta dall'art. 54-bis */}
        {eligibility?.eligible && step === 'confirm' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Conferma la tua dichiarazione</h2>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-gray-800 mb-3">
                Con la presente notifico il recesso dal contratto di vendita dei seguenti beni,
                relativi all&apos;ordine <strong>#{eligibility.order_number}</strong>:
              </p>
              <ul className="list-disc pl-5 text-gray-800 space-y-1">
                {selectedItems.map((item) => (
                  <li key={item.line_item_id}>
                    {item.name} — quantità: {quantities[item.line_item_id]}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 mb-6 text-sm text-gray-700 space-y-2">
              <p>
                Alla conferma riceverai via email una <strong>ricevuta con data e ora</strong> della dichiarazione:
                da quel momento il <strong>recesso è validamente esercitato</strong> e resta valido a prescindere.
              </p>
              <p>
                Verificheremo quindi la tua richiesta e ti comuniceremo l&apos;<strong>autorizzazione al reso</strong> con
                le istruzioni per la spedizione. Se uno o più articoli non rientrano tra quelli restituibili, te ne
                indicheremo il motivo.
              </p>
              <p>
                Dovrai restituire i beni <strong>entro 14 giorni</strong> dalla dichiarazione. <strong>I costi diretti
                di restituzione sono a tuo carico.</strong>
              </p>
              <p>
                Il rimborso avverrà entro 14 giorni; possiamo sospenderlo finché non riceviamo i beni o la prova
                della loro spedizione.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setStep('select')}
                disabled={isSubmitting}
                className="px-6 py-3 bg-gray-100 text-gray-800 font-medium rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Torna indietro
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-bred-500 text-white font-semibold rounded-md hover:bg-bred-700 disabled:bg-gray-300"
              >
                {isSubmitting ? 'Trasmissione in corso...' : 'Conferma recesso'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — esito, con la ricevuta a schermo */}
        {step === 'done' && receipt && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Recesso trasmesso</h1>
            </div>

            <p className="text-gray-700 mb-6">
              Il tuo recesso è <strong>validamente esercitato</strong>. Riceverai all&apos;indirizzo email associato
              all&apos;ordine la conferma di ricevimento con il testo della dichiarazione, la data e l&apos;ora.
              Dopo la nostra <strong>verifica del reso</strong> ti invieremo l&apos;autorizzazione e le istruzioni per la
              spedizione, oppure il motivo dell&apos;eventuale mancata autorizzazione.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1">Riferimento pratica</p>
              <p className="font-mono font-semibold text-gray-900 mb-3">{receipt.reference}</p>

              <p className="text-sm text-gray-600 mb-1">Data e ora di trasmissione</p>
              <p className="font-semibold text-gray-900 mb-3">{formatDateTime(receipt.declared_at)}</p>

              <p className="text-sm text-gray-600 mb-1">Dichiarazione</p>
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">{receipt.declaration_text}</pre>
            </div>

            <p className="text-gray-700 mb-6">
              Ti invieremo a breve le istruzioni per restituire i beni. Puoi seguire l&apos;avanzamento della pratica
              nella sezione resi del tuo account.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/account?tab=returns"
                className="px-6 py-3 bg-bred-500 text-white font-semibold rounded-md hover:bg-bred-700 text-center"
              >
                Vai ai miei resi
              </Link>
              <Link
                href={`/account/orders/${orderId}`}
                className="px-6 py-3 bg-gray-100 text-gray-800 font-medium rounded-md hover:bg-gray-200 text-center"
              >
                Torna all&apos;ordine
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
