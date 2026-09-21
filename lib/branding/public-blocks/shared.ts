// Shared helpers + types for the public block renderers. Each block component
// lives in its own file; this is the common surface they all import.

import type { JSONContent } from '@tiptap/core'
import type { CSSProperties } from 'react'

// Note: this is a type-only import of `PublicProposalOption` from
// `lib/proposals/public-types`, and that module imports `PublicDocData` (below)
// from here. The cycle only exists between types, so it is erased at compile
// time and never exists at runtime.
import type { PublicProposalOption } from '@/lib/proposals/public-types'
import type { HeroOverride } from '@/lib/proposals/types'

import { DENSITY_PADDING } from '../density'
import type { PublicBranding } from '../public-surface'

export const HEADER_HEIGHTS = { sm: 80, md: 128, lg: 192 } as const

export function fmt(n: number, decimals: 0 | 2 = 2): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD', minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(n)
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

/**
 * A resolved text style whose alignment follows its container instead of
 * the type role default. `resolveTextStyle` always pins an inline
 * `text-align` (the role default is `left`), which is right for a block's
 * own headline styles - a proposal section's alignment reaches those
 * through the block's `*Style` fields - but wrong for item text that has
 * no style field of its own (an FAQ question/answer, a testimonial
 * quote): pinned `left`, it ignored the section's alignment on the sent
 * page while the editor's inline fields for the same text inherited it
 * and moved (live bug, 2026-09-19).
 */
export function inheritAlign(css: CSSProperties): CSSProperties {
  return { ...css, textAlign: 'inherit' }
}

/**
 * How a block tree is framed. `document` is the 720px card every existing
 * surface uses; `page` is the proposal's full-bleed section layout; `print`
 * is the document frame with animation and video playback off.
 */
export type FrameMode = 'document' | 'page' | 'print'

/** Proposal data the data-bound proposal blocks render from (spec §7.3). */
export interface PublicDocProposal {
  options: PublicProposalOption[]
  introNote: JSONContent | string | null
  depositPercent: number | null
  heroOverride: HeroOverride | null
  expired: boolean
  // `signing` / `paying` are the Phase C close states: an accepted option
  // awaiting a contract signature, and a signed contract awaiting the
  // deposit. The accept block shows a status message instead of the button
  // for both, same as `accepted` / `declined` / `expired`.
  state: 'open' | 'signing' | 'paying' | 'accepted' | 'declined' | 'expired'
  proposalNumber: string
  acceptedOptionId: string | null
  acceptedAddonIds: string[]
  acceptedAt: string | null
}

/**
 * Selection state + handlers the public proposal page threads into the
 * packages and accept blocks. Absent in the editor and preview (read-only).
 */
export interface ProposalSlotProps {
  selectedOptionId?: string | null | undefined
  selectedAddonIds?: readonly string[] | undefined
  onSelectOption?: ((id: string) => void) | undefined
  onToggleAddon?: ((id: string) => void) | undefined
  onAccept?: (() => void) | undefined
  /** Opens the decline dialog. Given only on the live page (never the editor, preview or print), and only while the proposal is still open. */
  onDecline?: (() => void) | undefined
}

export interface PublicDocItem {
  id: string
  description: string
  /**
   * Optional qualifying note rendered beneath the description ("includes the
   * rehearsal and a site visit"). A single trailing note on the invoice cannot
   * say which charge it applies to, which is why this is per-line.
   */
  note?: string | null
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
  /**
   * Invoice-only display flag. When true the totals block renders a
   * "Prices include GST" note under the total, so a couple looking at a
   * GST-inclusive price knows the tax is already covered. Purely
   * informational: it never participates in subtotal, tax, or total.
   */
  gstInclusive?: boolean
  discountType?: 'percentage' | 'fixed' | null
  discountValue?: number | null
  /**
   * Invoice payment stages. When present, the `paymentSchedule` block renders
   * one row per stage. Null or undefined means no schedule, so the block
   * renders nothing. Previously a fixed deposit + final pair.
   */
  paymentSchedule?: {
    stages: Array<{
      label: string
      amountCents: number
      dueDate: string | null
      paidAt: string | null
    }>
  } | null
  /** Present only on the proposal surface; the data-bound proposal blocks render nothing without it. */
  proposal?: PublicDocProposal
}

export interface ActionSlotProps {
  onPrimary?: (() => void) | undefined
  onSecondary?: (() => void) | undefined
  primaryLabel?: string | undefined
  secondaryLabel?: string | null | undefined
  primaryDisabled?: boolean | undefined
  primaryLoading?: boolean | undefined
  hideAction?: boolean | undefined
}
