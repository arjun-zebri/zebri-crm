/**
 * Reports tab body for /payments: summary tiles + the payment ledger.
 *
 * A cash-basis income report for tax time — built around what an MC
 * actually needs when they aren't running accounting software: GST
 * collected for BAS, and a per-payment ledger. The period select +
 * Export CSV live in the page header's toolbar row
 * (`payments-report-toolbar.tsx`) — this component only renders what
 * the *result* of that period looks like. See `.claude/docs/payments.md`
 * "Invoice balance + the Payments Reports tab".
 *
 * @module app/(dashboard)/payments/payments-reports
 */
'use client';

import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';

import { PaymentsReportTable } from './payments-report-table';
import { formatCurrency } from './payments-table';
import type { PaymentsReportData } from './use-payments-report';

export interface PaymentsReportsProps extends PaymentsReportData {
  /** Opens the given invoice's builder modal — a ledger row's source doc. */
  onOpenInvoice: (invoiceId: string) => void;
  /** Switches to the Invoices tab pre-sorted by balance due. */
  onViewOutstanding: () => void;
}

function StatTile({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  /** Outstanding money reads as a caution, not a plain fact. */
  warn?: boolean;
}) {
  return (
    <Card>
      <p className="text-body text-text-muted">{label}</p>
      <p
        className={`mt-1 text-section font-semibold tabular-nums ${warn ? 'text-warning' : 'text-text'}`}
      >
        {value}
      </p>
    </Card>
  );
}

export function PaymentsReports({
  isLoading,
  transactions,
  summary,
  outstandingCents,
  onOpenInvoice,
  onViewOutstanding,
}: PaymentsReportsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Collected (this period)" value={formatCurrency(summary.grossCents / 100)} />
        <StatTile label="GST collected" value={formatCurrency(summary.gstCents / 100)} />
        <StatTile label="Net (ex GST)" value={formatCurrency(summary.netCents / 100)} />
        <button onClick={onViewOutstanding} className="w-full text-left">
          <StatTile
            label="Outstanding (all time)"
            value={formatCurrency(outstandingCents / 100)}
            warn={outstandingCents > 0}
          />
        </button>
      </div>

      {isLoading ? (
        <Loading label="Loading payments" />
      ) : (
        <PaymentsReportTable transactions={transactions} onOpenInvoice={onOpenInvoice} />
      )}
    </div>
  );
}
