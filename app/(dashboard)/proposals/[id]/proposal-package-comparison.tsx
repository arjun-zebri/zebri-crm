/**
 * Package comparison: each package's share of attention (views and time,
 * as a bar) next to which one was chosen, so "they lingered on Premium
 * but picked Full day" is one glance rather than two lines of prose.
 * "Chosen" is only ever a signed acceptance; a card the couple clicked on
 * an unaccepted proposal reads "Selected", because a click is not a
 * commitment.
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
  const chosen = rows.find((r) => r.chosenBy !== null) ?? null;

  return (
    <div className="space-y-2">
      <h3 className="text-body font-medium text-text">Packages</h3>
      <div className="space-y-1.5">
        {rows.map((r) => (
          // Below `sm` the bar drops to its own line under the title: a
          // fixed-width title, count and pill left the bar 0px wide and
          // pushed the pill off a 390px screen (found in the R4 live check).
          <div key={r.optionId} className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-nowrap">
            <span className="min-w-0 flex-1 truncate text-body text-text sm:w-40 sm:flex-none">{r.title}</span>
            <div className="order-last h-2 w-full rounded-control bg-surface-muted sm:order-none sm:w-auto sm:flex-1">
              <div className="h-2 rounded-control bg-brand-fg" style={{ width: `${Math.round((r.seconds / maxSeconds) * 100)}%` }} />
            </div>
            <span className="w-28 shrink-0 text-right text-body text-text-muted">
              {r.views} view{r.views === 1 ? '' : 's'} · {formatSeconds(r.seconds)}
            </span>
            {/* w-24: the dotted "Chosen" pill is about 78px and overflowed a
                64px column; "Selected" is a little wider still. */}
            <span className="w-24 shrink-0">
              {r.chosenBy === 'accepted' ? <StatePill label="Chosen" tone="success" dot="filled" /> : null}
              {r.chosenBy === 'selected' ? <StatePill label="Selected" tone="info" dot="hollow" /> : null}
            </span>
          </div>
        ))}
      </div>
      {mostViewed && chosen && mostViewed.optionId !== chosen.optionId ? (
        <p className="text-body text-text-subtle">
          Lingered on {mostViewed.title}, {chosen.chosenBy === 'accepted' ? 'chose' : 'selected'} {chosen.title}.
        </p>
      ) : null}
    </div>
  );
}
