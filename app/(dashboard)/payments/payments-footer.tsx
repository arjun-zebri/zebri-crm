/**
 * Fixed-bottom summary bar for the /payments page.
 *
 * Shows the current tab's row count + (for invoices) the subtotal of
 * the filtered slice. Contracts don't have a money value so the right
 * cell is omitted there.
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
  total?: number | undefined;
}

export function PaymentsFooter({ tab, count, total }: PaymentsFooterProps) {
  // Singular noun per tab; pluralised below.
  const singular = tab === 'invoices' ? 'invoice' : 'contract';
  const noun = count === 1 ? singular : `${singular}s`;

  return (
    <div className="fixed bottom-0 left-0 md:left-[68px] right-0 z-30 bg-surface border-t border-gray-100 px-6 py-5 flex items-center justify-between">
      <p className="text-body text-text-subtle">
        {count} {noun}
      </p>
      {total !== undefined && (
        <p className="text-body font-semibold text-text tabular-nums">
          {formatCurrency(total)}
        </p>
      )}
    </div>
  );
}
