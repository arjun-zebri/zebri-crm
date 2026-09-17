/**
 * The transaction ledger table for the Payments Reports tab: one row
 * per payment received in the selected period, net/GST/gross columns,
 * with a totals row. Clicking a row opens its source invoice — the
 * same "jump to the record" behaviour every other list in the app has.
 *
 * @module app/(dashboard)/payments/payments-report-table
 */
'use client';

import { Receipt } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { summarizeTransactions, type PaymentTransaction } from '@/lib/payments/report-transactions';

import { formatCurrency } from './payments-table';

export interface PaymentsReportTableProps {
  transactions: PaymentTransaction[];
  onOpenInvoice: (invoiceId: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

const CELL = 'pl-0 pr-2 py-2 text-body';

export function PaymentsReportTable({ transactions, onOpenInvoice }: PaymentsReportTableProps) {
  if (transactions.length === 0) {
    return (
      <Empty
        icon={Receipt}
        title="No payments in this period"
        description="Payments received in the selected range will appear here."
        size="sm"
      />
    );
  }

  const totals = summarizeTransactions(transactions);

  return (
    <Card padding="none" className="overflow-x-auto">
      <table className="w-full min-w-[600px] border-separate border-spacing-0">
        <thead>
          <tr className="[box-shadow:0_1px_0_rgb(229,231,235)]">
            {['Date', 'Invoice', 'Couple', 'Description', 'Net', 'GST', 'Gross'].map((label) => (
              <th key={label} className={`${CELL} pl-4 text-left font-normal text-text-subtle`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((t, i) => (
            <tr
              key={`${t.invoiceId}-${t.paidAt}-${i}`}
              onClick={() => onOpenInvoice(t.invoiceId)}
              className="cursor-pointer transition hover:bg-gray-50/60"
            >
              <td className={`${CELL} pl-4 text-text-muted border-b border-gray-100`}>{formatDate(t.paidAt)}</td>
              <td className={`${CELL} text-text-muted border-b border-gray-100`}>{t.invoiceNumber}</td>
              <td className={`${CELL} text-text-muted border-b border-gray-100 truncate`}>{t.coupleName}</td>
              <td className={`${CELL} text-text-muted border-b border-gray-100`}>{t.description}</td>
              <td className={`${CELL} text-text-muted border-b border-gray-100 tabular-nums`}>
                {formatCurrency(t.netCents / 100)}
              </td>
              <td className={`${CELL} text-text-muted border-b border-gray-100 tabular-nums`}>
                {formatCurrency(t.gstCents / 100)}
              </td>
              <td className={`${CELL} pr-4 text-text font-medium border-b border-gray-100 tabular-nums`}>
                {formatCurrency(t.grossCents / 100)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={`${CELL} pl-4 font-medium text-text`} colSpan={4}>
              Total
            </td>
            <td className={`${CELL} font-medium text-text tabular-nums`}>{formatCurrency(totals.netCents / 100)}</td>
            <td className={`${CELL} font-medium text-text tabular-nums`}>{formatCurrency(totals.gstCents / 100)}</td>
            <td className={`${CELL} pr-4 font-semibold text-text tabular-nums`}>
              {formatCurrency(totals.grossCents / 100)}
            </td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}
