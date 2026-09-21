/**
 * /payments page header: title row + search toolbar + tab strip.
 *
 * Search has a global "/" keyboard shortcut: pressing slash anywhere
 * outside an input/textarea focuses the search box. Escape inside
 * the search clears + blurs. The shortcut is set up in the parent
 * page via {@link usePaymentsKeyboardShortcut} (separate so we can
 * unit-test it without rendering the full DOM).
 *
 * The Reports tab has neither search nor a "New" action (it's a
 * read-only ledger) — the caller fills the same toolbar row with its
 * own controls via `reportsToolbar` (the period select + Export CSV),
 * so the row is never just an empty box reserving height.
 *
 * @module app/(dashboard)/payments/payments-header
 */
'use client';

import { BarChart3, FileSignature, Plus, Receipt, Search, X } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

import { InvoiceSortMenu } from './invoice-sort-menu';
import type { InvoiceSortOption } from './use-invoice-sort';
import type { PaymentsTab } from './use-payments-shortcut';

export interface PaymentsHeaderProps {
  activeTab: PaymentsTab;
  onTabChange: (tab: PaymentsTab) => void;
  count?: number;
  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  /** Click handler for the "New" button. Every tab opens its builder
   *  modal straight away; the couple is chosen inside the modal. */
  onNew: () => void;
  /** Invoices-tab-only sort control. */
  invoiceSort: InvoiceSortOption;
  onInvoiceSortChange: (option: InvoiceSortOption) => void;
  /** Reports-tab-only toolbar content (period select + Export CSV). */
  reportsToolbar: ReactNode;
}

export function PaymentsHeader({
  activeTab,
  onTabChange,
  count,
  search,
  onSearchChange,
  searchInputRef,
  onNew,
  invoiceSort,
  onInvoiceSortChange,
  reportsToolbar,
}: PaymentsHeaderProps) {
  const newLabel = activeTab === 'invoices' ? 'invoice' : 'contract';
  const showCreate = activeTab !== 'reports';

  const mobileNewButton = showCreate ? (
    <Button onClick={onNew} iconOnly className="sm:hidden" aria-label={`New ${newLabel}`}>
      <Plus size={16} strokeWidth={1.5} />
    </Button>
  ) : null;

  return (
    <div className="px-6 sm:px-[3.75rem] pt-6 pb-2 flex-shrink-0">
      <PageHeader
        title="Payments"
        className="mb-4"
        actions={mobileNewButton}
        {...(count !== undefined ? { count } : {})}
      />

      {/* Toolbar */}
      {activeTab === 'reports' ? (
        <div className="flex items-center gap-2 mt-3 flex-wrap">{reportsToolbar}</div>
      ) : (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="relative w-full sm:w-56">
            <Search
              size={11}
              strokeWidth={1.5}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="block h-8 w-full rounded-control border border-border bg-surface pl-6 pr-6 text-body text-text transition-colors placeholder:text-text-subtle focus-visible:border-brand-fg focus-visible:outline-none"
            />
            {search && (
              <button
                onClick={() => {
                  onSearchChange('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-gray-700 transition cursor-pointer p-0.5"
              >
                <X size={10} strokeWidth={2} />
              </button>
            )}
          </div>

          {activeTab === 'invoices' && (
            <InvoiceSortMenu value={invoiceSort} onChange={onInvoiceSortChange} />
          )}

          <Button onClick={onNew} className="ml-auto hidden sm:inline-flex">
            <Plus size={11} strokeWidth={1.5} />
            New {newLabel}
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border mt-6">
        <TabButton
          active={activeTab === 'invoices'}
          onClick={() => onTabChange('invoices')}
          icon={<Receipt size={15} strokeWidth={1.5} />}
          label="Invoices"
        />
        <TabButton
          active={activeTab === 'contracts'}
          onClick={() => onTabChange('contracts')}
          icon={<FileSignature size={15} strokeWidth={1.5} />}
          label="Contracts"
        />
        <TabButton
          active={activeTab === 'reports'}
          onClick={() => onTabChange('reports')}
          icon={<BarChart3 size={15} strokeWidth={1.5} />}
          label="Reports"
        />
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-2 text-body font-medium transition border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
        active
          ? 'border-gray-900 text-text'
          : 'border-transparent text-text-subtle hover:text-gray-600'
      }`}
    >
      {icon} {label}
    </button>
  );
}
