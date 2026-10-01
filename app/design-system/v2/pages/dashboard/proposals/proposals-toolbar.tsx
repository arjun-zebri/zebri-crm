'use client';

import { Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';
import { Input } from '@/components/ui-v2/input';

import { PeriodPicker } from '../payments/overview/period-picker';
import type { Range } from '../payments/reports-data';

/**
 * The Proposals toolbar, on the same row as the tabs. Overview gets the
 * period control (the Payments one, so both pages pick periods the same
 * way); Nudge on the What's next rail is that tab's primary. Proposals gets
 * search and New proposal, Templates gets New template, each the tab's
 * one primary. Wraps on narrow screens.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/proposals-toolbar
 */

export type Tab = 'overview' | 'proposals' | 'templates';

export interface ProposalsToolbarProps {
  tab: Tab;
  query: string;
  onQuery: (q: string) => void;
  onNew: () => void;
  range: Range;
  onRange: (r: Range) => void;
}

/** The toolbar. See {@link ProposalsToolbarProps}. */
export function ProposalsToolbar({ tab, query, onQuery, onNew, range, onRange }: ProposalsToolbarProps) {
  if (tab === 'overview') return <PeriodPicker value={range} onChange={onRange} />;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tab === 'proposals' ? (
        <div className="w-full sm:w-52">
          <Input
            type="search"
            aria-label="Search proposals"
            placeholder="Search proposals"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            leading={<Search strokeWidth={1.5} className="size-4" />}
          />
        </div>
      ) : null}
      <div>
        {/* `data-tour` is where the first-run guide points. */}
        <Button onClick={onNew} data-tour={tab === 'proposals' ? 'new-proposal' : undefined}>
          <Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />
          New {tab === 'proposals' ? 'proposal' : 'template'}
        </Button>
      </div>
    </div>
  );
}
