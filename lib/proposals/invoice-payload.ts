/**
 * Pure builders for the invoice a proposal generates on signature. Shared by
 * the finalize service and its tests; the RPC only stores what this produces.
 *
 * Mirrors the proposal page's own maths (`lib/proposals/pricing.ts`): the
 * invoice total must equal the total the couple accepted (ruling C3).
 *
 * @module lib/proposals/invoice-payload
 */
import { flattenItem, roundCents, weekendLoadingLine } from '@/lib/payments/package-math'
import { resolveStages } from '@/lib/payments/resolve-stages'
import type { PublicProposalOption } from '@/lib/proposals/public-types'
import type { TemplateStage } from '@/types/payment-schedule'

import type { FinalizeInvoiceItem, FinalizeInvoicePayload, FinalizeInvoiceStage } from './close-types'

const POSITION_STEP = 1000

/** Line items for the accepted option: base lines, weekend loading, chosen add-ons. */
export function buildInvoiceItems(
  option: PublicProposalOption,
  selectedAddonIds: readonly string[],
): { items: FinalizeInvoiceItem[]; subtotal: number } {
  const lines: Array<{ description: string; note: string | null; amount: number }> = []
  if (option.pricing_mode === 'single') {
    lines.push({ description: option.title, note: null, amount: option.fixed_price ?? 0 })
  } else {
    for (const item of option.items.filter((i) => !i.is_addon)) {
      const flat = flattenItem({ description: item.description, amount: item.amount, quantity: item.quantity })
      lines.push({ description: flat.description, note: item.note, amount: flat.amount })
    }
  }
  const base = roundCents(lines.reduce((sum, l) => sum + l.amount, 0))
  const loading = weekendLoadingLine(base, option.weekend_loading_percent)
  if (loading) lines.push({ ...loading, note: null })
  for (const item of option.items.filter((i) => i.is_addon && selectedAddonIds.includes(i.id))) {
    const flat = flattenItem({ description: item.description, amount: item.amount, quantity: item.quantity })
    lines.push({ description: flat.description, note: item.note, amount: flat.amount })
  }
  const items = lines.map((l, i) => ({ ...l, position: (i + 1) * POSITION_STEP }))
  return { items, subtotal: roundCents(items.reduce((sum, l) => sum + l.amount, 0)) }
}

/**
 * The full payload for `finalize_proposal_acceptance`. Stage precedence:
 * the MC's schedule, else a deposit + balance pair from `deposit_percent`,
 * else one full-payment stage (spec 5.3).
 *
 * `warning` is set (non-null) only when a schedule was found but could not
 * be resolved (e.g. a corrupted schedule with two remainder stages) and the
 * single-full-payment stage was substituted so the acceptance can still
 * finalize. It is null on every other path, including the deposit/full-payment
 * fallbacks chosen deliberately because no schedule applied: those are not
 * degraded, they are the designed behaviour. The caller logs a non-null
 * warning; the RPC payload shape (`payload`) is unaffected either way.
 */
export function buildInvoicePayload(input: {
  title: string
  option: PublicProposalOption
  selectedAddonIds: readonly string[]
  schedule: TemplateStage[] | null
  depositPercent: number | null
  eventDate: string | null
  issueDate: string
  stripePaymentEnabled: boolean
}): { payload: FinalizeInvoicePayload; warning: string | null } {
  const { items, subtotal } = buildInvoiceItems(input.option, input.selectedAddonIds)
  const totalCents = Math.round(subtotal * 100)
  const template: TemplateStage[] =
    input.schedule && input.schedule.length > 0
      ? input.schedule
      : input.depositPercent && input.depositPercent > 0
        ? [
            { label: 'Deposit', amountType: 'percent', amountValue: input.depositPercent, offsetValue: 7, offsetUnit: 'day', offsetAnchor: 'issue' },
            { label: 'Balance', amountType: 'remainder', amountValue: null, offsetValue: 14, offsetUnit: 'day', offsetAnchor: input.eventDate ? 'due' : 'issue' },
          ]
        : [{ label: 'Full payment', amountType: 'remainder', amountValue: null, offsetValue: 14, offsetUnit: 'day', offsetAnchor: 'issue' }]
  // A 'due'-anchored stage with no event date cannot resolve; fall back to
  // counting from the issue date rather than failing the whole acceptance.
  const safeTemplate = input.eventDate ? template : template.map((s) => (s.offsetAnchor === 'due' ? { ...s, offsetAnchor: 'issue' as const } : s))
  const resolved = resolveStages(safeTemplate, totalCents, input.issueDate, input.eventDate)
  const warning = resolved.ok
    ? null
    : `Schedule did not resolve (${resolved.errors.map((e) => JSON.stringify(e)).join(', ')}); invoiced as a single full payment`
  const stages: FinalizeInvoiceStage[] = resolved.ok
    ? resolved.stages.map((s) => ({
        position: s.position, label: s.label, amount_type: s.amountType, amount_value: s.amountValue, amount_cents: s.amountCents,
        due_date: s.dueDate, due_offset_value: s.offsetValue, due_offset_unit: s.offsetUnit, due_offset_anchor: s.offsetAnchor,
      }))
    : [{ position: 1, label: 'Full payment', amount_type: 'remainder', amount_value: null, amount_cents: totalCents, due_date: null, due_offset_value: 14, due_offset_unit: 'day', due_offset_anchor: 'issue' }]
  return {
    payload: {
      title: input.title,
      due_date: input.eventDate,
      subtotal,
      gst_inclusive: input.option.gst_inclusive,
      stripe_payment_enabled: input.stripePaymentEnabled,
      items,
      stages,
    },
    warning,
  }
}
