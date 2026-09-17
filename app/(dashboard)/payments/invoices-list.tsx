/**
 * Invoices tab content for the /payments page.
 *
 * Adds an "overdue" virtual status: any invoice whose next payment
 * (the soonest unpaid stage, or the invoice's own due date for a
 * stageless invoice) is past and isn't already paid/cancelled. The
 * overdue badge replaces the underlying status so the user sees the
 * urgent state, but the raw `status` is kept for downstream logic
 * (search matching, etc.).
 *
 * @module app/(dashboard)/payments/invoices-list
 */
'use client';

import { Receipt } from 'lucide-react';
import type { ReactNode } from 'react';

import { getInvoiceBalanceFromDb } from '@/lib/payments/invoice-balance';
import { isPastDue } from '@/lib/utils';

import { formatCurrency, PaymentsTable, PaymentsTableIcons } from './payments-table';
import type { Invoice } from './use-payments-data';

const INVOICE_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-surface-emphasis text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  deposit_paid: 'bg-amber-50 text-amber-600',
  paid: 'bg-emerald-50 text-emerald-600',
  overdue: 'bg-red-50 text-red-600',
  cancelled: 'bg-surface-emphasis text-text-subtle',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  deposit_paid: 'Part paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

export interface InvoiceWithDerived extends Invoice {
  effectiveStatus: string;
  isOverdue: boolean;
  /** What's left to pay, in cents (0 once fully paid or cancelled). */
  balanceCents: number;
  /** The soonest unpaid due date — a stage's if staged, else the invoice's own. */
  nextDueDate: string | null;
}

/**
 * Decorate raw invoices with their balance (via {@link getInvoiceBalance}),
 * an `effectiveStatus` (which flips to "overdue" when the next payment
 * is past due and the invoice isn't already paid/cancelled), and a
 * boolean `isOverdue` for styling. Pure — safe to call inside a render.
 */
export function deriveInvoices(invoices: Invoice[]): InvoiceWithDerived[] {
  return invoices.map((inv) => {
    const balance = getInvoiceBalanceFromDb(inv, inv.invoice_payment_stages);
    const isOverdue = Boolean(
      isPastDue(balance.nextDueDate) && !['paid', 'cancelled'].includes(inv.status),
    );
    return {
      ...inv,
      effectiveStatus: isOverdue ? 'overdue' : inv.status,
      isOverdue,
      balanceCents: balance.balanceCents,
      nextDueDate: balance.nextDueDate,
    };
  });
}

function pill(status: string, opts?: { wrap?: boolean }): ReactNode {
  const className = `inline-flex items-center px-2 py-0.5 rounded-pill text-body font-medium${opts?.wrap === false ? ' whitespace-nowrap' : ''} ${INVOICE_STATUS_STYLES[status] || INVOICE_STATUS_STYLES.draft}`;
  return <span className={className}>{INVOICE_STATUS_LABELS[status] || status}</span>;
}

function formatDueDate(date: string | null): string {
  if (!date) return ' - ';
  return new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

/** "Balance" column value: the outstanding amount, or a quiet "Paid" once settled. */
function balanceLabel(invoice: InvoiceWithDerived): ReactNode {
  if (invoice.status === 'cancelled') return ' - ';
  if (invoice.balanceCents === 0) return <span className="text-success">Paid</span>;
  return formatCurrency(invoice.balanceCents / 100);
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
      lastColLabel="Next due"
      lastColIcon={PaymentsTableIcons.Calendar}
      valueColLabel="Balance"
      valueColIcon={PaymentsTableIcons.Dollar}
      renderRow={(invoice) => ({
        key: invoice.id,
        onClick: () => onOpen(invoice.id),
        number: invoice.invoice_number,
        title: invoice.title,
        coupleName: invoice.couple.name,
        statusPill: pill(invoice.effectiveStatus, { wrap: false }),
        valueCell: (
          <span className="text-body text-text-muted group-hover:text-text tabular-nums">
            {balanceLabel(invoice)}
          </span>
        ),
        lastCell: (
          <span
            className={`text-body ${
              invoice.isOverdue ? 'text-red-500 font-medium' : 'text-text-muted group-hover:text-text'
            }`}
          >
            {formatDueDate(invoice.nextDueDate)}
          </span>
        ),
        mobileValueRight: (
          <span className="text-body font-medium text-text tabular-nums shrink-0">
            {balanceLabel(invoice)}
          </span>
        ),
        mobileStatus: pill(invoice.effectiveStatus, { wrap: false }),
        mobileSecondary: invoice.nextDueDate ? (
          <>
            <span className="text-gray-300 shrink-0">·</span>
            <span
              className={`text-body shrink-0 ${
                invoice.isOverdue ? 'text-red-500 font-medium' : 'text-text-subtle'
              }`}
            >
              {formatDueDate(invoice.nextDueDate)}
            </span>
          </>
        ) : null,
      })}
    />
  );
}
