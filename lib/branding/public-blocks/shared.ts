// Shared helpers + types for the public block renderers. Each block component
// lives in its own file; this is the common surface they all import.

import { DENSITY_PADDING } from '../density'
import type { PublicBranding } from '../public-surface'

export const HEADER_HEIGHTS = { sm: 80, md: 128, lg: 192 } as const

export function fmt(n: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

/**
 * Format a YYYY-MM-DD date string in UTC to avoid timezone drift.
 * Deterministic on both server and client regardless of host timezone.
 * @param dateStr - A date in YYYY-MM-DD format
 * @returns Formatted date string (e.g. "31 December 2026")
 */
export function fmtDate(dateStr: string): string {
  // Parse and format in UTC so the server render and the client hydration
  // produce identical strings regardless of host timezone.
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

export function pad(branding: PublicBranding) {
  return DENSITY_PADDING[branding.density]
}

export interface PublicDocItem {
  id: string
  description: string
  quantity?: number
  unit_price?: number
  amount: number
}

export interface PublicDocData {
  title: string
  refNumber: string
  /**
   * The couple's name, shown as the title block's subtitle line when
   * `TitleBlock.showCoupleName` is on. Undefined on surfaces without a couple
   * context (portal/vendor/questionnaire), which don't use the title block.
   */
  coupleName?: string
  /** Wedding/event date (YYYY-MM-DD) for the `event_date` variable. Not on every payload yet. */
  eventDate?: string | null
  /** Venue name for the `venue` variable. Not on every payload yet. */
  venue?: string | null
  expiresAt: string | null
  /**
   * Label for the date meta row on the title block. Surfaces set this to match
   * their semantics: invoices use `'Due'` (the value is the payment due date),
   * while contracts and quotes genuinely expire and use `'Expires'`. Defaults
   * to `'Expires'` when unset so existing callers are unaffected.
   */
  expiresLabel?: string
  items: PublicDocItem[]
  subtotal: number
  taxRate: number
  discountType?: 'percentage' | 'fixed' | null
  discountValue?: number | null
  /**
   * Invoice deposit / final-balance schedule. When present, the `paymentSchedule`
   * block renders the two stages with these amounts and due dates. Null/undefined
   * means no schedule, so the block renders nothing.
   */
  paymentSchedule?: {
    depositPercent: number
    depositAmount: number
    depositDueDate: string | null
    finalAmount: number
    finalDueDate: string | null
  } | null
}

export interface ActionSlotProps {
  onPrimary?: () => void
  onSecondary?: () => void
  primaryLabel?: string
  secondaryLabel?: string | null
  primaryDisabled?: boolean
  primaryLoading?: boolean
  hideAction?: boolean
}
