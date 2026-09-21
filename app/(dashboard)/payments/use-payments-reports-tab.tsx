/**
 * Bundles the Reports tab's date-range state, data fetch, export
 * handler, and toolbar JSX into one call, so `page.tsx` stays a thin
 * orchestrator: it spreads `reportsBodyProps` onto `<PaymentsReports>`
 * and passes `reportsToolbar` straight to `<PaymentsHeader>`.
 *
 * @module app/(dashboard)/payments/use-payments-reports-tab
 */
'use client';

import { toTransactionsCsv } from '@/lib/payments/report-transactions';
import { downloadCsv } from '@/lib/utils/csv';

import { PaymentsReportToolbar } from './payments-report-toolbar';
import { usePaymentsReport } from './use-payments-report';
import { useReportRange } from './use-report-range';

export interface UsePaymentsReportsTabOptions {
  /** Opens the given invoice's builder modal — a ledger row's source doc. */
  onOpenInvoice: (invoiceId: string) => void;
  /** Switches to the Invoices tab pre-sorted by balance due. */
  onViewOutstanding: () => void;
}

export function usePaymentsReportsTab({ onOpenInvoice, onViewOutstanding }: UsePaymentsReportsTabOptions) {
  const { preset, setPreset, customStart, setCustomStart, customEnd, setCustomEnd, range } =
    useReportRange();
  const report = usePaymentsReport(range);

  function handleExport() {
    downloadCsv(toTransactionsCsv(report.transactions, range));
  }

  const reportsToolbar = (
    <PaymentsReportToolbar
      preset={preset}
      onPresetChange={setPreset}
      range={range}
      customStart={customStart}
      onCustomStartChange={setCustomStart}
      customEnd={customEnd}
      onCustomEndChange={setCustomEnd}
      onExport={handleExport}
      exportDisabled={report.transactions.length === 0}
    />
  );

  return { reportsToolbar, reportsBodyProps: { ...report, onOpenInvoice, onViewOutstanding } };
}
