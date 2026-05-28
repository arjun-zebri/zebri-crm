/**
 * Shared types + small pure helpers for the public-quote surface.
 *
 * Mirrors the structure of `app/invoice/[token]/_components/public-invoice.ts`.
 * The shape is the JSONB payload from `get_public_quote(token)`.
 *
 * @module app/quote/[token]/_components/public-quote
 */
import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import type { PublicBranding } from '@/lib/branding/public-surface';

export interface QuoteItem {
  id: string;
  description: string;
  amount: number;
  position: number;
}

export interface PublicQuote extends PublicBranding {
  id: string;
  title: string;
  quote_number: string;
  status: string;
  subtotal: number;
  tax_rate: number | null;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  notes: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  couple_name: string;
  items: QuoteItem[];
  branding_blocks: Block[] | null;
}

/**
 * Page-state machine. Driven by the RPC response + the quote's
 * `status` field + the current date relative to `expires_at`.
 */
export type PageState =
  | 'loading'
  | 'not_found'
  | 'active'
  | 'expired'
  | 'accepted'
  | 'declined';

export function deriveState(quote: PublicQuote | null): PageState {
  if (!quote) return 'not_found';
  if (quote.status === 'accepted') return 'accepted';
  if (quote.status === 'declined') return 'declined';
  if (quote.expires_at && new Date(quote.expires_at + 'T00:00:00') < new Date()) {
    return 'expired';
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

/**
 * Compute discount, tax, and total from the quote's primitive fields.
 * Shared by the totals row in `<QuoteFallbackCard>` so the math
 * doesn't drift between the three places (subtotal display + GST
 * line + Total line) that need it.
 */
export interface QuoteTotals {
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
}

export function computeQuoteTotals(quote: PublicQuote): QuoteTotals {
  const discountAmount =
    quote.discount_type && (quote.discount_value ?? 0) > 0
      ? quote.discount_type === 'percentage'
        ? (quote.subtotal * (quote.discount_value ?? 0)) / 100
        : quote.discount_value ?? 0
      : 0;
  const taxableAmount = quote.subtotal - discountAmount;
  const taxAmount = taxableAmount * ((quote.tax_rate ?? 0) / 100);
  return {
    discountAmount,
    taxableAmount,
    taxAmount,
    total: taxableAmount + taxAmount,
  };
}
