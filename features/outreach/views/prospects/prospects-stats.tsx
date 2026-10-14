'use client';

/**
 * The Prospects stats strip: how many people sit in each status, and this
 * month's Instagram lookup spend. Each count is a filter chip: pressing it
 * narrows the table to that status, pressing it again clears the filter.
 * Needs-review is not here; the review callout owns that one, so the
 * status is never listed twice.
 *
 * @module features/outreach/views/prospects/prospects-stats
 */
import { FilterChip } from '@/components/ui/filter-chip';
import type { ChecksData } from '@/lib/outreach/services/queries';

import { formatUsd } from '../checks/format';

import { VERDICT_LABELS } from './labels';
import { ALL } from './prospects-filters';

/** The three status counts shown as chips, each filtering to its verdict value. */
const ITEMS = [
  { key: 'unchecked', verdict: 'unchecked' },
  { key: 'active', verdict: 'active' },
  { key: 'inactive', verdict: 'inactive' },
] as const;

/** Props for {@link ProspectsStats}. */
export interface ProspectsStatsProps {
  counts: ChecksData['counts'];
  spentCentsThisMonth: number;
  budgetCents: number;
  /** The table's current status filter, or `ALL`. Drives the pressed state. */
  verdict: string;
  /** Called with the status to filter to, or `ALL` to clear. */
  onVerdict: (verdict: string) => void;
}

/** The stats row. Hidden by the parent until there is at least one prospect. */
export function ProspectsStats({ counts, spentCentsThisMonth, budgetCents, verdict, onVerdict }: ProspectsStatsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ITEMS.map((item) => (
        <FilterChip
          key={item.key}
          label={VERDICT_LABELS[item.verdict] ?? item.verdict}
          count={counts[item.key]}
          pressed={verdict === item.verdict}
          onClick={() => onVerdict(verdict === item.verdict ? ALL : item.verdict)}
        />
      ))}
      <span className="ml-auto text-body text-text-subtle">
        Instagram lookups this month: {formatUsd(spentCentsThisMonth)} of {formatUsd(budgetCents)}
      </span>
    </div>
  );
}
