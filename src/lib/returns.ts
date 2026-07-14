import type { OrderEligibility, Withdrawal, WithdrawalRequestItem } from '@/types/returns';

/**
 * Client browser per le route /api/returns. Il token è lo stesso JWT già usato
 * dal resto dell'area account (localStorage 'woocommerce_token').
 */

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('woocommerce_token') : null;

  if (!token) {
    throw new Error('Devi effettuare l\'accesso per gestire i resi.');
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function unwrap<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Si è verificato un errore. Riprova.');
  }

  return data as T;
}

export async function fetchOrderEligibility(orderId: number | string): Promise<OrderEligibility> {
  const response = await fetch(`/api/returns/eligibility?orderId=${orderId}`, {
    headers: authHeaders(),
  });
  return unwrap<OrderEligibility>(response);
}

export async function fetchWithdrawals(): Promise<Withdrawal[]> {
  const response = await fetch('/api/returns', { headers: authHeaders() });
  const data = await unwrap<{ withdrawals: Withdrawal[] }>(response);
  return data.withdrawals;
}

export async function fetchWithdrawal(id: number | string): Promise<Withdrawal> {
  const response = await fetch(`/api/returns/detail?id=${id}`, { headers: authHeaders() });
  return unwrap<Withdrawal>(response);
}

/**
 * Trasmette la dichiarazione di recesso. Va chiamata SOLO dopo la conferma esplicita
 * dell'utente: dal momento della trasmissione il recesso è esercitato.
 */
export async function submitWithdrawal(params: {
  orderId: number | string;
  items: WithdrawalRequestItem[];
  reason?: string;
  reasonNote?: string;
}): Promise<Withdrawal> {
  const response = await fetch('/api/returns', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(params),
  });

  const data = await unwrap<{ success: boolean; withdrawal: Withdrawal }>(response);
  return data.withdrawal;
}

export function formatDateTime(value: string): string {
  // Le date arrivano da MySQL in UTC ("YYYY-MM-DD HH:MM:SS", senza timezone).
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;

  return new Date(normalized).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
