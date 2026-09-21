/**
 * The cash-basis ledger behind the Payments Reports tab: one row per
 * payment actually received, GST split out at the invoice's own rate.
 */
import { describe, expect, it } from 'vitest'

import {
  filterTransactionsByDate,
  getInvoiceTransactions,
  summarizeTransactions,
  toTransactionsCsv,
} from '@/lib/payments/report-transactions'

const invoice = {
  id: 'inv_1',
  invoice_number: 'INV-001',
  status: 'sent',
  subtotal: 1000,
  tax_rate: 10,
  discount_type: null,
  discount_value: null,
  paid_at: null,
  couple: { name: 'Alex & Sam' },
}

describe('getInvoiceTransactions', () => {
  it('is empty for a cancelled invoice even if stages were paid', () => {
    const result = getInvoiceTransactions({ ...invoice, status: 'cancelled' }, [
      { amount_cents: 55000, paid_at: '2026-05-01T00:00:00Z', due_date: null, label: 'Deposit' },
    ])
    expect(result).toEqual([])
  })

  it('is empty for an unpaid stageless invoice', () => {
    expect(getInvoiceTransactions(invoice, [])).toEqual([])
  })

  it('is one transaction for a paid stageless invoice, GST split at the invoice rate', () => {
    const [txn] = getInvoiceTransactions(
      { ...invoice, status: 'paid', paid_at: '2026-05-01T00:00:00Z' },
      [],
    )
    // Gross = 1000 * 1.10 = 1100.00 -> 110000c; net = 110000 / 1.1 = 100000c.
    expect(txn?.grossCents).toBe(110000)
    expect(txn?.netCents).toBe(100000)
    expect(txn?.gstCents).toBe(10000)
    expect(txn?.paidAt).toBe('2026-05-01T00:00:00Z')
  })

  it('applies the discount before GST for a paid stageless invoice', () => {
    // (1000 - 10%) = 900, + 10% GST = 990.00 -> 99000c gross; net = 90000c.
    const [txn] = getInvoiceTransactions(
      {
        ...invoice,
        status: 'paid',
        paid_at: '2026-05-01T00:00:00Z',
        discount_type: 'percentage',
        discount_value: 10,
      },
      [],
    )
    expect(txn?.grossCents).toBe(99000)
    expect(txn?.netCents).toBe(90000)
    expect(txn?.gstCents).toBe(9000)
  })

  it('only includes paid stages, using each stage label as the description', () => {
    const result = getInvoiceTransactions(invoice, [
      { amount_cents: 55000, paid_at: '2026-05-01T00:00:00Z', due_date: null, label: 'Deposit' },
      { amount_cents: 55000, paid_at: null, due_date: '2026-07-01', label: 'Final payment' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.description).toBe('Deposit')
    expect(result[0]?.grossCents).toBe(55000)
    expect(result[0]?.gstCents).toBe(5000)
  })

  it('sorts multiple paid stages oldest first', () => {
    const result = getInvoiceTransactions(invoice, [
      { amount_cents: 55000, paid_at: '2026-06-01T00:00:00Z', due_date: null, label: 'Final payment' },
      { amount_cents: 55000, paid_at: '2026-05-01T00:00:00Z', due_date: null, label: 'Deposit' },
    ])
    expect(result.map((t) => t.description)).toEqual(['Deposit', 'Final payment'])
  })

  it('has zero GST when the invoice has no tax rate', () => {
    const [txn] = getInvoiceTransactions({ ...invoice, tax_rate: 0 }, [
      { amount_cents: 50000, paid_at: '2026-05-01T00:00:00Z', due_date: null, label: 'Deposit' },
    ])
    expect(txn?.gstCents).toBe(0)
    expect(txn?.netCents).toBe(50000)
  })
})

describe('filterTransactionsByDate + summarizeTransactions', () => {
  const transactions = [
    { invoiceId: 'i1', invoiceNumber: 'INV-001', coupleName: 'A', description: 'Deposit', paidAt: '2026-05-01T00:00:00Z', grossCents: 55000, gstCents: 5000, netCents: 50000 },
    { invoiceId: 'i2', invoiceNumber: 'INV-002', coupleName: 'B', description: 'Payment', paidAt: '2026-08-15T00:00:00Z', grossCents: 110000, gstCents: 10000, netCents: 100000 },
  ]

  it('keeps only transactions within the inclusive range', () => {
    const result = filterTransactionsByDate(transactions, { start: '2026-07-01', end: '2027-06-30' })
    expect(result).toHaveLength(1)
    expect(result[0]?.invoiceId).toBe('i2')
  })

  it('sums gross/net/GST across the given transactions', () => {
    expect(summarizeTransactions(transactions)).toEqual({
      grossCents: 165000,
      netCents: 150000,
      gstCents: 15000,
    })
  })

  it('sums to zero for an empty list', () => {
    expect(summarizeTransactions([])).toEqual({ grossCents: 0, netCents: 0, gstCents: 0 })
  })
})

describe('toTransactionsCsv', () => {
  it('shapes one row per transaction with dollar-formatted money columns', () => {
    const transactions = [
      { invoiceId: 'i1', invoiceNumber: 'INV-001', coupleName: 'Alex & Sam', description: 'Deposit', paidAt: '2026-08-02T00:00:00Z', grossCents: 55000, gstCents: 5000, netCents: 50000 },
    ]
    const csv = toTransactionsCsv(transactions, { start: '2026-07-01', end: '2027-06-30' })
    expect(csv.headers).toEqual(['Date', 'Invoice', 'Couple', 'Description', 'Net (AUD)', 'GST (AUD)', 'Gross (AUD)'])
    expect(csv.rows).toEqual([['2026-08-02', 'INV-001', 'Alex & Sam', 'Deposit', '500.00', '50.00', '550.00']])
    expect(csv.filename).toBe('payments-2026-07-01-to-2027-06-30')
  })

  it('is an empty row list for no transactions', () => {
    const csv = toTransactionsCsv([], { start: '2026-07-01', end: '2027-06-30' })
    expect(csv.rows).toEqual([])
  })
})
