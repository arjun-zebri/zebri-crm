/**
 * `invoice_sent`, `payment_received`, `invoice_due` and
 * `invoice_overdue` narrowing after the trigger sweep.
 *
 * The headline fix pinned here: `invoice_sent`'s amount filter used to
 * compare a `subtotal` field its payload never carried, so a
 * configured filter matched nothing. Both doc triggers now share one
 * matcher over the enriched payload, and the amount compares `total`.
 */
import { describe, expect, it } from 'vitest'

import { triggerRegistry } from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

function event(payload: Record<string, unknown>): AutomationEventRow {
  return { payload } as unknown as AutomationEventRow
}

describe('invoice_sent', () => {
  const spec = triggerRegistry.invoice_sent

  it('shares the invoice_created narrowing, on the enriched payload', () => {
    const payload = {
      total: 2200,
      discount_type: 'fixed',
      discount_value: 100,
      due_date: '2027-01-15',
      event_date: '2027-03-06',
    }
    expect(spec.match(event(payload), { amountOp: 'gte', amountValue: 2000 })).toBe(true)
    expect(spec.match(event(payload), { amountOp: 'gte', amountValue: 2500 })).toBe(false)
    expect(spec.match(event(payload), { hasDiscount: true })).toBe(true)
    expect(spec.match(event(payload), { eventMonth: 'mar' })).toBe(true)
  })

  it('no longer silently drops a configured amount filter', () => {
    // The old payload had no amount field at all; the filter must
    // reject (not silently pass) an event without one.
    expect(spec.match(event({}), { amountOp: 'gte', amountValue: 100 })).toBe(false)
    expect(spec.match(event({}), {})).toBe(true)
  })
})

describe('payment_received', () => {
  const spec = triggerRegistry.payment_received

  it('narrows on the paid total and the wedding date', () => {
    const payload = { total: 3300, event_date: '2027-03-06' }
    expect(spec.match(event(payload), { amountOp: 'gte', amountValue: 3000 })).toBe(true)
    expect(spec.match(event(payload), { amountOp: 'lt', amountValue: 3000 })).toBe(false)
    expect(spec.match(event(payload), { season: 'peak' })).toBe(true)
    expect(spec.match(event(payload), { eventMonth: 'dec' })).toBe(false)
  })

  it('still parses configs saved with the dropped Phase 14a fields', () => {
    expect(
      spec.configSchema.safeParse({ amountOp: 'gte', amountValue: 500, paymentMethod: 'cash' })
        .success,
    ).toBe(true)
  })
})

describe('invoice_due', () => {
  const spec = triggerRegistry.invoice_due

  it('answers exactly its configured lead-time event', () => {
    expect(spec.match(event({ days_until_due: 3 }), { days: 3 })).toBe(true)
    expect(spec.match(event({ days_until_due: 0 }), { days: 3 })).toBe(false)
  })

  it('narrows to the final payment stage when asked', () => {
    const config = { days: 0, isFinalBalance: true }
    expect(spec.match(event({ days_until_due: 0, stage_is_final: true }), config)).toBe(true)
    expect(spec.match(event({ days_until_due: 0, stage_is_final: false }), config)).toBe(false)
  })

  it('still parses configs saved with the deleted fields', () => {
    const legacy = { days: 3, notificationCount: 2, respectQuietHours: true }
    expect(spec.configSchema.safeParse(legacy).success).toBe(true)
  })

  it('accepts what the chip row seeds', () => {
    expect(spec.configSchema.safeParse({ days: 0, isFinalBalance: true }).success).toBe(true)
  })
})

describe('invoice_overdue', () => {
  const spec = triggerRegistry.invoice_overdue

  it('answers exactly its configured overdue depth', () => {
    expect(spec.match(event({ days_overdue: 7 }), { daysOverdueMin: 7 })).toBe(true)
    expect(spec.match(event({ days_overdue: 1 }), { daysOverdueMin: 7 })).toBe(false)
  })

  it('clamps a zero threshold up to one', () => {
    expect(spec.match(event({ days_overdue: 1 }), { daysOverdueMin: 0 })).toBe(true)
  })

  it('still parses configs saved with the deleted max / event-date fields', () => {
    const legacy = { daysOverdueMin: 3, daysOverdueMax: 10, daysUntilEventOp: 'lte' }
    expect(spec.configSchema.safeParse(legacy).success).toBe(true)
  })
})
