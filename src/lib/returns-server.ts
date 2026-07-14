import 'server-only';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

/**
 * Confine di fiducia fra Next e il plugin WP `wc-returns-manager`.
 *
 * Next verifica il JWT dell'utente e solo dopo dichiara l'user_id a WordPress,
 * autenticandosi con RETURNS_API_KEY. La chiave NON deve avere il prefisso NEXT_PUBLIC_:
 * finirebbe nel bundle del browser e chiunque potrebbe aprire recessi su ordini altrui.
 * (È esattamente il problema che affligge già NEXT_PUBLIC_WC_CONSUMER_KEY/SECRET.)
 */

const WP_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL;
const RETURNS_API_KEY = process.env.RETURNS_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

export class ReturnsApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ReturnsApiError';
  }
}

/**
 * Estrae e verifica l'utente dal Bearer token. Lancia se il token non è valido.
 */
export function requireUserId(request: NextRequest): number {
  if (!JWT_SECRET) {
    throw new ReturnsApiError('Configurazione del server incompleta.', 500);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ReturnsApiError('Autenticazione richiesta.', 401);
  }

  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as jwt.JwtPayload;
    const userId = Number(decoded?.id);

    if (!userId || Number.isNaN(userId)) {
      throw new ReturnsApiError('Token non valido.', 401);
    }

    return userId;
  } catch (error) {
    if (error instanceof ReturnsApiError) throw error;
    throw new ReturnsApiError('Token non valido o scaduto.', 401);
  }
}

function endpoint(path: string): string {
  if (!WP_URL) {
    throw new ReturnsApiError('Configurazione del server incompleta.', 500);
  }
  const base = WP_URL.endsWith('/') ? WP_URL : `${WP_URL}/`;
  return `${base}wp-json/returns/v1${path}`;
}

interface WpErrorBody {
  message?: string;
  code?: string;
}

export async function callReturnsApi<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; forwardedFor?: string | null } = {}
): Promise<T> {
  if (!RETURNS_API_KEY) {
    console.error('[returns] RETURNS_API_KEY non configurata: il servizio resi è disabilitato.');
    throw new ReturnsApiError('Servizio resi non disponibile.', 503);
  }

  const headers: Record<string, string> = {
    'X-Returns-Api-Key': RETURNS_API_KEY,
    'Content-Type': 'application/json',
  };
  if (init.forwardedFor) {
    headers['X-Forwarded-For'] = init.forwardedFor;
  }

  const response = await fetch(endpoint(path), {
    method: init.method ?? 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });

  const raw = await response.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    console.error('[returns] Risposta non JSON da WordPress:', raw.slice(0, 300));
    throw new ReturnsApiError('Risposta non valida dal server.', 502);
  }

  if (!response.ok) {
    const body = parsed as WpErrorBody | null;
    throw new ReturnsApiError(
      body?.message || 'Errore durante la richiesta.',
      response.status
    );
  }

  return parsed as T;
}

export function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
}
