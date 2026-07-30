/**
 * Shared types + small pure helpers for the public-invoice surface.
 *
 * The data shape is the JSONB payload returned by the
 * `get_public_invoice(token)` SECURITY DEFINER RPC. RLS is bypassed
 * intentionally — the RPC's own filtering on the token is the
 * security boundary. We model the shape as `PublicBranding` (from
 * `lib/branding/public-surface`) plus the invoice-specific fields
 * so the same object feeds both the branding layer and the
 * Zebri-rendered chrome below.
 *
 * @module app/invoice/[token]/_components/public-invoice
 */
import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import type { PublicBranding } from '@/lib/branding/public-surface';
import { isPastDue } from '@/lib/utils';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  position: number;
}

/** One payment stage on a public invoice, as returned by `get_public_invoice`. */
export interface PublicInvoiceStage {
  id: string;
  position: number;
  label: string;
  amount_cents: number;
  due_date: string | null;
  paid_at: string | null;
}

export interface PublicInvoice extends PublicBranding {
  id: string;
  invoice_number: string;
  title: string;
  status: string;
  subtotal: number;
  tax_rate: number;
  due_date: string | null;
  notes: string | null;
  paid_at: string | null;
  couple_name: string;
  event_date: string | null;
  venue: string | null;
  bank_account_name: string | null;
  bank_bsb: string | null;
  bank_account_number: string | null;
  items: InvoiceItem[];
  stages: PublicInvoiceStage[];
  stripe_payment_enabled: boolean;
  stripe_connect_enabled: boolean;
  share_token: string;
  branding_blocks: Block[] | null;
}

/**
 * State machine for the page render. Driven by the RPC response +
 * the invoice's `status` field + the current date relative to
 * `due_date`. Computed once in the orchestrator + passed down.
 */
export type PageState =
  | 'loading'
  | 'not_found'
  | 'active'
  | 'overdue'
  | 'paid'
  | 'cancelled';

export function deriveState(invoice: PublicInvoice | null): PageState {
  if (!invoice) return 'not_found';
  if (invoice.status === 'paid') return 'paid';
  if (invoice.status === 'cancelled') return 'cancelled';
  if (isPastDue(invoice.due_date)) {
    return 'overdue';
  }
  return 'active';
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(n);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
