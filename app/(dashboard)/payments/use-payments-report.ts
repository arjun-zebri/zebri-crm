/**
 * Data hook behind the Payments Reports tab: a cash-basis income
 * ledger (payments actually received in the selected date range,
 * GST split out) plus a snapshot of everything still outstanding.
 *
 * Reuses `useInvoices()` — the same query already powers the
 * Invoices tab's balance column, so there is one source of invoice
 * data for the whole page and no second Supabase round-trip.
 *
 * @module app/(dashboard)/payments/use-payments-report
 */
'use client';

import { useMemo } from 'react';

import type { DateRange } from '@/lib/payments/financial-year';
import { getInvoiceBalanceFromDb } from '@/lib/payments/invoice-balance';
import {
  filterTransactionsByDate,
  getInvoiceTransactions,
  summarizeTransactions,
  type PaymentTransaction,
} from '@/lib/payments/report-transactions';

import { useInvoices } from './use-payments-data';

export interface PaymentsReportData {
  isLoading: boolean;
  /** Payments received within `range`, most recent first. */
  transactions: PaymentTransaction[];
  summary: { grossCents: number; netCents: number; gstCents: number };
  /** Total still owed across every non-cancelled invoice, regardless
   *  of `range` — this is a snapshot of "right now", not a period total. */
  outstandingCents: number;
}

/** Build the report for the given date range from the current invoices. */
export function usePaymentsReport(range: DateRange): PaymentsReportData {
  const { data: invoices, isLoading } = useInvoices();

  return useMemo(() => {
    const list = invoices ?? [];

    const allTransactions = list.flatMap((inv) =>
      getInvoiceTransactions(inv, inv.invoice_payment_stages),
    );
    const transactions = filterTransactionsByDate(allTransactions, range).sort((a, b) =>
      b.paidAt.localeCompare(a.paidAt),
    );

    const outstandingCents = list.reduce(
      (sum, inv) => sum + getInvoiceBalanceFromDb(inv, inv.invoice_payment_stages).balanceCents,
      0,
    );

    return { isLoading, transactions, summary: summarizeTransactions(transactions), outstandingCents };
  }, [invoices, isLoading, range]);
}
