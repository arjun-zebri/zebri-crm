'use client';

import { Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';
import { Input } from '@/components/ui-v2/input';

import { ExportMenu } from './overview/export-menu';
import { PeriodPicker } from './overview/period-picker';
import type { Invoice } from './payments-data';
import type { Range } from './reports-data';

/**
 * The Payments toolbar, on the same row as the tabs. Overview gets the
 * period control and Export, both glass like the icon panel beside them
 * (Chase all, lower down, is
 * that tab's primary). Invoices and Contracts get search and their New
 * button, the tab's one primary. Wraps on narrow screens.
 *
 * @module app/design-system/v2/pages/dashboard/payments/payments-toolbar
 */

export type Tab = 'overview' | 'invoices' | 'contracts';

export interface PaymentsToolbarProps {
  tab: Tab;
  query: string;
  onQuery: (q: string) => void;
  onNew: () => void;
  range: Range;
  onRange: (r: Range) => void;
  /** For Export. */
  invoices: Invoice[];
}

/** The toolbar. See {@link PaymentsToolbarProps}. */
export function PaymentsToolbar({ tab, query, onQuery, onNew, range, onRange, invoices }: PaymentsToolbarProps) {
  if (tab === 'overview')
    return (
      <div className="flex flex-wrap items-center gap-2">
        <PeriodPicker value={range} onChange={onRange} />
        <ExportMenu invoices={invoices} range={range} />
      </div>
    );
  const noun = tab === 'invoices' ? 'invoices' : 'contracts';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-52">
        <Input
          type="search"
          aria-label={`Search ${noun}`}
          placeholder={`Search ${noun}`}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          leading={<Search strokeWidth={1.5} className="size-4" />}
        />
      </div>
      <div>
        {/* `data-tour` is where the first-run guide points. */}
        <Button onClick={onNew} data-tour={tab === 'invoices' ? 'new-invoice' : 'new-contract'}>
          <Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />
          New {tab === 'invoices' ? 'invoice' : 'contract'}
        </Button>
      </div>
    </div>
  );
}
