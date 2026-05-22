/**
 * Quotes tab content for the /payments page.
 *
 * Renders the shared {@link PaymentsTable} with quote-specific row
 * cells (subtotal, created date, quote status pill). Filtering is
 * done in the parent so the count + total in the footer can read
 * the same filtered slice without re-running the query.
 *
 * @module app/(dashboard)/payments/quotes-list
 */
'use client';

import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';

import { formatCurrency, PaymentsTable, PaymentsTableIcons } from './payments-table';
import type { Quote } from './use-payments-data';

const QUOTE_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  accepted: 'bg-emerald-50 text-emerald-600',
  declined: 'bg-red-50 text-red-600',
  expired: 'bg-gray-100 text-gray-500',
};

function statusPill(status: string): ReactNode {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${QUOTE_STATUS_STYLES[status] || QUOTE_STATUS_STYLES.draft}`}
    >
      {status}
    </span>
  );
}

function statusPillNoWrap(status: string): ReactNode {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${QUOTE_STATUS_STYLES[status] || QUOTE_STATUS_STYLES.draft}`}
    >
      {status}
    </span>
  );
}

export interface QuotesListProps {
  loading: boolean;
  quotes: Quote[];
  searching: boolean;
  onOpen: (quoteId: string) => void;
}

export function QuotesList({ loading, quotes, searching, onOpen }: QuotesListProps) {
  return (
    <PaymentsTable
      loading={loading}
      rows={quotes}
      emptyIcon={<FileText size={32} strokeWidth={1} className="text-gray-200 mx-auto mb-3" />}
      emptyMessage={
        searching ? 'No quotes match your search.' : 'No quotes yet. Create one to get started.'
      }
      lastColLabel="Date"
      lastColIcon={PaymentsTableIcons.Calendar}
      valueColLabel="Total"
      valueColIcon={PaymentsTableIcons.Dollar}
      renderRow={(quote) => ({
        key: quote.id,
        onClick: () => onOpen(quote.id),
        number: quote.quote_number,
        title: quote.title,
        coupleName: quote.couple.name,
        statusPill: statusPill(quote.status),
        valueCell: (
          <span className="text-sm text-gray-500 group-hover:text-gray-900 tabular-nums">
            {formatCurrency(quote.subtotal)}
          </span>
        ),
        lastCell: (
          <span className="text-sm text-gray-500 group-hover:text-gray-900">
            {new Date(quote.created_at).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        ),
        mobileValueRight: (
          <span className="text-sm font-medium text-gray-900 tabular-nums shrink-0">
            {formatCurrency(quote.subtotal)}
          </span>
        ),
        mobileStatus: statusPillNoWrap(quote.status),
        mobileSecondary: null,
      })}
    />
  );
}
