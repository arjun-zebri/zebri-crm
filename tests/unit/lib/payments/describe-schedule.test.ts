import { describe, expect, it } from 'vitest'

import { describeSchedule } from '@/lib/payments/describe-schedule'
import type { TemplateStage } from '@/types/payment-schedule'

const s = (
  amountType: TemplateStage['amountType'],
  amountValue: number | null,
): TemplateStage => ({ label: 'x', amountType, amountValue, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' })

describe('describeSchedule', () => {
  it('joins a percent stage and a remainder with "then remainder"', () => {
    expect(describeSchedule([s('percent', 25), s('remainder', null)])).toBe('25%, then remainder')
  })

  it('joins several percent stages before the remainder', () => {
    expect(
      describeSchedule([s('percent', 25), s('percent', 25), s('remainder', null)]),
    ).toBe('25%, 25%, then remainder')
  })

  it('lists percentages that do not end in a remainder', () => {
    expect(describeSchedule([s('percent', 50), s('percent', 50)])).toBe('50%, 50%')
  })

  it('formats a fixed dollar stage', () => {
    expect(describeSchedule([s('fixed', 500), s('remainder', null)])).toBe('$500, then remainder')
  })

  it('describes a single stage without a "then"', () => {
    expect(describeSchedule([s('percent', 100)])).toBe('100%')
  })

  it('describes an empty schedule as a single payment', () => {
    expect(describeSchedule([])).toBe('Single payment')
  })
})
