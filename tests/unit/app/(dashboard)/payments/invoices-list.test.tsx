/**
 * Unit tests for the InvoicesList decomposition.
 *
 * The core risk here is `deriveInvoices` — the pure function that
 * flags an invoice as "overdue" when its due_date is past + the
 * status isn't already paid/cancelled. The UI render is tested
 * lightly via the PaymentsTable's empty + populated branches.
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
  due_date: null,
  created_at: '2026-04-01T00:00:00Z',
  couple: { id: 'c1', name: 'Couple A' },
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
});

describe('InvoicesList', () => {
  const sample: InvoiceWithDerived = {
    ...baseInvoice,
    effectiveStatus: 'sent',
    isOverdue: false,
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
