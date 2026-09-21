/**
 * `sortInvoices` backs the Invoices tab's Sort dropdown, including the
 * new "Balance due" / "Next payment due" options.
 */
import { describe, expect, it } from 'vitest';

import type { InvoiceWithDerived } from '@/app/(dashboard)/payments/invoices-list';
import { sortInvoices } from '@/app/(dashboard)/payments/use-invoice-sort';

function invoice(overrides: Partial<InvoiceWithDerived>): InvoiceWithDerived {
  return {
    id: 'i1',
    invoice_number: 'INV-001',
    title: 'Ceremony',
    status: 'sent',
    subtotal: 1000,
    tax_rate: 0,
    discount_type: null,
    discount_value: null,
    due_date: null,
    paid_at: null,
    created_at: '2026-01-01T00:00:00Z',
    couple: { id: 'c1', name: 'Couple' },
    invoice_payment_stages: [],
    effectiveStatus: 'sent',
    isOverdue: false,
    balanceCents: 0,
    nextDueDate: null,
    ...overrides,
  };
}

describe('sortInvoices', () => {
  it('sorts by balance due, highest first', () => {
    const result = sortInvoices(
      [
        invoice({ id: 'low', balanceCents: 1000 }),
        invoice({ id: 'high', balanceCents: 9000 }),
      ],
      'balance',
      'desc',
    );
    expect(result.map((i) => i.id)).toEqual(['high', 'low']);
  });

  it('sorts by next payment due, soonest first, pushing invoices with no due date to the end', () => {
    const result = sortInvoices(
      [
        invoice({ id: 'none', nextDueDate: null }),
        invoice({ id: 'later', nextDueDate: '2026-08-01' }),
        invoice({ id: 'soon', nextDueDate: '2026-05-01' }),
      ],
      'next_due',
      'asc',
    );
    expect(result.map((i) => i.id)).toEqual(['soon', 'later', 'none']);
  });

  it('sorts by created_at in the given direction', () => {
    const result = sortInvoices(
      [
        invoice({ id: 'old', created_at: '2026-01-01T00:00:00Z' }),
        invoice({ id: 'new', created_at: '2026-06-01T00:00:00Z' }),
      ],
      'created_at',
      'desc',
    );
    expect(result.map((i) => i.id)).toEqual(['new', 'old']);
  });

  it('does not mutate the input array', () => {
    const input = [invoice({ id: 'a', balanceCents: 1 }), invoice({ id: 'b', balanceCents: 2 })];
    const copy = [...input];
    sortInvoices(input, 'balance', 'desc');
    expect(input).toEqual(copy);
  });
});
