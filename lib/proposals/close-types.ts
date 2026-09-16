/**
 * Shared types for the proposal close: decline reasons, the pending-contract
 * and invoice slices of `get_public_proposal`, the invoice payload sent to
 * `finalize_proposal_acceptance`, and the RPC response shapes the pay step
 * and the finalize service exchange.
 *
 * @module lib/proposals/close-types
 */

/** Reasons a couple can give when declining a proposal (matches the `decline_proposal` RPC's check). */
export const DECLINE_REASONS = ['price', 'date', 'other_vendor', 'other'] as const

/** One of {@link DECLINE_REASONS}. */
export type DeclineReason = (typeof DECLINE_REASONS)[number]

/** Human-readable label for each {@link DeclineReason}, for the decline dialog. */
export const DECLINE_REASON_LABELS: Record<DeclineReason, string> = {
  price: 'Price',
  date: 'Date no longer works',
  other_vendor: 'Going with someone else',
  other: 'Something else',
}

/**
 * The contract behind an accepted option, as `get_public_proposal` embeds it
 * under `pending_contract`. Null on the RPC payload until the couple has
 * accepted an option; present from then on, signed or not, so the server
 * page can tell a signed-but-unfinalized contract apart and repair it.
 */
export interface PendingContract {
  sign_token: string
  contract_number: string
  title: string | null
  /** Null when the accept route's publish step failed after the RPC: the couple re-runs it from Choose. */
  locked_content_html: string | null
  /** Set once the couple signed; with `accepted_at` still null it means finalize has not landed yet. */
  signed_at: string | null
}

/**
 * The invoice slice of `get_public_proposal`, present once
 * `finalize_proposal_acceptance` has run. `first_stage` is stage 1 (the
 * lowest position) whether or not it has been paid; readers check its
 * `paid_at` themselves. Both RPCs return the same stage so a resume and a
 * fresh finalize agree.
 */
export interface PublicProposalInvoice {
  id: string
  share_token: string
  /** The invoice's own reference number (e.g. `INV-014`), shown as the bank-transfer payment reference. */
  invoice_number: string
  stripe_payment_enabled: boolean
  paid_at: string | null
  first_stage: { id: string; label: string; amount_cents: number; due_date: string | null; paid_at: string | null } | null
}

/** One line item destined for `invoice_items`, as built by `buildInvoiceItems` (see `./invoice-payload`). */
export interface FinalizeInvoiceItem {
  description: string
  note: string | null
  amount: number
  /** 1000-stepped so a line can be inserted between two others without renumbering. */
  position: number
}

/** One payment stage destined for `invoice_payment_stages`, resolved to a concrete date and cent amount. */
export interface FinalizeInvoiceStage {
  position: number
  label: string
  amount_type: 'percent' | 'fixed' | 'remainder'
  amount_value: number | null
  amount_cents: number
  due_date: string | null
  due_offset_value: number
  due_offset_unit: 'day' | 'week' | 'month'
  due_offset_anchor: 'issue' | 'due'
}

/**
 * The full payload `finalizeProposalAcceptance` sends to
 * `finalize_proposal_acceptance` as `p_invoice`.
 */
export interface FinalizeInvoicePayload {
  title: string
  due_date: string | null
  subtotal: number
  gst_inclusive: boolean
  stripe_payment_enabled: boolean
  items: FinalizeInvoiceItem[]
  stages: FinalizeInvoiceStage[]
}

/** Successful response shape from the `accept_proposal` RPC. */
export interface AcceptResponse {
  ok: true
  sign_token: string
  contract: { contract_number: string; title: string | null; locked_content_html: string }
  total: number
  deposit: number
}

/** Successful response from `finalizeProposalAcceptance` (see `./finalize`). */
export interface FinalizeResult {
  ok: true
  invoice: PublicProposalInvoice
  already_finalized: boolean
}

/**
 * Failure response from `finalizeProposalAcceptance`. The ids are populated
 * from the point the contract row was read (every error after
 * `not_a_proposal`), so the caller's alert can name the MC and proposal.
 */
export interface FinalizeFailure {
  ok: false
  error: string
  userId?: string | null
  proposalId?: string | null
}
