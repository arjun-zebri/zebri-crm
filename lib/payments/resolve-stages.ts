/**
 * Pure resolution and validation for custom payment schedules.
 *
 * One module owns the maths so the builder preview and the server action cannot
 * disagree about what the couple will be charged. No React, no Supabase.
 *
 * @module lib/payments/resolve-stages
 */
import type {
  OffsetAnchor,
  OffsetUnit,
  ResolvedStage,
  StageAmountType,
  TemplateStage,
} from '@/types/payment-schedule'

/** Why a schedule cannot be applied or saved. */
export type StageValidationError =
  | { code: 'multiple_remainders' }
  | { code: 'remainder_not_last'; position: number }
  | { code: 'sum_mismatch'; expectedCents: number; actualCents: number }
  | { code: 'fixed_exceeds_total'; position: number }
  | { code: 'single_stage' }
  | { code: 'no_due_date' }

/** Outcome of resolving a template against a concrete invoice total. */
export type ResolveResult =
  | { ok: true; stages: ResolvedStage[] }
  | { ok: false; errors: StageValidationError[] }

/**
 * Add a `<value> <unit>` offset to an ISO `YYYY-MM-DD` date.
 *
 * `day` and `week` are fixed-length. `month` adds calendar months and clamps to
 * the end of a shorter target month, so issue Jan 31 + 1 month lands on Feb 28
 * rather than spilling into March. UTC arithmetic throughout: a local-time Date
 * would shift the calendar day for anyone east of Greenwich, which is every
 * Australian user.
 */
/**
 * Resolve one stage's concrete due date from its anchor and offset. `'issue'`
 * counts forward from the issue date; `'due'` counts backward from the invoice
 * due date. Returns null when a `'due'`-anchored stage has no due date to
 * count from — the caller turns that into a `no_due_date` validation error.
 */
function resolveDueDate(
  anchor: OffsetAnchor,
  value: number,
  unit: OffsetUnit,
  issueDate: string,
  dueDate: string | null,
): string | null {
  if (anchor === 'due') {
    if (!dueDate) return null
    return addOffset(dueDate, -value, unit)
  }
  return addOffset(issueDate, value, unit)
}

function addOffset(isoDate: string, value: number, unit: OffsetUnit): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const base = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
  if (unit === 'day') {
    base.setUTCDate(base.getUTCDate() + value)
  } else if (unit === 'week') {
    base.setUTCDate(base.getUTCDate() + value * 7)
  } else {
    // Move to the first, shift whole months, then clamp the day so a short
    // target month cannot roll the date into the following month.
    const day = base.getUTCDate()
    base.setUTCDate(1)
    base.setUTCMonth(base.getUTCMonth() + value)
    const lastDay = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
    ).getUTCDate()
    base.setUTCDate(Math.min(day, lastDay))
  }
  return base.toISOString().slice(0, 10)
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
  dueDate: string | null = null,
): ResolveResult {
  if (template.length === 0) return { ok: true, stages: [] }

  const errors = structuralErrors(template)
  // Amount checks cannot run on a template with structural errors (e.g., two
  // remainder stages), so we return early: the validation stage stopped here.
  if (errors.length > 0) return { ok: false, errors }

  // A stage timed "before the due date" cannot be dated without one.
  if (!dueDate && template.some((s) => s.offsetAnchor === 'due')) {
    return { ok: false, errors: [{ code: 'no_due_date' }] }
  }

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
      dueDate: resolveDueDate(s.offsetAnchor, s.offsetValue, s.offsetUnit, issueDate, dueDate),
      offsetValue: s.offsetValue,
      offsetUnit: s.offsetUnit,
      offsetAnchor: s.offsetAnchor,
    })),
  }
}

/**
 * Convert resolved invoice stages back into a portable template.
 *
 * This is the "Save to library" direction. The offset value + unit are stored
 * on the resolved stage, so they map straight through and the schedule keeps
 * the MC's chosen unit when applied to a future invoice.
 */
export function toTemplateStages(stages: ResolvedStage[]): TemplateStage[] {
  return stages.map((s) => ({
    label: s.label,
    amountType: s.amountType,
    amountValue: s.amountValue,
    offsetValue: s.offsetValue,
    offsetUnit: s.offsetUnit,
    offsetAnchor: s.offsetAnchor,
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
