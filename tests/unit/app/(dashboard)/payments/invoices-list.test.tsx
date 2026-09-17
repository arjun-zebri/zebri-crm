/**
 * Unit tests for the InvoicesList decomposition.
 *
 * The core risk here is `deriveInvoices` — the pure function that
 * flags an invoice as "overdue" when its next payment (a stage's due
 * date, or the invoice's own due_date if stageless) is past and the
 * status isn't already paid/cancelled — plus attaches the balance the
 * Balance column reads. The UI render is tested lightly via the
 * PaymentsTable's empty + populated branches.
 */
import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  deriveInvoices,
  InvoicesList,
  type InvoiceWithDerived,
} from '@/app/(dashboard)/payments/invoices-list';

const baseInvoice = {
  id: 'inv_1',
  invoice_number: 'INV-001',
  title: 'Ceremony',
  status: 'sent',
  subtotal: 5000,
  tax_rate: 0,
  discount_type: null,
  discount_value: null,
  due_date: null,
  paid_at: null,
  created_at: '2026-04-01T00:00:00Z',
  couple: { id: 'c1', name: 'Couple A' },
  invoice_payment_stages: [],
};

describe('deriveInvoices', () => {
  beforeAll(() => {
    // Pin "now" so due-date comparisons are deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T00:00:00Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('flags an invoice with a past due_date as overdue', () => {
    const [d] = deriveInvoices([
      { ...baseInvoice, due_date: '2026-05-01' },
    ]);
    expect(d?.isOverdue).toBe(true);
    expect(d?.effectiveStatus).toBe('overdue');
  });

  it('does not flag paid invoices as overdue even if due_date is past', () => {
    const [d] = deriveInvoices([
      { ...baseInvoice, status: 'paid', due_date: '2026-05-01' },
    ]);
    expect(d?.isOverdue).toBe(false);
    expect(d?.effectiveStatus).toBe('paid');
  });

  it('does not flag cancelled invoices as overdue', () => {
    const [d] = deriveInvoices([
      { ...baseInvoice, status: 'cancelled', due_date: '2026-05-01' },
    ]);
    expect(d?.isOverdue).toBe(false);
    expect(d?.effectiveStatus).toBe('cancelled');
  });

  it('does not flag invoices with no due_date as overdue', () => {
    const [d] = deriveInvoices([{ ...baseInvoice, due_date: null }]);
    expect(d?.isOverdue).toBe(false);
  });

  it('does not flag invoices with a future due_date as overdue', () => {
    const [d] = deriveInvoices([
      { ...baseInvoice, due_date: '2026-12-31' },
    ]);
    expect(d?.isOverdue).toBe(false);
  });

  it('does NOT flag an invoice due *today* as overdue', () => {
    // Regression: the old `< new Date()` comparison pitted the due
    // date's midnight against the current instant, so anything due
    // today flipped to overdue the moment midnight passed. Overdue
    // must begin the day *after* the due date.
    const [d] = deriveInvoices([
      { ...baseInvoice, due_date: '2026-05-22' },
    ]);
    expect(d?.isOverdue).toBe(false);
    expect(d?.effectiveStatus).toBe('sent');
  });

  it('flags an invoice due *yesterday* as overdue (boundary)', () => {
    const [d] = deriveInvoices([
      { ...baseInvoice, due_date: '2026-05-21' },
    ]);
    expect(d?.isOverdue).toBe(true);
  });

  it('preserves the raw status separately from effectiveStatus', () => {
    const [d] = deriveInvoices([
      { ...baseInvoice, status: 'sent', due_date: '2026-05-01' },
    ]);
    expect(d?.status).toBe('sent');
    expect(d?.effectiveStatus).toBe('overdue');
  });

  it('attaches the full balance for an unpaid stageless invoice', () => {
    const [d] = deriveInvoices([{ ...baseInvoice, subtotal: 5000 }]);
    expect(d?.balanceCents).toBe(500000);
    expect(d?.nextDueDate).toBeNull();
  });

  it('attaches a zero balance for a paid invoice', () => {
    const [d] = deriveInvoices([{ ...baseInvoice, status: 'paid', paid_at: '2026-04-05T00:00:00Z' }]);
    expect(d?.balanceCents).toBe(0);
  });

  it('uses the soonest unpaid stage due date as nextDueDate, and flags overdue from it', () => {
    const [d] = deriveInvoices([
      {
        ...baseInvoice,
        due_date: '2026-12-31', // stale invoice-level due date, should be ignored once staged
        invoice_payment_stages: [
          { amount_cents: 250000, paid_at: '2026-04-10T00:00:00Z', due_date: '2026-04-10', label: 'Deposit' },
          { amount_cents: 250000, paid_at: null, due_date: '2026-05-01', label: 'Final payment' },
        ],
      },
    ]);
    expect(d?.balanceCents).toBe(250000);
    expect(d?.nextDueDate).toBe('2026-05-01');
    expect(d?.isOverdue).toBe(true);
    expect(d?.effectiveStatus).toBe('overdue');
  });
});

describe('InvoicesList', () => {
  const sample: InvoiceWithDerived = {
    ...baseInvoice,
    effectiveStatus: 'sent',
    isOverdue: false,
    balanceCents: 500000,
    nextDueDate: null,
  };

  it('renders the empty state when there are no rows and no search', () => {
    render(
      <InvoicesList loading={false} invoices={[]} searching={false} onOpen={vi.fn()} />,
    );
    expect(screen.getByText(/No invoices yet/i)).toBeInTheDocument();
  });

  it('renders the searching-empty copy when filter is active and matches nothing', () => {
    render(
      <InvoicesList loading={false} invoices={[]} searching={true} onOpen={vi.fn()} />,
    );
    expect(screen.getByText(/No invoices match your search/i)).toBeInTheDocument();
  });

  it('renders the invoice number on a populated row', () => {
    render(
      <InvoicesList
        loading={false}
        invoices={[sample]}
        searching={false}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getAllByText('INV-001').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the loading state without errors', () => {
    const { container } = render(
      <InvoicesList loading={true} invoices={[]} searching={false} onOpen={vi.fn()} />,
    );
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });
});
