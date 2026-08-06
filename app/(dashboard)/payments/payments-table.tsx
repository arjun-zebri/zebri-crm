/**
 * Shared presentation primitive for the /payments page lists.
 *
 * Desktop renders a fixed-column table; mobile renders the same rows
 * as a vertically-stacked card list. Each tab (Invoices / Contracts)
 * passes a `renderRow` callback that maps its domain type to the
 * cells the table needs.
 *
 * Loading state shows skeleton rows in the same shape so swap-in
 * doesn't reflow. Empty state shows a per-tab icon + message.
 *
 * @module app/(dashboard)/payments/payments-table
 */
'use client';

import { Calendar, DollarSign, Hash, ListChecks, Users } from 'lucide-react';
import type { ReactNode } from 'react';

import type { Invoice, Contract } from './use-payments-data';

const COL_WIDTHS = {
  number: '11%',
  title: '26%',
  couple: '22%',
  status: '14%',
  value: '13%',
  last: '14%',
} as const;

/** The shape every row provider returns. Mobile + desktop pull cells
 *  from this object — keeping it flat makes the renderRow callbacks
 *  in each list easy to read. */
export interface PaymentsRow {
  key: string;
  onClick: () => void;
  number: string;
  title: string;
  coupleName: string;
  statusPill: ReactNode;
  valueCell: ReactNode;
  lastCell: ReactNode;
  mobileValueRight: ReactNode;
  mobileStatus: ReactNode;
  mobileSecondary: ReactNode;
}

/** Domain types that can populate this table. */
export type PaymentsTableItem = Invoice | Contract;

export interface PaymentsTableProps<T extends PaymentsTableItem> {
  loading: boolean;
  rows: T[];
  emptyIcon: ReactNode;
  emptyMessage: string;
  valueColLabel: string;
  valueColIcon: ReactNode;
  lastColLabel: string;
  lastColIcon: ReactNode;
  renderRow: (row: T) => PaymentsRow;
}

function HeaderLabel({
  icon,
  label,
  textOnly,
}: {
  icon?: ReactNode;
  label: string;
  textOnly?: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      {textOnly ? <span className="text-[11px]">{textOnly}</span> : icon}
      {label}
    </span>
  );
}

export function PaymentsTable<T extends PaymentsTableItem>({
  loading,
  rows,
  emptyIcon,
  emptyMessage,
  valueColLabel,
  valueColIcon,
  lastColLabel,
  lastColIcon,
  renderRow,
}: PaymentsTableProps<T>) {
  if (!loading && rows.length === 0) {
    return (
      <div className="py-16 text-center">
        {emptyIcon}
        <p className="text-body text-text-subtle">{emptyMessage}</p>
      </div>
    );
  }

  const mapped = rows.map(renderRow);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
        {/* Mobile card list */}
        <div className="sm:hidden">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse flex items-start justify-between py-3.5 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1 pr-3">
                    <div className="h-4 bg-surface-emphasis rounded-control w-36 mb-1.5" />
                    <div className="h-3 bg-surface-emphasis rounded-control w-24" />
                  </div>
                  <div className="h-5 bg-surface-emphasis rounded-pill w-16" />
                </div>
              ))
            : mapped.map((r) => (
                <div
                  key={r.key}
                  onClick={r.onClick}
                  className="flex items-start justify-between gap-3 py-3.5 border-b border-gray-100 last:border-0 cursor-pointer active:bg-gray-50 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-caption font-medium text-text-subtle shrink-0">{r.number}</span>
                      {r.mobileStatus}
                    </div>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-body text-text truncate">{r.title}</span>
                      <span className="text-gray-300 shrink-0">·</span>
                      <span className="text-body text-text-muted truncate shrink-0 max-w-[140px]">
                        {r.coupleName}
                      </span>
                      {r.mobileSecondary}
                    </div>
                  </div>
                  {r.mobileValueRight}
                </div>
              ))}
        </div>

        {/* Desktop table */}
        <table className="hidden sm:table w-full table-fixed border-separate border-spacing-0 min-w-[600px] md:max-w-[1800px]">
          <thead className="sticky top-0 bg-surface z-10 [box-shadow:0_1px_0_rgb(229,231,235)]">
            <tr>
              <th
                className="pl-0 pr-2 py-1.5 text-left text-caption font-normal text-text-subtle"
                style={{ width: COL_WIDTHS.number }}
              >
                <HeaderLabel icon={<Hash size={12} strokeWidth={1.5} />} label="Number" />
              </th>
              <th
                className="pl-0 pr-2 py-1.5 text-left text-caption font-normal text-text-subtle"
                style={{ width: COL_WIDTHS.title }}
              >
                <HeaderLabel textOnly="Aa" label="Title" />
              </th>
              <th
                className="pl-0 pr-2 py-1.5 text-left text-caption font-normal text-text-subtle"
                style={{ width: COL_WIDTHS.couple }}
              >
                <HeaderLabel icon={<Users size={12} strokeWidth={1.5} />} label="Couple" />
              </th>
              <th
                className="pl-0 pr-2 py-1.5 text-left text-caption font-normal text-text-subtle"
                style={{ width: COL_WIDTHS.status }}
              >
                <HeaderLabel icon={<ListChecks size={12} strokeWidth={1.5} />} label="Status" />
              </th>
              <th
                className="pl-0 pr-2 py-1.5 text-left text-caption font-normal text-text-subtle"
                style={{ width: COL_WIDTHS.value }}
              >
                <HeaderLabel icon={valueColIcon} label={valueColLabel} />
              </th>
              <th
                className="pl-0 pr-2 py-1.5 text-left text-caption font-normal text-text-subtle"
                style={{ width: COL_WIDTHS.last }}
              >
                <HeaderLabel icon={lastColIcon} label={lastColLabel} />
              </th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[0, 1, 2, 3, 4, 5].map((j) => (
                      <td key={j} className="pl-0 pr-2 py-2 border-b border-gray-100">
                        <div className="h-4 bg-surface-emphasis rounded-control w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              : mapped.map((r, idx) => {
                  const isLast = idx === mapped.length - 1;
                  const borderClass = isLast ? '' : 'border-b border-gray-100';
                  return (
                    <tr
                      key={r.key}
                      onClick={r.onClick}
                      className="cursor-pointer transition group hover:bg-gray-50/60"
                    >
                      <td
                        className={`pl-0 pr-2 py-2 text-body overflow-hidden ${borderClass}`}
                        style={{ width: COL_WIDTHS.number }}
                      >
                        <span className="text-body text-text-muted group-hover:text-text truncate block">
                          {r.number}
                        </span>
                      </td>
                      <td
                        className={`pl-0 pr-2 py-2 text-body overflow-hidden ${borderClass}`}
                        style={{ width: COL_WIDTHS.title }}
                      >
                        <span className="text-body text-text-muted group-hover:text-text truncate block">
                          {r.title}
                        </span>
                      </td>
                      <td
                        className={`pl-0 pr-2 py-2 text-body overflow-hidden ${borderClass}`}
                        style={{ width: COL_WIDTHS.couple }}
                      >
                        <span className="text-body text-text-muted group-hover:text-text truncate block">
                          {r.coupleName}
                        </span>
                      </td>
                      <td
                        className={`pl-0 pr-2 py-2 text-body ${borderClass}`}
                        style={{ width: COL_WIDTHS.status }}
                      >
                        {r.statusPill}
                      </td>
                      <td
                        className={`pl-0 pr-2 py-2 text-body overflow-hidden ${borderClass}`}
                        style={{ width: COL_WIDTHS.value }}
                      >
                        {r.valueCell}
                      </td>
                      <td
                        className={`pl-0 pr-3 py-2 text-body overflow-hidden ${borderClass}`}
                        style={{ width: COL_WIDTHS.last }}
                      >
                        {r.lastCell}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Convenience: re-export the calendar/dollar icons used by callers
 *  so they don't need to import lucide directly. Keeps the public
 *  surface of this module self-contained. */
export const PaymentsTableIcons = {
  Calendar: <Calendar size={12} strokeWidth={1.5} />,
  Dollar: <DollarSign size={12} strokeWidth={1.5} />,
};

/** Shared currency formatter. AUD because we're an Australian product. */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}
