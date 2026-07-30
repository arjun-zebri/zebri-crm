/**
 * Pure resolution and validation for custom payment schedules.
 *
 * One module owns the maths so the builder preview and the server action cannot
 * disagree about what the couple will be charged. No React, no Supabase.
 *
 * @module lib/payments/resolve-stages
 */
import type { ResolvedStage, StageAmountType, TemplateStage } from '@/types/payment-schedule'

/** Why a schedule cannot be applied or saved. */
export type StageValidationError =
  | { code: 'multiple_remainders' }
  | { code: 'remainder_not_last'; position: number }
  | { code: 'sum_mismatch'; expectedCents: number; actualCents: number }
  | { code: 'fixed_exceeds_total'; position: number }
  | { code: 'single_stage' }

/** Outcome of resolving a template against a concrete invoice total. */
export type ResolveResult =
  | { ok: true; stages: ResolvedStage[] }
  | { ok: false; errors: StageValidationError[] }

/** Add whole days to an ISO `YYYY-MM-DD` date, returning the same format. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  // UTC arithmetic throughout: a local-time Date would shift the calendar day
  // for anyone east of Greenwich, which is every Australian user.
  const base = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

/** Whole-day difference between two ISO `YYYY-MM-DD` dates. */
function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`)
  const to = Date.parse(`${toIso}T00:00:00Z`)
  return Math.round((to - from) / 86_400_000)
}

/**
 * Structural checks that do not depend on the invoice total.
 *
 * Collects all structural errors (multiple remainders, remainder not last) within
 * this stage before returning, but the caller stops validation entirely if any are
 * found: amount checks are only meaningful on structurally valid templates.
 */
function structuralErrors(template: TemplateStage[]): StageValidationError[] {
  const errors: StageValidationError[] = []
  const remainderIndexes = template
    .map((s, i) => (s.amountType === 'remainder' ? i : -1))
    .filter((i) => i >= 0)

  if (remainderIndexes.length > 1) errors.push({ code: 'multiple_remainders' })
  const only = remainderIndexes[0]
  if (remainderIndexes.length === 1 && only !== template.length - 1) {
    errors.push({ code: 'remainder_not_last', position: (only ?? 0) + 1 })
  }
  return errors
}

/** Resolve one stage's cent amount, before rounding reconciliation. */
function stageCents(
  amountType: StageAmountType,
  amountValue: number | null,
  invoiceTotalCents: number,
): number {
  if (amountType === 'percent') {
    // Fallback to 0: DB check constraint enforces non-null for percent stages;
    // defensive only.
    return Math.round(invoiceTotalCents * ((amountValue ?? 0) / 100))
  }
  if (amountType === 'fixed') {
    // amountValue is dollars on a fixed stage; everything downstream is cents.
    // Fallback to 0: DB check constraint enforces non-null for fixed stages;
    // defensive only.
    return Math.round((amountValue ?? 0) * 100)
  }
  return 0 // remainder is filled in afterwards
}

/**
 * Resolve template stages against an invoice total and issue date.
 *
 * Validation proceeds in stages: structure (remaining count and position) is
 * checked first, then fixed-amount feasibility, then the percent-to-total sum.
 * Validation stops at the first stage that fails because later checks are only
 * meaningful if earlier ones pass. For example, with two remainder stages,
 * "what amount is left over" has no defined answer, so amount checks cannot
 * produce meaningful errors.
 *
 * Zero stages is valid and means a single-payment invoice.
 */
export function resolveStages(
  template: TemplateStage[],
  invoiceTotalCents: number,
  issueDate: string,
): ResolveResult {
  if (template.length === 0) return { ok: true, stages: [] }

  const errors = structuralErrors(template)
  // Amount checks cannot run on a template with structural errors (e.g., two
  // remainder stages), so we return early: the validation stage stopped here.
  if (errors.length > 0) return { ok: false, errors }

  const hasRemainder = template.some((s) => s.amountType === 'remainder')

  // Fixed amounts are absolute, so they are the only stages that can
  // individually exceed the invoice. Check before allocating anything.
  const fixedCents = template.reduce(
    (acc, s) => acc + (s.amountType === 'fixed' ? stageCents('fixed', s.amountValue, invoiceTotalCents) : 0),
    0,
  )
  if (fixedCents > invoiceTotalCents) {
    const offender = template.findIndex((s) => s.amountType === 'fixed')
    return { ok: false, errors: [{ code: 'fixed_exceeds_total', position: offender + 1 }] }
  }

  const cents = template.map((s) => stageCents(s.amountType, s.amountValue, invoiceTotalCents))
  const allocated = cents.reduce((a, b) => a + b, 0)

  if (hasRemainder) {
    const remainder = invoiceTotalCents - allocated
    if (remainder < 0) {
      const offender = template.findIndex((s) => s.amountType === 'fixed')
      return {
        ok: false,
        errors: [{ code: 'fixed_exceeds_total', position: (offender >= 0 ? offender : 0) + 1 }],
      }
    }
    cents[cents.length - 1] = remainder
  } else {
    // Each percent stage can round by at most a cent, so that is the only
    // drift we tolerate. Anything larger is a genuine declaration error
    // (for example percents that only add up to 90), not rounding.
    const percentCount = template.filter((s) => s.amountType === 'percent').length
    if (Math.abs(allocated - invoiceTotalCents) > percentCount) {
      return {
        ok: false,
        errors: [{ code: 'sum_mismatch', expectedCents: invoiceTotalCents, actualCents: allocated }],
      }
    }
    // The last stage absorbs the rounding difference so stages always sum
    // to the invoice total exactly.
    cents[cents.length - 1] = (cents[cents.length - 1] ?? 0) + (invoiceTotalCents - allocated)
  }

  return {
    ok: true,
    stages: template.map((s, i) => ({
      position: i + 1,
      label: s.label,
      amountType: s.amountType,
      amountValue: s.amountValue,
      amountCents: cents[i] ?? 0,
      dueDate: addDays(issueDate, s.dueOffsetDays),
    })),
  }
}

/**
 * Convert resolved invoice stages back into a portable template.
 *
 * This is the "Save this as a schedule" direction: concrete dates become
 * offsets from the invoice's issue date so the schedule can be applied to a
 * future invoice with a different issue date and total.
 */
export function toTemplateStages(stages: ResolvedStage[], issueDate: string): TemplateStage[] {
  return stages.map((s) => ({
    label: s.label,
    amountType: s.amountType,
    amountValue: s.amountValue,
    dueOffsetDays: s.dueDate ? daysBetween(issueDate, s.dueDate) : 0,
  }))
}

/**
 * Extra rule that applies only when persisting a reusable schedule: a
 * single-stage schedule is rejected because it is indistinguishable from having
 * no schedule at all, which the picker already offers as its own entry.
 */
export function validateForSave(template: TemplateStage[]): StageValidationError[] {
  const errors = structuralErrors(template)
  if (template.length === 1) errors.push({ code: 'single_stage' })
  return errors
}
