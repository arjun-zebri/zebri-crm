/**
 * The Layout v2 drill-down for one proposal: reading by section, package
 * comparison and device split, all computed from the same `proposal_events`
 * rows as the summary above them.
 *
 * @module app/(dashboard)/proposals/[id]/proposal-engagement-v2
 */
import type { EngagementRow, ProposalLayout } from '@/features/proposals';
import { deviceSplit, packageReport, sectionLabel, sectionReport } from '@/features/proposals';

import type { ProposalDetailRow } from '../use-proposals';

import { ProposalDeviceSplit } from './proposal-device-split';
import { ProposalPackageComparison } from './proposal-package-comparison';
import { ProposalSectionEngagement } from './proposal-section-engagement';

/**
 * Sections worth reporting on, id and display label, in page order. A page
 * break has no content to read, so it is left out rather than shown as a
 * row that can only ever say "0s".
 */
export function reportSections(layout: ProposalLayout): Array<{ id: string; label: string }> {
  return layout.sections.filter((s) => s.kind !== 'pageBreak').map((s) => ({ id: s.id, label: sectionLabel(s) }));
}

export interface ProposalEngagementV2Props {
  proposal: ProposalDetailRow;
  /** The already-parsed layout. */
  layout: ProposalLayout;
  /** Non-empty: the caller renders the empty state instead when there are no rows. */
  rows: EngagementRow[];
}

/** See {@link ProposalEngagementV2Props}. */
export function ProposalEngagementV2({ proposal, layout, rows }: ProposalEngagementV2Props) {
  return (
    <div className="space-y-5 pt-2">
      <ProposalSectionEngagement rows={sectionReport(rows, reportSections(layout))} />
      <ProposalPackageComparison rows={packageReport(rows, proposal.proposal_options, proposal.accepted_option_id)} />
      <ProposalDeviceSplit split={deviceSplit(rows)} />
    </div>
  );
}
