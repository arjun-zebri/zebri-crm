/**
 * /payments page header: title row + search toolbar + tab strip.
 *
 * Search has a global "/" keyboard shortcut: pressing slash anywhere
 * outside an input/textarea focuses the search box. Escape inside
 * the search clears + blurs. The shortcut is set up in the parent
 * page via {@link usePaymentsKeyboardShortcut} (separate so we can
 * unit-test it without rendering the full DOM).
 *
 * @module app/(dashboard)/payments/payments-header
 */
'use client';

import { FileSignature, FileText, PackageOpen, Plus, Receipt, Search, X } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';

import type { PaymentsTab } from './use-payments-shortcut';

export interface PaymentsHeaderProps {
  activeTab: PaymentsTab;
  onTabChange: (tab: PaymentsTab) => void;
  count: number;
  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  /** Click handler for the "New" button. For the Contracts tab the
   *  parent wires this to a popover trigger via `newButtonOverride`. */
  onNew: () => void;
  /** When the active tab is Contracts the page passes a Popover.Trigger
   *  here so the popover anchors correctly. The header still renders
   *  the standard button if undefined. */
  newButtonOverride?: ReactNode;
}

export function PaymentsHeader({
  activeTab,
  onTabChange,
  count,
  search,
  onSearchChange,
  searchInputRef,
  onNew,
  newButtonOverride,
}: PaymentsHeaderProps) {
  const newLabel =
    activeTab === 'proposals'
      ? 'proposal'
      : activeTab === 'quotes'
        ? 'quote'
        : activeTab === 'invoices'
          ? 'invoice'
          : 'contract';

  const mobileNewButton = newButtonOverride ?? (
    <button
      onClick={onNew}
      className="sm:hidden flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white hover:bg-gray-700 transition cursor-pointer"
      aria-label={`New ${newLabel}`}
    >
      <Plus size={16} strokeWidth={2} />
    </button>
  );

  const desktopNewButton = newButtonOverride ?? (
    <button
      onClick={onNew}
      className="hidden sm:inline-flex items-center gap-1 px-2 py-2 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-700 transition cursor-pointer"
    >
      <Plus size={11} strokeWidth={2} />
      New {newLabel}
    </button>
  );

  return (
    <div className="px-6 sm:px-[3.75rem] pt-6 pb-2 flex-shrink-0">
      {/* Title row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Payments</h1>
          <span className="text-sm text-gray-400">{count} total</span>
        </div>
        {mobileNewButton}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <div className="relative w-full sm:w-56">
          <Search
            size={11}
            strokeWidth={1.5}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full border border-gray-200 rounded-md pl-6 pr-6 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 transition"
          />
          {search && (
            <button
              onClick={() => {
                onSearchChange('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition cursor-pointer p-0.5"
            >
              <X size={10} strokeWidth={2} />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">{desktopNewButton}</div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-gray-200 mt-6">
        <TabButton
          active={activeTab === 'proposals'}
          onClick={() => onTabChange('proposals')}
          icon={<PackageOpen size={15} strokeWidth={1.5} />}
          label="Proposals"
        />
        <TabButton
          active={activeTab === 'quotes'}
          onClick={() => onTabChange('quotes')}
          icon={<FileText size={15} strokeWidth={1.5} />}
          label="Quotes"
        />
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
      className={`pb-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
        active
          ? 'border-gray-900 text-gray-900'
          : 'border-transparent text-gray-400 hover:text-gray-600'
      }`}
    >
      {icon} {label}
    </button>
  );
}
