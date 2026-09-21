/**
 * Pure aggregation for the stats row: counts derived from the already-
 * fetched proposals list, no separate query. No historical comparison
 * data exists yet, so this deliberately has no trend/delta — see
 * `proposals-stats-row.tsx`.
 *
 * @module app/(dashboard)/proposals/proposals-stats
 */
import type { ProposalListRow } from './use-proposals';

export interface ProposalStats {
  total: number;
  sent: number;
  viewed: number;
  accepted: number;
}

/** Counts each status bucket once. `sent` and `viewed` are mutually exclusive lifecycle states on the same row. */
export function computeProposalStats(rows: ProposalListRow[]): ProposalStats {
  return rows.reduce<ProposalStats>(
    (acc, r) => {
      if (r.status === 'sent') acc.sent += 1;
      if (r.status === 'viewed') acc.viewed += 1;
      if (r.status === 'accepted') acc.accepted += 1;
      return acc;
    },
    { total: rows.length, sent: 0, viewed: 0, accepted: 0 },
  );
}
