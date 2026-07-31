import { describe, expect, it } from 'vitest'

import { resolveStages, toTemplateStages, validateForSave } from '@/lib/payments/resolve-stages'
import type { OffsetUnit, TemplateStage } from '@/types/payment-schedule'

const pct = (
  label: string,
  value: number,
  offsetValue = 0,
  offsetUnit: OffsetUnit = 'day',
): TemplateStage => ({ label, amountType: 'percent', amountValue: value, offsetValue, offsetUnit })
const fixed = (
  label: string,
  dollars: number,
  offsetValue = 0,
  offsetUnit: OffsetUnit = 'day',
): TemplateStage => ({ label, amountType: 'fixed', amountValue: dollars, offsetValue, offsetUnit })
const rest = (
  label: string,
  offsetValue = 0,
  offsetUnit: OffsetUnit = 'day',
): TemplateStage => ({ label, amountType: 'remainder', amountValue: null, offsetValue, offsetUnit })

const ISSUE = '2026-06-12'

describe('resolveStages', () => {
  it('resolves a percent-only schedule summing to 100', () => {
    const result = resolveStages([pct('Deposit', 30, 0), pct('Final', 70, 60)], 500_000, ISSUE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages.map((s) => s.amountCents)).toEqual([150_000, 350_000])
    expect(result.stages.map((s) => s.position)).toEqual([1, 2])
  })

  it('adds a day offset to the issue date', () => {
    const result = resolveStages([pct('Deposit', 100, 7, 'day')], 100_000, ISSUE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages[0]!.dueDate).toBe('2026-06-19')
  })

  it('adds a week offset as seven days each', () => {
    const result = resolveStages([pct('Deposit', 100, 2, 'week')], 100_000, ISSUE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages[0]!.dueDate).toBe('2026-06-26')
  })

  it('adds a month offset as a real calendar month', () => {
    const result = resolveStages([pct('Deposit', 100, 1, 'month')], 100_000, ISSUE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages[0]!.dueDate).toBe('2026-07-12')
  })

  it('clamps a month offset to the end of a shorter month', () => {
    // Jan 31 + 1 month must land on Feb 28 (2026 is not a leap year), not
    // spill into March.
    const result = resolveStages([pct('Deposit', 100, 1, 'month')], 100_000, '2026-01-31')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages[0]!.dueDate).toBe('2026-02-28')
  })

  it('carries the offset value and unit through to the resolved stage', () => {
    const result = resolveStages([pct('Deposit', 100, 3, 'week')], 100_000, ISSUE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages[0]!.offsetValue).toBe(3)
    expect(result.stages[0]!.offsetUnit).toBe('week')
  })

  it('resolves mixed fixed plus remainder', () => {
    const result = resolveStages([fixed('Booking fee', 500), rest('Balance', 90)], 500_000, ISSUE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages.map((s) => s.amountCents)).toEqual([50_000, 450_000])
  })

  it('always totals the invoice to the cent under rounding', () => {
    const total = 100_001
    const result = resolveStages(
      [pct('One', 33.333), pct('Two', 33.333), pct('Three', 33.334)],
      total,
      ISSUE,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const sum = result.stages.reduce((acc, s) => acc + s.amountCents, 0)
    expect(sum).toBe(total)
  })

  it('rejects a fixed stage exceeding the total', () => {
    const result = resolveStages([fixed('Fee', 500), rest('Balance')], 40_000, ISSUE)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map((e) => e.code)).toContain('fixed_exceeds_total')
  })

  it('rejects a remainder that is not last', () => {
    const result = resolveStages([rest('Balance'), pct('Deposit', 30)], 500_000, ISSUE)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map((e) => e.code)).toContain('remainder_not_last')
  })

  it('rejects two remainder stages', () => {
    const result = resolveStages([rest('A'), rest('B')], 500_000, ISSUE)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map((e) => e.code)).toContain('multiple_remainders')
  })

  it('rejects percents that do not reach the total without a remainder', () => {
    const result = resolveStages([pct('Deposit', 30), pct('Final', 60)], 500_000, ISSUE)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map((e) => e.code)).toContain('sum_mismatch')
  })

  it('treats zero stages as a valid single-payment invoice', () => {
    const result = resolveStages([], 500_000, ISSUE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages).toEqual([])
  })

  it('reports structural errors before amount errors, by design', () => {
    const result = resolveStages(
      [rest('Balance A'), fixed('Fee', 500), rest('Balance B')],
      40_000,
      ISSUE,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    const codes = result.errors.map((e) => e.code)
    expect(codes).toContain('multiple_remainders')
    expect(codes).not.toContain('fixed_exceeds_total')
  })
})

describe('validateForSave', () => {
  it('rejects a one-stage schedule as equivalent to no schedule', () => {
    expect(validateForSave([pct('Everything', 100)]).map((e) => e.code)).toContain('single_stage')
  })

  it('accepts a two-stage schedule', () => {
    expect(validateForSave([pct('Deposit', 30), rest('Final')])).toEqual([])
  })
})

describe('toTemplateStages', () => {
  it('maps a resolved stage back to its stored offset value and unit', () => {
    const first = resolveStages([pct('Deposit', 25, 0), rest('Final', 2, 'month')], 400_000, ISSUE)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const template = toTemplateStages(first.stages)
    expect(template.map((t) => t.offsetValue)).toEqual([0, 2])
    expect(template.map((t) => t.offsetUnit)).toEqual(['day', 'month'])

    // Applied to a later invoice, the offsets hold (Aug 1 + 2 months = Oct 1).
    const second = resolveStages(template, 800_000, '2026-08-01')
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.stages.map((s) => s.dueDate)).toEqual(['2026-08-01', '2026-10-01'])
    expect(second.stages.map((s) => s.amountCents)).toEqual([200_000, 600_000])
  })
})
