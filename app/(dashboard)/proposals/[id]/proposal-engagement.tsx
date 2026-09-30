/**
 * Engagement summary + per-session timeline for one proposal.
 *
 * Sourced from the raw `proposal_events` rows (`useProposalEvents`) and
 * aggregated client-side with the pure functions in
 * `features/proposals/analytics`, so the aggregation logic lives in one tested place
 * and this component is only presentation.
 *
 * @module app/(dashboard)/proposals/[id]/proposal-engagement
 */
'use client';

import { Eye } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

import { useProposalEvents } from '@/app/(dashboard)/proposals/use-proposal-events';
import type { ProposalDetailRow } from '@/app/(dashboard)/proposals/use-proposals';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { StatePill } from '@/components/ui/state-pill';
import type { EngagementRow, ProposalLayout } from '@/features/proposals';
import { blockTypeLabel, formatSeconds, parseProposalLayout, stepLabel, summarizeEngagement } from '@/features/proposals';

import { ProposalEngagementTimeline } from './proposal-engagement-timeline';
import { ProposalEngagementV2, reportSections } from './proposal-engagement-v2';

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

export interface ProposalEngagementProps {
  /** Only `id` and `proposal_options` (for option titles) are read. */
  proposal: ProposalDetailRow;
}

/**
 * The body of the `Engagement` section for the loaded, non-empty case:
 * facts line, top section bars, lingered package, furthest step and
 * outcome, timeline. Split out of {@link ProposalEngagement} so that
 * component can wrap every state (loading, error, empty, loaded) in one
 * `<section>` without a 150+ line function (m5).
 */
function EngagementBody({
  proposal,
  layout,
  rows,
}: {
  proposal: ProposalDetailRow;
  layout: ProposalLayout | null;
  rows: EngagementRow[];
}): ReactNode {
  const summary = summarizeEngagement(rows);
  const optionTitles = Object.fromEntries(proposal.proposal_options.map((o) => [o.id, o.title]));
  const facts = [
    `${summary.sessions} session${summary.sessions === 1 ? '' : 's'}`,
    summary.firstOpenedAt ? `first opened ${shortDate(summary.firstOpenedAt)}` : null,
    // M6: "last active", not "last seen" -- the facts line above this
    // component already says "Last viewed" for `proposals.view_count`
    // (bumped on every page load), a different number from this one
    // (distinct sessions). Two nearby lines both saying "views"/"seen"
    // read as a contradiction; distinct wording says what each counts.
    summary.lastSeenAt ? `last active ${shortDate(summary.lastSeenAt)}` : null,
    summary.totalSeconds > 0 ? `${formatSeconds(summary.totalSeconds)} reading` : null,
  ].filter((part): part is string => Boolean(part));

  // A v2 proposal gets the full per-section report instead; the top-four
  // bars are the v1 fallback (no layout, or one that failed to parse).
  const topSections = layout ? [] : summary.sections.slice(0, 4);
  const sectionLabels = layout ? Object.fromEntries(reportSections(layout).map((s) => [s.id, s.label])) : undefined;
  // Bars are relative to the largest section (sections is sorted desc),
  // never an absolute scale: a 5-second glance and a 5-minute read on two
  // different proposals should both show a full bar for their top section.
  // m2: `|| 1`, not `?? 1` -- an all-zero-seconds set (reachable through a
  // malformed batch, see M4) has a defined-but-zero top section, which
  // `??` would not catch, yielding `width: NaN%`.
  const maxSeconds = topSections[0]?.seconds || 1;
  // The v2 Packages block already shows every package's time, so the
  // one-line "Lingered on" summary is only for v1.
  const lingered = !layout && summary.lingeredOptionId
    ? { title: optionTitles[summary.lingeredOptionId] ?? 'a package', seconds: summary.packages[0]?.seconds ?? 0 }
    : null;

  return (
    <>
      <p className="text-body text-text-muted">{facts.join(' · ')}</p>

      {layout ? <ProposalEngagementV2 proposal={proposal} layout={layout} rows={rows} sessions={summary.sessions} /> : null}

      {topSections.length > 0 ? (
        <div className="space-y-1.5">
          {topSections.map((s) => (
            <div key={s.id} className="flex items-center gap-3">
              <span className="text-body text-text-muted w-32 shrink-0">{blockTypeLabel(s.kind)}</span>
              <div className="h-2 flex-1 rounded-control bg-surface-muted">
                {/* Width is the one data-driven value here (share of the
                    top section's seconds); colour and radius still come
                    from tokens, so this isn't an off-token style. */}
                <div
                  className="h-2 rounded-control bg-brand-fg"
                  style={{ width: `${Math.round((s.seconds / maxSeconds) * 100)}%` }}
                />
              </div>
              <span className="text-body text-text-muted shrink-0">{formatSeconds(s.seconds)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* M7: lingered/furthest-step/outcome do not depend on section rows
          existing -- an old browser with no IntersectionObserver, or a
          flush that dropped the section rows while `accepted` survived on
          a later one, still has an outcome worth showing. */}
      {lingered ? (
        <p className="text-body text-text-muted">{`Lingered on ${lingered.title} (${formatSeconds(lingered.seconds)})`}</p>
      ) : null}

      {summary.furthestStep ? (
        <p className="text-body text-text-muted flex items-center gap-2">
          {`Got as far as: ${stepLabel(summary.furthestStep)}`}
          {summary.outcome ? (
            <StatePill
              label={summary.outcome === 'accepted' ? 'Accepted' : 'Declined'}
              tone={summary.outcome === 'accepted' ? 'success' : 'danger'}
            />
          ) : null}
        </p>
      ) : null}

      <ProposalEngagementTimeline rows={rows} optionTitles={optionTitles} {...(sectionLabels ? { sectionLabels } : {})} />
    </>
  );
}

/** See {@link ProposalEngagementProps}. */
export function ProposalEngagement({ proposal }: ProposalEngagementProps) {
  const { data: rows, isLoading, error, refetch } = useProposalEvents(proposal.id);
  // Parse once. A layout that fails to validate is treated as a v1
  // proposal (top-section bars) rather than crashing the detail page.
  const layout = useMemo(() => {
    if (!proposal.layout) return null;
    const parsed = parseProposalLayout(proposal.layout);
    return parsed.ok ? parsed.layout : null;
  }, [proposal.layout]);

  // m5: loading, error, empty and loaded all render inside the same
  // `<section>`/`<h2>Engagement</h2>` wrapper, so a just-sent proposal
  // never shows an unlabelled icon floating between the couple line and
  // the Options table.
  let body: ReactNode;
  if (isLoading) {
    body = <Loading label="Loading engagement" />;
  } else if (error) {
    body = <ErrorState title="Could not load engagement" error={error} onRetry={() => void refetch()} />;
  } else if (!rows || rows.length === 0) {
    body = <Empty icon={Eye} title="No opens yet" size="sm" />;
  } else {
    body = <EngagementBody proposal={proposal} layout={layout} rows={rows} />;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-section text-text">Engagement</h2>
      {body}
    </section>
  );
}
