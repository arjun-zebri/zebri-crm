/**
 * `invoice_created` trigger narrowing.
 *
 * The two things worth pinning here are the money semantics (the
 * filter compares the total the couple is shown, not the raw line-item
 * subtotal) and the discount test, which has to agree with the public
 * totals block about what counts as a discount.
 */
import { describe, expect, it } from 'vitest'

import { triggerRegistry } from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

const spec = triggerRegistry.invoice_created

/** Minimal event row carrying the payload `tg_invoices_emit_lifecycle` builds. */
function invoice(payload: Record<string, unknown>): AutomationEventRow {
  return { payload } as unknown as AutomationEventRow
}

/** An ISO date `days` from now, so relative-date tests don't drift. */
function inDays(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('invoice_created config schema', () => {
  it('accepts the values the chip row seeds when a filter is added', () => {
    const seeded = {
      amountOp: 'gte',
      amountValue: 1000,
      hasDiscount: true,
      hasDueDate: true,
      dueInDaysOp: 'lte',
      dueInDaysValue: 14,
      hasEventDate: true,
      dayOfWeek: 'any',
      eventMonth: '',
      season: 'any',
    }
    expect(spec.configSchema.safeParse(seeded).success).toBe(true)
  })

  it('still parses a config saved against the dropped Phase 14a fields', () => {
    // They were never matched, but `.passthrough()` has to keep them
    // loading or the dispatcher would drop the whole automation.
    const legacy = { amountOp: 'gte', amountValue: 500, tier: 'premium', isDeposit: true }
    expect(spec.configSchema.safeParse(legacy).success).toBe(true)
  })
})

describe('invoice_created amount', () => {
  it('compares the total, not the subtotal', () => {
    // A $1,000 subtotal with 10% tax is an $1,100 invoice. A filter
    // for "at least $1,050" has to match it.
    const payload = { subtotal: 1000, total: 1100 }
    expect(spec.match(invoice(payload), { amountOp: 'gte', amountValue: 1050 })).toBe(true)
    expect(spec.match(invoice(payload), { amountOp: 'gte', amountValue: 1150 })).toBe(false)
  })

  it('narrows in both directions', () => {
    const payload = { total: 2000 }
    expect(spec.match(invoice(payload), { amountOp: 'lte', amountValue: 2500 })).toBe(true)
    expect(spec.match(invoice(payload), { amountOp: 'lt', amountValue: 2000 })).toBe(false)
    expect(spec.match(invoice(payload), { amountOp: 'eq', amountValue: 2000 })).toBe(true)
  })

  it('fires for any invoice when no amount is configured', () => {
    expect(spec.match(invoice({ total: 50 }), {})).toBe(true)
    expect(spec.match(invoice({}), {})).toBe(true)
  })
})

describe('invoice_created discount', () => {
  it('treats a typed discount with a positive value as a discount', () => {
    const discounted = { discount_type: 'percentage', discount_value: 10 }
    expect(spec.match(invoice(discounted), { hasDiscount: true })).toBe(true)
    expect(spec.match(invoice(discounted), { hasDiscount: false })).toBe(false)
  })

  it('does not count a zero-value discount', () => {
    // Same test the public totals block applies before rendering a
    // discount line: a row saying "percentage, 0" is not a discount.
    const zero = { discount_type: 'percentage', discount_value: 0 }
    expect(spec.match(invoice(zero), { hasDiscount: false })).toBe(true)
    expect(spec.match(invoice(zero), { hasDiscount: true })).toBe(false)
  })

  it('handles an invoice with no discount columns set', () => {
    const none = { discount_type: null, discount_value: null }
    expect(spec.match(invoice(none), { hasDiscount: false })).toBe(true)
    expect(spec.match(invoice(none), { hasDiscount: true })).toBe(false)
  })
})

describe('invoice_created due date', () => {
  it('narrows on whether a due date is set at all', () => {
    expect(spec.match(invoice({ due_date: inDays(30) }), { hasDueDate: true })).toBe(true)
    expect(spec.match(invoice({ due_date: null }), { hasDueDate: true })).toBe(false)
    expect(spec.match(invoice({ due_date: null }), { hasDueDate: false })).toBe(true)
  })

  it('narrows on how far away the due date is', () => {
    const config = { dueInDaysOp: 'lte' as const, dueInDaysValue: 14 }
    expect(spec.match(invoice({ due_date: inDays(7) }), config)).toBe(true)
    expect(spec.match(invoice({ due_date: inDays(60) }), config)).toBe(false)
  })

  it('counts an already-passed due date as negative days', () => {
    // "at most 7 days" should catch something already overdue.
    const config = { dueInDaysOp: 'lte' as const, dueInDaysValue: 7 }
    expect(spec.match(invoice({ due_date: inDays(-3) }), config)).toBe(true)
  })

  it('rejects an invoice with no due date for the days filter', () => {
    const config = { dueInDaysOp: 'lte' as const, dueInDaysValue: 14 }
    expect(spec.match(invoice({ due_date: null }), config)).toBe(false)
    expect(spec.match(invoice({}), config)).toBe(false)
  })
})

describe('invoice_created wedding date', () => {
  it('narrows on the couple wedding date joined into the payload', () => {
    // 2027-03-06 is a Saturday.
    const march = invoice({ event_date: '2027-03-06' })
    expect(spec.match(march, { dayOfWeek: 'saturday' })).toBe(true)
    expect(spec.match(march, { eventMonth: 'mar' })).toBe(true)
    expect(spec.match(march, { eventMonth: 'dec' })).toBe(false)
    expect(spec.match(march, { season: 'peak' })).toBe(true)
    expect(spec.match(march, { hasEventDate: true })).toBe(true)
  })

  it('rejects a dateless couple for every date-derived filter', () => {
    for (const config of [{ dayOfWeek: 'saturday' }, { eventMonth: 'dec' }, { season: 'peak' }]) {
      expect(spec.match(invoice({ event_date: null }), config)).toBe(false)
    }
  })
})

describe('invoice_created combined', () => {
  it('requires every configured filter to pass', () => {
    const config = {
      amountOp: 'gte' as const,
      amountValue: 1000,
      hasDiscount: false,
      hasDueDate: true,
    }
    const payload = { total: 1500, discount_type: null, due_date: inDays(20) }
    expect(spec.match(invoice(payload), config)).toBe(true)
    expect(spec.match(invoice({ ...payload, total: 500 }), config)).toBe(false)
    expect(spec.match(invoice({ ...payload, due_date: null }), config)).toBe(false)
    expect(
      spec.match(invoice({ ...payload, discount_type: 'fixed', discount_value: 100 }), config),
    ).toBe(false)
  })
})
