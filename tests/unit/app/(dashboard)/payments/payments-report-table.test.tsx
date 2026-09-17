/**
 * Unit tests for `PaymentsReportTable`: the empty state, the totals
 * footer row's arithmetic, and that a row click opens its invoice.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PaymentsReportTable } from '@/app/(dashboard)/payments/payments-report-table';
import type { PaymentTransaction } from '@/lib/payments/report-transactions';

const transactions: PaymentTransaction[] = [
  {
    invoiceId: 'inv_1',
    invoiceNumber: 'INV-001',
    coupleName: 'Michael and Tara',
    description: 'Deposit',
    paidAt: '2026-08-02T00:00:00Z',
    grossCents: 15000,
    gstCents: 1500,
    netCents: 13500,
  },
  {
    invoiceId: 'inv_1',
    invoiceNumber: 'INV-001',
    coupleName: 'Michael and Tara',
    description: 'Payment 3',
    paidAt: '2026-08-02T00:00:00Z',
    grossCents: 15000,
    gstCents: 1500,
    netCents: 13500,
  },
];

describe('PaymentsReportTable', () => {
  it('renders the empty state when there are no transactions', () => {
    render(<PaymentsReportTable transactions={[]} onOpenInvoice={vi.fn()} />);
    expect(screen.getByText(/No payments in this period/i)).toBeInTheDocument();
  });

  it('renders a totals row summing net/GST/gross', () => {
    render(<PaymentsReportTable transactions={transactions} onOpenInvoice={vi.fn()} />);
    // Two $150 gross rows -> $300.00 total gross; $30.00 GST; $270.00 net.
    expect(screen.getByText('$300.00')).toBeInTheDocument();
    expect(screen.getByText('$270.00')).toBeInTheDocument();
    expect(screen.getByText('$30.00')).toBeInTheDocument();
  });

  it('calls onOpenInvoice with the row invoice id when a row is clicked', async () => {
    const onOpenInvoice = vi.fn();
    render(<PaymentsReportTable transactions={transactions} onOpenInvoice={onOpenInvoice} />);
    await userEvent.click(screen.getByText('Deposit'));
    expect(onOpenInvoice).toHaveBeenCalledWith('inv_1');
  });
});
