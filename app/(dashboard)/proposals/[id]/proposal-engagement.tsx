/**
 * Engagement summary + per-session timeline for one proposal.
 *
 * Sourced from the raw `proposal_events` rows (`useProposalEvents`) and
 * aggregated client-side with the pure functions in `lib/proposals/`
 * (Phase D Task 2), so the aggregation logic lives in one tested place
 * and this component is only presentation.
 *
 * @module app/(dashboard)/proposals/[id]/proposal-engagement
 */
'use client';

import { Eye } from 'lucide-react';
import type { ReactNode } from 'react';

import { useProposalEvents } from '@/app/(dashboard)/proposals/use-proposal-events';
import type { ProposalDetailRow } from '@/app/(dashboard)/proposals/use-proposals';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { StatePill } from '@/components/ui/state-pill';
import type { EngagementRow } from '@/lib/proposals/engagement';
import { summarizeEngagement } from '@/lib/proposals/engagement';
import { blockTypeLabel, formatSeconds, stepLabel } from '@/lib/proposals/engagement-labels';

import { SAMPLE_SECTION_ENGAGEMENT, samplePackageRows } from '../analytics-placeholders';
import { proposalLayoutV2Enabled } from '../flags';

import { ProposalEngagementTimeline } from './proposal-engagement-timeline';
import { ProposalPackageComparison } from './proposal-package-comparison';
import { ProposalSectionEngagement } from './proposal-section-engagement';

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
function EngagementBody({ proposal, rows }: { proposal: ProposalDetailRow; rows: EngagementRow[] }): ReactNode {
  const summary = summarizeEngagement(rows);
  const optionTitles = Object.fromEntries(proposal.proposal_options.map((o) => [o.id, o.title]));
  const facts = [
    `${summary.sessions} sessions`,
    summary.firstOpenedAt ? `first opened ${shortDate(summary.firstOpenedAt)}` : null,
    // M6: "last active", not "last seen" -- the facts line above this
    // component already says "Last viewed" for `proposals.view_count`
    // (bumped on every page load), a different number from this one
    // (distinct sessions). Two nearby lines both saying "views"/"seen"
    // read as a contradiction; distinct wording says what each counts.
    summary.lastSeenAt ? `last active ${shortDate(summary.lastSeenAt)}` : null,
    summary.totalSeconds > 0 ? `${formatSeconds(summary.totalSeconds)} reading` : null,
  ].filter((part): part is string => Boolean(part));

  const topSections = summary.sections.slice(0, 4);
  // Bars are relative to the largest section (sections is sorted desc),
  // never an absolute scale: a 5-second glance and a 5-minute read on two
  // different proposals should both show a full bar for their top section.
  // m2: `|| 1`, not `?? 1` -- an all-zero-seconds set (reachable through a
  // malformed batch, see M4) has a defined-but-zero top section, which
  // `??` would not catch, yielding `width: NaN%`.
  const maxSeconds = topSections[0]?.seconds || 1;
  const lingered = summary.lingeredOptionId
    ? { title: optionTitles[summary.lingeredOptionId] ?? 'a package', seconds: summary.packages[0]?.seconds ?? 0 }
    : null;

  return (
    <>
      <p className="text-body text-text-muted">{facts.join(' · ')}</p>

      {topSections.length > 0 ? (
        <div className="space-y-1.5">
          {topSections.map((s) => (
            <div key={s.blockId} className="flex items-center gap-3">
              <span className="text-body text-text-muted w-32 shrink-0">{blockTypeLabel(s.blockType)}</span>
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

      <ProposalEngagementTimeline rows={rows} optionTitles={optionTitles} />
    </>
  );
}

/** See {@link ProposalEngagementProps}. */
export function ProposalEngagement({ proposal }: ProposalEngagementProps) {
  const { data: rows, isLoading, error, refetch } = useProposalEvents(proposal.id);

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
    body = <EngagementBody proposal={proposal} rows={rows} />;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-section text-text">Engagement</h2>
      {body}
      {/* Placeholders (Layout v2 only): the two analytics Qwilr leads with,
          rendered from sample data with a visible pill until the real
          sources are wired (see analytics-placeholders.ts). They sit under
          the real summary regardless of its state so the shape is visible
          on a proposal with no opens too. */}
      {proposalLayoutV2Enabled() ? (
        <div className="space-y-5 pt-2">
          <ProposalSectionEngagement rows={SAMPLE_SECTION_ENGAGEMENT} sample />
          <ProposalPackageComparison rows={samplePackageRows(proposal.proposal_options)} sample />
        </div>
      ) : null}
    </section>
  );
}
