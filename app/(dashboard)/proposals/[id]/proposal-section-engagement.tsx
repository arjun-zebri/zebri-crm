/**
 * Reading depth by section: every section of the proposal in page order,
 * with time spent (bar) and reach (the share of sessions that scrolled
 * far enough to see it). Reach falls as the page goes on; the biggest
 * step down is where readers leave, and that row is marked.
 *
 * Renders the {@link SectionEngagementRow}s built by `sectionReport`
 * (`@/features/proposals`) from the proposal's `section_viewed` events.
 *
 * @module app/(dashboard)/proposals/[id]/proposal-section-engagement
 */
'use client';

import type { SectionEngagementRow } from '@/features/proposals';
import { formatSeconds } from '@/features/proposals';

export interface ProposalSectionEngagementProps {
  /** Sections in page order. */
  rows: SectionEngagementRow[];
}

/** Index of the row whose reach fell the most from the row before it, or -1 when reach never drops. */
export function biggestDropIndex(rows: SectionEngagementRow[]): number {
  let at = -1;
  let worst = 0;
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    if (!prev) return;
    const drop = prev.reachPct - r.reachPct;
    if (drop > worst) {
      worst = drop;
      at = i;
    }
  });
  return at;
}

/** See {@link ProposalSectionEngagementProps}. */
export function ProposalSectionEngagement({ rows }: ProposalSectionEngagementProps) {
  // Bars are relative to the longest-read section, matching the existing
  // top-sections bars in proposal-engagement.tsx: a short glance and a
  // long read should both fill the bar for their own top section.
  const maxSeconds = Math.max(1, ...rows.map((r) => r.seconds));
  const dropAt = biggestDropIndex(rows);

  return (
    <div className="space-y-2">
      <h3 className="text-body font-medium text-text">Reading by section</h3>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          // Same phone layout as the package rows: below `sm` the bar gets
          // its own line, since the fixed label, time and reach columns
          // alone fill a 390px screen and left the bar 0px wide.
          <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-nowrap">
            <span className="min-w-0 flex-1 truncate text-body text-text-muted sm:w-40 sm:flex-none">{r.label}</span>
            <div className="order-last h-2 w-full rounded-control bg-surface-muted sm:order-none sm:w-auto sm:flex-1">
              {/* Width is the one data-driven value (share of the top
                  section's seconds); colour and radius come from tokens. */}
              <div className="h-2 rounded-control bg-brand-fg" style={{ width: `${Math.round((r.seconds / maxSeconds) * 100)}%` }} />
            </div>
            <span className="w-14 shrink-0 text-right text-body text-text-muted">{formatSeconds(r.seconds)}</span>
            <span className={`w-24 shrink-0 text-right text-body ${i === dropAt ? 'text-warning' : 'text-text-subtle'}`}>
              {r.reachPct}% reached
            </span>
          </div>
        ))}
      </div>
      {dropAt >= 0 ? (
        <p className="text-body text-text-subtle">Most readers leave around {rows[dropAt]?.label}.</p>
      ) : null}
    </div>
  );
}
