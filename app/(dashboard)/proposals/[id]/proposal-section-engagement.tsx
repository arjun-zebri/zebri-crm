/**
 * Reading depth by section: every section of the proposal in page order,
 * with time spent (bar) and reach (the share of sessions that scrolled
 * far enough to see it). Reach falls as the page goes on; the biggest
 * step down is where readers leave, and that row is marked.
 *
 * Placeholder: renders {@link SectionEngagementRow}s, and today the caller
 * passes `SAMPLE_SECTION_ENGAGEMENT`. Real rows come from `section_viewed`
 * seconds (already recorded) plus per-session first-seen sets for reach.
 *
 * @module app/(dashboard)/proposals/[id]/proposal-section-engagement
 */
'use client';

import { StatePill } from '@/components/ui/state-pill';
import { formatSeconds } from '@/lib/proposals/engagement-labels';

import type { SectionEngagementRow } from '../analytics-placeholders';

export interface ProposalSectionEngagementProps {
  /** Sections in page order. */
  rows: SectionEngagementRow[];
  /** True while the rows are sample data; shows the "Sample data" pill. */
  sample?: boolean;
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
export function ProposalSectionEngagement({ rows, sample }: ProposalSectionEngagementProps) {
  // Bars are relative to the longest-read section, matching the existing
  // top-sections bars in proposal-engagement.tsx: a short glance and a
  // long read should both fill the bar for their own top section.
  const maxSeconds = Math.max(1, ...rows.map((r) => r.seconds));
  const dropAt = biggestDropIndex(rows);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-body font-medium text-text">Reading by section</h3>
        {sample ? <StatePill label="Sample data" tone="neutral" /> : null}
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-body text-text-muted">{r.label}</span>
            <div className="h-2 flex-1 rounded-control bg-surface-muted">
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
