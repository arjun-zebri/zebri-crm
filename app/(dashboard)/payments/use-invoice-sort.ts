/**
 * Sort state + comparator for the Invoices tab of /payments.
 *
 * Split out from the page so the sort logic is unit-testable without
 * rendering the table, matching the pattern already used for couples
 * (`app/(dashboard)/couples/use-couples-view.ts`).
 *
 * @module app/(dashboard)/payments/use-invoice-sort
 */
'use client';

import { useMemo, useState } from 'react';

import type { InvoiceWithDerived } from './invoices-list';

export type InvoiceSortField = 'balance' | 'next_due' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export interface InvoiceSortOption {
  label: string;
  field: InvoiceSortField;
  direction: SortDirection;
}

export const INVOICE_SORT_OPTIONS: InvoiceSortOption[] = [
  { label: 'Balance due (highest)', field: 'balance', direction: 'desc' },
  { label: 'Next payment due (soonest)', field: 'next_due', direction: 'asc' },
  { label: 'Newest first', field: 'created_at', direction: 'desc' },
  { label: 'Oldest first', field: 'created_at', direction: 'asc' },
];

const DEFAULT_SORT = INVOICE_SORT_OPTIONS[2] as InvoiceSortOption; // Newest first

/** The "Balance due (highest)" option — the Reports tab's Outstanding tile jumps here. */
export const BALANCE_DUE_SORT = INVOICE_SORT_OPTIONS[0] as InvoiceSortOption;

/**
 * Sort invoices by the given field/direction. A missing "next due"
 * date sorts to the end regardless of direction — an invoice with
 * nothing left to schedule shouldn't jump to the top of "soonest".
 */
export function sortInvoices(
  invoices: InvoiceWithDerived[],
  field: InvoiceSortField,
  direction: SortDirection,
): InvoiceWithDerived[] {
  const dir = direction === 'asc' ? 1 : -1;
  return [...invoices].sort((a, b) => {
    if (field === 'balance') return (a.balanceCents - b.balanceCents) * dir;
    if (field === 'next_due') {
      if (a.nextDueDate === null && b.nextDueDate === null) return 0;
      if (a.nextDueDate === null) return 1;
      if (b.nextDueDate === null) return -1;
      return a.nextDueDate.localeCompare(b.nextDueDate) * dir;
    }
    return a.created_at.localeCompare(b.created_at) * dir;
  });
}

/** Sort state for the Invoices tab, defaulting to newest-first. */
export function useInvoiceSort(invoices: InvoiceWithDerived[]) {
  const [sort, setSort] = useState<InvoiceSortOption>(DEFAULT_SORT);

  const sorted = useMemo(
    () => sortInvoices(invoices, sort.field, sort.direction),
    [invoices, sort],
  );

  return { sort, setSort, sortedInvoices: sorted };
}
