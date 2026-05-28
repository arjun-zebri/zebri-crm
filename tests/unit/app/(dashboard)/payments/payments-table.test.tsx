/**
 * Unit tests for `PaymentsTable` + the `formatCurrency` export.
 *
 * Walks the populated / empty / loading branches against a tiny
 * row type so the table primitive doesn't have to know about Quote
 * or Invoice domain types.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  formatCurrency,
  PaymentsTable,
  type PaymentsRow,
} from '@/app/(dashboard)/payments/payments-table';

// Use the Quote shape as a stand-in for the table primitive's
// generic — keeps the test code stable while satisfying the
// PaymentsTableItem union.
import type { Quote } from '@/app/(dashboard)/payments/use-payments-data';

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'q1',
    quote_number: 'Q-1',
    title: 'Test Quote',
    status: 'sent',
    subtotal: 1000,
    created_at: '2026-04-01T00:00:00Z',
    couple: { id: 'c1', name: 'Test Couple' },
    ...overrides,
  };
}

function row(q: Quote, opts: { onClick?: () => void } = {}): PaymentsRow {
  return {
    key: q.id,
    onClick: opts.onClick ?? vi.fn(),
    number: q.quote_number,
    title: q.title,
    coupleName: q.couple.name,
    statusPill: <span>{q.status}</span>,
    valueCell: <span>{formatCurrency(q.subtotal)}</span>,
    lastCell: <span>{q.created_at.slice(0, 10)}</span>,
    mobileValueRight: <span>{formatCurrency(q.subtotal)}</span>,
    mobileStatus: <span>{q.status}</span>,
    mobileSecondary: null,
  };
}

describe('PaymentsTable', () => {
  it('renders the empty state when there are no rows', () => {
    render(
      <PaymentsTable
        loading={false}
        rows={[]}
        emptyIcon={<span data-testid="icon" />}
        emptyMessage="Nothing here"
        valueColLabel="Total"
        valueColIcon={<span />}
        lastColLabel="Date"
        lastColIcon={<span />}
        renderRow={row}
      />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders skeleton rows when loading + empty (no empty state)', () => {
    const { container } = render(
      <PaymentsTable
        loading={true}
        rows={[]}
        emptyIcon={<span />}
        emptyMessage="Nothing here"
        valueColLabel="Total"
        valueColIcon={<span />}
        lastColLabel="Date"
        lastColIcon={<span />}
        renderRow={row}
      />,
    );
    // Loading takes precedence — the empty copy isn't shown.
    expect(screen.queryByText('Nothing here')).toBeNull();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('calls onClick when a row is clicked', async () => {
    const onClick = vi.fn();
    render(
      <PaymentsTable
        loading={false}
        rows={[makeQuote()]}
        emptyIcon={<span />}
        emptyMessage="Nothing here"
        valueColLabel="Total"
        valueColIcon={<span />}
        lastColLabel="Date"
        lastColIcon={<span />}
        renderRow={(q) => row(q, { onClick })}
      />,
    );
    // Desktop table is `hidden sm:table` in jsdom — but `display`
    // CSS isn't enforced at the DOM level, so the table cells are
    // still in the tree. Click the rendered title cell.
    await userEvent.click(screen.getAllByText('Test Quote')[0]!);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('formatCurrency', () => {
  it('formats integers as AUD', () => {
    expect(formatCurrency(4900)).toMatch(/\$4,900\.00/);
  });

  it('formats fractional values', () => {
    expect(formatCurrency(49.99)).toMatch(/\$49\.99/);
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toMatch(/\$0\.00/);
  });
});
