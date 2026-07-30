import { describe, expect, it } from 'vitest'

import { resolveStages, toTemplateStages, validateForSave } from '@/lib/payments/resolve-stages'
import type { TemplateStage } from '@/types/payment-schedule'

const pct = (label: string, value: number, offset = 0): TemplateStage => ({
  label, amountType: 'percent', amountValue: value, dueOffsetDays: offset,
})
const fixed = (label: string, dollars: number, offset = 0): TemplateStage => ({
  label, amountType: 'fixed', amountValue: dollars, dueOffsetDays: offset,
})
const rest = (label: string, offset = 0): TemplateStage => ({
  label, amountType: 'remainder', amountValue: null, dueOffsetDays: offset,
})

const ISSUE = '2026-06-12'

describe('resolveStages', () => {
  it('resolves a percent-only schedule summing to 100', () => {
    const result = resolveStages([pct('Deposit', 30, 0), pct('Final', 70, 60)], 500_000, ISSUE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages.map((s) => s.amountCents)).toEqual([150_000, 350_000])
    expect(result.stages.map((s) => s.position)).toEqual([1, 2])
  })

  it('adds due_offset_days to the issue date', () => {
    const result = resolveStages([pct('Deposit', 100, 7)], 100_000, ISSUE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages[0]!.dueDate).toBe('2026-06-19')
  })

  it('resolves mixed fixed plus remainder', () => {
    // $500 fixed then the rest of a $5,000 invoice.
    const result = resolveStages([fixed('Booking fee', 500), rest('Balance', 90)], 500_000, ISSUE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stages.map((s) => s.amountCents)).toEqual([50_000, 450_000])
  })

  it('always totals the invoice to the cent under rounding', () => {
    // 3 x 33.333% of $1,000.01 cannot divide evenly; the last stage absorbs.
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
    // The "$500 fixed on a $400 invoice" case.
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
    // Template has both structural errors (two remainders) and amount errors
    // (fixed fee exceeds invoice total), but only structural errors are reported
    // because amount checks cannot run meaningfully until structure is valid.
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
  it('round-trips offsets across a different issue date', () => {
    const first = resolveStages([pct('Deposit', 25, 0), rest('Final', 90)], 400_000, ISSUE)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const template = toTemplateStages(first.stages, ISSUE)
    expect(template.map((t) => t.dueOffsetDays)).toEqual([0, 90])

    // Applied to a later invoice, the offsets hold.
    const second = resolveStages(template, 800_000, '2026-08-01')
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.stages.map((s) => s.dueDate)).toEqual(['2026-08-01', '2026-10-30'])
    expect(second.stages.map((s) => s.amountCents)).toEqual([200_000, 600_000])
  })

  it('maps a null due date to offset 0', () => {
    const template = toTemplateStages(
      [{ position: 1, label: 'Deposit', amountType: 'percent', amountValue: 50, amountCents: 100, dueDate: null }],
      ISSUE,
    )
    expect(template[0]!.dueOffsetDays).toBe(0)
  })
})
