'use client';

import { Button } from '@/components/ui-v2/button';
import { PlusIcon, SearchIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

import { BarIcons } from '../bar-icons';

import { ExportMenu } from './overview/export-menu';
import { PeriodPicker } from './overview/period-picker';
import type { Invoice } from './payments-data';
import type { Range } from './reports-data';

/**
 * The Payments toolbar, on the same row as the tabs. Overview gets the
 * period control and Export, both glass like the icon panel beside them
 * (Send reminders, lower down, is
 * that tab's primary). Invoices gets search and New
 * button, the tab's one primary. Wraps on narrow screens.
 *
 * @module app/design-system/v2/pages/dashboard/payments/payments-toolbar
 */

export type Tab = 'overview' | 'invoices';

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
export function PaymentsToolbar({
  tab,
  query,
  onQuery,
  onNew,
  range,
  onRange,
  invoices,
}: PaymentsToolbarProps) {
  if (tab === 'overview')
    return (
      <div className="flex flex-wrap items-center gap-2">
        <PeriodPicker value={range} onChange={onRange} />
        <ExportMenu invoices={invoices} range={range} />
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-52">
        <Input
          type="search"
          raised
          aria-label="Search invoices"
          placeholder="Search invoices"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          leading={<SearchIcon aria-hidden="true" className="size-4" />}
        />
      </div>
      <BarIcons>
        {/* `data-tour` is where the first-run guide points. */}
        <Button
          variant="ghost"
          square
          aria-label="New invoice"
          tooltip={false}
          onClick={onNew}
          data-tour="new-invoice"
        >
          <PlusIcon aria-hidden="true" className="size-4" />
        </Button>
      </BarIcons>
    </div>
  );
}
