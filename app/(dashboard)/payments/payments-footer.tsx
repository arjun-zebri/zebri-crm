/**
 * Fixed-bottom summary bar for the /payments page.
 *
 * Shows the current tab's row count + (for quotes/invoices) the
 * subtotal of the filtered slice. Contracts don't have a money
 * value so the right cell is omitted there.
 *
 * Positioned to clear the desktop sidebar (`md:left-[68px]`).
 *
 * @module app/(dashboard)/payments/payments-footer
 */
'use client';

import { formatCurrency } from './payments-table';
import type { PaymentsTab } from './use-payments-shortcut';

export interface PaymentsFooterProps {
  tab: PaymentsTab;
  count: number;
  /** Money total — pass undefined to omit (e.g. for contracts). */
  total?: number;
}

export function PaymentsFooter({ tab, count, total }: PaymentsFooterProps) {
  const noun =
    tab === 'quotes'
      ? count === 1
        ? 'quote'
        : 'quotes'
      : tab === 'invoices'
        ? count === 1
          ? 'invoice'
          : 'invoices'
        : count === 1
          ? 'contract'
          : 'contracts';

  return (
    <div className="fixed bottom-0 left-0 md:left-[68px] right-0 z-30 bg-white border-t border-gray-100 px-6 py-5 flex items-center justify-between">
      <p className="text-sm text-gray-400">
        {count} {noun}
      </p>
      {total !== undefined && (
        <p className="text-sm font-semibold text-gray-900 tabular-nums">
          {formatCurrency(total)}
        </p>
      )}
    </div>
  );
}
