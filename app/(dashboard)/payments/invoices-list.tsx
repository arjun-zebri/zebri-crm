/**
 * Invoices tab content for the /payments page.
 *
 * Adds an "overdue" virtual status: any invoice whose `due_date` is
 * past and isn't already paid/cancelled. The overdue badge replaces
 * the underlying status so the user sees the urgent state, but the
 * raw `status` is kept for downstream logic (search matching, etc.).
 *
 * @module app/(dashboard)/payments/invoices-list
 */
'use client';

import { Receipt } from 'lucide-react';
import type { ReactNode } from 'react';

import { formatCurrency, PaymentsTable, PaymentsTableIcons } from './payments-table';
import type { Invoice } from './use-payments-data';

const INVOICE_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  deposit_paid: 'bg-amber-50 text-amber-600',
  paid: 'bg-emerald-50 text-emerald-600',
  overdue: 'bg-red-50 text-red-600',
  cancelled: 'bg-gray-100 text-gray-400',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  deposit_paid: 'Deposit Paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

export interface InvoiceWithDerived extends Invoice {
  effectiveStatus: string;
  isOverdue: boolean;
}

/**
 * Decorate raw invoices with an `effectiveStatus` (which flips to
 * "overdue" when the due date is past + the invoice isn't already
 * paid/cancelled) and a boolean `isOverdue` for styling. Pure — safe
 * to call inside a render.
 */
export function deriveInvoices(invoices: Invoice[]): InvoiceWithDerived[] {
  return invoices.map((inv) => {
    const isOverdue = Boolean(
      inv.due_date &&
        new Date(inv.due_date + 'T00:00:00') < new Date() &&
        !['paid', 'cancelled'].includes(inv.status),
    );
    return {
      ...inv,
      effectiveStatus: isOverdue ? 'overdue' : inv.status,
      isOverdue,
    };
  });
}

function pill(status: string, opts?: { wrap?: boolean }): ReactNode {
  const className = `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium${opts?.wrap === false ? ' whitespace-nowrap' : ''} ${INVOICE_STATUS_STYLES[status] || INVOICE_STATUS_STYLES.draft}`;
  return <span className={className}>{INVOICE_STATUS_LABELS[status] || status}</span>;
}

export interface InvoicesListProps {
  loading: boolean;
  invoices: InvoiceWithDerived[];
  searching: boolean;
  onOpen: (invoiceId: string) => void;
}

export function InvoicesList({ loading, invoices, searching, onOpen }: InvoicesListProps) {
  return (
    <PaymentsTable
      loading={loading}
      rows={invoices}
      emptyIcon={<Receipt size={32} strokeWidth={1} className="text-gray-200 mx-auto mb-3" />}
      emptyMessage={
        searching ? 'No invoices match your search.' : 'No invoices yet. Create one to get started.'
      }
      lastColLabel="Due"
      lastColIcon={PaymentsTableIcons.Calendar}
      valueColLabel="Total"
      valueColIcon={PaymentsTableIcons.Dollar}
      renderRow={(invoice) => ({
        key: invoice.id,
        onClick: () => onOpen(invoice.id),
        number: invoice.invoice_number,
        title: invoice.title,
        coupleName: invoice.couple.name,
        statusPill: pill(invoice.effectiveStatus, { wrap: false }),
        valueCell: (
          <span className="text-sm text-gray-500 group-hover:text-gray-900 tabular-nums">
            {formatCurrency(invoice.subtotal)}
          </span>
        ),
        lastCell: (
          <span
            className={`text-sm ${
              invoice.isOverdue ? 'text-red-500 font-medium' : 'text-gray-500 group-hover:text-gray-900'
            }`}
          >
            {invoice.due_date
              ? new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                })
              : ' - '}
          </span>
        ),
        mobileValueRight: (
          <span className="text-sm font-medium text-gray-900 tabular-nums shrink-0">
            {formatCurrency(invoice.subtotal)}
          </span>
        ),
        mobileStatus: pill(invoice.effectiveStatus, { wrap: false }),
        mobileSecondary: invoice.due_date ? (
          <>
            <span className="text-gray-300 shrink-0">·</span>
            <span
              className={`text-xs shrink-0 ${
                invoice.isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'
              }`}
            >
              {new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          </>
        ) : null,
      })}
    />
  );
}
