/**
 * Per-session engagement timeline for the proposal detail page.
 *
 * @module app/(dashboard)/proposals/[id]/proposal-engagement-timeline
 */
import type { EngagementRow } from '@/lib/proposals/engagement';
import { sessionTimelines } from '@/lib/proposals/engagement';
import { blockTypeLabel, formatSeconds, stepLabel } from '@/lib/proposals/engagement-labels';

export interface ProposalEngagementTimelineProps {
  /** Raw engagement rows for one proposal, any order. */
  rows: EngagementRow[];
  /** Option id -> option title, so a session's chosen package reads by name. */
  optionTitles: Record<string, string>;
}

/**
 * One calm list, newest session first: when it happened, how long it
 * lasted, the package chosen (if any), and the furthest step reached,
 * with that session's own top three sections underneath in muted text.
 * No boxes-in-boxes, matching the rest of the detail page. Renders
 * `null` when there are no sessions so the caller needs no extra check.
 */
export function ProposalEngagementTimeline({ rows, optionTitles }: ProposalEngagementTimelineProps) {
  const timelines = sessionTimelines(rows);
  if (timelines.length === 0) return null;

  return (
    <ul className="divide-y divide-border">
      {timelines.map((t) => {
        const when = t.startedAt
          ? new Date(t.startedAt).toLocaleString('en-AU', {
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })
          : null;
        const chose = t.selectedOptionId ? `Chose ${optionTitles[t.selectedOptionId] ?? 'a package'}` : null;
        const furthestStep = t.steps[t.steps.length - 1];
        const line = [when, formatSeconds(t.seconds), chose, furthestStep ? stepLabel(furthestStep) : null]
          .filter((part): part is string => Boolean(part))
          .join(' · ');
        const topSections = t.sections.slice(0, 3).map((s) => blockTypeLabel(s.blockType)).join(', ');

        return (
          <li key={t.sessionId} className="py-2 space-y-0.5">
            <p className="text-body text-text">{line}</p>
            {topSections ? <p className="text-body text-text-muted">{topSections}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
