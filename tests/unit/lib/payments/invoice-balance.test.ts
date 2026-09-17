/**
 * `getInvoiceBalance` branches on stageless vs staged invoices and on
 * cancellation — these cases decide what the Invoices list "Balance"
 * column and the payments reports "Outstanding" tile show, so each
 * branch is pinned explicitly.
 */
import { describe, expect, it } from 'vitest'

import { getInvoiceBalance } from '@/lib/payments/invoice-balance'

const base = { subtotal: 1000, taxRate: 10, status: 'sent', due_date: '2026-06-01' }

describe('getInvoiceBalance — stageless', () => {
  it('owes the full total when unpaid', () => {
    const result = getInvoiceBalance(base, [])
    expect(result.totalCents).toBe(110000)
    expect(result.paidCents).toBe(0)
    expect(result.balanceCents).toBe(110000)
    expect(result.nextDueDate).toBe('2026-06-01')
    expect(result.isFullyPaid).toBe(false)
  })

  it('owes nothing once status is paid', () => {
    const result = getInvoiceBalance({ ...base, status: 'paid' }, [])
    expect(result.balanceCents).toBe(0)
    expect(result.paidCents).toBe(result.totalCents)
    expect(result.nextDueDate).toBeNull()
    expect(result.isFullyPaid).toBe(true)
  })

  it('owes nothing once cancelled, regardless of due date', () => {
    const result = getInvoiceBalance({ ...base, status: 'cancelled' }, [])
    expect(result.balanceCents).toBe(0)
    expect(result.paidCents).toBe(0)
    expect(result.nextDueDate).toBeNull()
    expect(result.isFullyPaid).toBe(true)
  })
})

describe('getInvoiceBalance — staged', () => {
  const stages = [
    { amount_cents: 55000, paid_at: '2026-05-01T00:00:00Z', due_date: '2026-05-01' },
    { amount_cents: 55000, paid_at: null, due_date: '2026-07-01' },
  ]

  it('sums only the paid stages and reports the soonest unpaid due date', () => {
    const result = getInvoiceBalance(base, stages)
    expect(result.totalCents).toBe(110000)
    expect(result.paidCents).toBe(55000)
    expect(result.balanceCents).toBe(55000)
    expect(result.nextDueDate).toBe('2026-07-01')
    expect(result.isFullyPaid).toBe(false)
  })

  it('picks the soonest of multiple unpaid stages', () => {
    const result = getInvoiceBalance(base, [
      { amount_cents: 30000, paid_at: null, due_date: '2026-08-01' },
      { amount_cents: 30000, paid_at: null, due_date: '2026-06-15' },
      { amount_cents: 50000, paid_at: '2026-05-01T00:00:00Z', due_date: '2026-05-01' },
    ])
    expect(result.nextDueDate).toBe('2026-06-15')
  })

  it('is fully paid once every stage carries a paid_at', () => {
    const result = getInvoiceBalance(base, [
      { amount_cents: 55000, paid_at: '2026-05-01T00:00:00Z', due_date: '2026-05-01' },
      { amount_cents: 55000, paid_at: '2026-06-01T00:00:00Z', due_date: '2026-07-01' },
    ])
    expect(result.balanceCents).toBe(0)
    expect(result.nextDueDate).toBeNull()
    expect(result.isFullyPaid).toBe(true)
  })

  it('clamps a negative balance to zero (stale stage amounts after an edit)', () => {
    const result = getInvoiceBalance(base, [
      { amount_cents: 200000, paid_at: '2026-05-01T00:00:00Z', due_date: '2026-05-01' },
    ])
    expect(result.balanceCents).toBe(0)
    expect(result.isFullyPaid).toBe(true)
  })

  it('owes nothing once cancelled, even with unpaid stages', () => {
    const result = getInvoiceBalance({ ...base, status: 'cancelled' }, stages)
    expect(result.balanceCents).toBe(0)
    expect(result.isFullyPaid).toBe(true)
  })
})
