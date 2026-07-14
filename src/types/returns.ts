/**
 * Recesso (art. 54-bis Cod. Consumo) e reso.
 *
 * Attenzione alla distinzione, perché guida tutta la UI:
 * - il RECESSO è efficace dal momento della trasmissione e non è soggetto ad approvazione;
 * - il RESO FISICO è ciò che lo staff autorizza o rifiuta.
 * Non presentare mai al cliente il recesso come "in attesa di approvazione".
 */

export type ReturnStatus =
  | 'declared'    // recesso registrato: già valido
  | 'authorized'  // reso fisico autorizzato, istruzioni inviate
  | 'rejected'    // reso fisico non autorizzato (non annulla il recesso)
  | 'shipped'
  | 'received'
  | 'refunded'
  | 'closed';

export interface EligibleItem {
  line_item_id: number;
  product_id: number;
  name: string;
  quantity_ordered: number;
  quantity_withdrawn: number;
  quantity_available: number;
  total: number;
  image: string | null;
  eligible: boolean;
  exclusion_reason: string;
}

export interface OrderEligibility {
  order_id: number;
  order_number: string;
  order_status: string;
  eligible: boolean;
  reason: string;
  deadline: string | null;
  days_left: number | null;
  items: EligibleItem[];
}

export interface WithdrawalItem {
  line_item_id: number;
  product_id: number;
  name: string;
  quantity: number;
  total: number;
}

export interface TimelineEntry {
  id: string;
  from_status: string;
  to_status: string;
  actor: string;
  note: string;
  created_at: string;
}

export interface Withdrawal {
  id: number;
  reference: string;
  order_id: number;
  status: ReturnStatus;
  status_label: string;
  items: WithdrawalItem[];
  declared_at: string;
  declaration_text: string;
  receipt_sent: boolean;
  return_instructions: string | null;
  rejection_reason: string | null;
  refund_amount: number | null;
  refunded_at: string | null;
  timeline?: TimelineEntry[];
}

export interface WithdrawalRequestItem {
  line_item_id: number;
  quantity: number;
}

export const RETURN_REASONS = [
  { value: '', label: 'Preferisco non specificarlo' },
  { value: 'ripensamento', label: 'Ho cambiato idea' },
  { value: 'non_conforme', label: 'Il prodotto non corrisponde alla descrizione' },
  { value: 'danneggiato', label: 'Il prodotto è arrivato danneggiato o difettoso' },
  { value: 'errato', label: 'Ho ricevuto un prodotto diverso da quello ordinato' },
  { value: 'altro', label: 'Altro' },
] as const;
