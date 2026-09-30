/**
 * Package comparison: each package's share of attention (views and time,
 * as a bar) next to which one was chosen, so "they lingered on Premium
 * but picked Full day" is one glance rather than two lines of prose.
 *
 * Renders the {@link PackageEngagementRow}s built by `packageReport`
 * (`@/features/proposals`) from `package_viewed` / `package_selected`
 * events over the proposal's real options.
 *
 * @module app/(dashboard)/proposals/[id]/proposal-package-comparison
 */
'use client';

import { StatePill } from '@/components/ui/state-pill';
import type { PackageEngagementRow } from '@/features/proposals';
import { formatSeconds } from '@/features/proposals';

export interface ProposalPackageComparisonProps {
  /** Packages in proposal order. */
  rows: PackageEngagementRow[];
}

/** See {@link ProposalPackageComparisonProps}. */
export function ProposalPackageComparison({ rows }: ProposalPackageComparisonProps) {
  const maxSeconds = Math.max(1, ...rows.map((r) => r.seconds));
  const mostViewed = rows.reduce<PackageEngagementRow | null>((top, r) => (top && top.seconds >= r.seconds ? top : r), null);
  const chosen = rows.find((r) => r.chosen) ?? null;

  return (
    <div className="space-y-2">
      <h3 className="text-body font-medium text-text">Packages</h3>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.optionId} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-body text-text">{r.title}</span>
            <div className="h-2 flex-1 rounded-control bg-surface-muted">
              <div className="h-2 rounded-control bg-brand-fg" style={{ width: `${Math.round((r.seconds / maxSeconds) * 100)}%` }} />
            </div>
            <span className="w-28 shrink-0 text-right text-body text-text-muted">
              {r.views} view{r.views === 1 ? '' : 's'} · {formatSeconds(r.seconds)}
            </span>
            <span className="w-16 shrink-0">
              {r.chosen ? <StatePill label="Chosen" tone="success" dot="filled" /> : null}
            </span>
          </div>
        ))}
      </div>
      {mostViewed && chosen && mostViewed.optionId !== chosen.optionId ? (
        <p className="text-body text-text-subtle">
          Lingered on {mostViewed.title}, chose {chosen.title}.
        </p>
      ) : null}
    </div>
  );
}
