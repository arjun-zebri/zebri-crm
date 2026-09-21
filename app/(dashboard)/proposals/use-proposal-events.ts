/**
 * React Query hook for one proposal's raw engagement events.
 *
 * @module app/(dashboard)/proposals/use-proposal-events
 */
'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { EngagementRow } from '@/lib/proposals/engagement';
import { createClient } from '@/lib/supabase/client';

/** Query key for one proposal's raw engagement events. */
export const PROPOSAL_EVENTS_QUERY_KEY = (id: string) => ['proposal-events', id] as const;

/**
 * Raw `proposal_events` rows for one proposal, oldest first.
 *
 * Capped at 5000 rows: why is that the detail page's own summary
 * (`summarizeEngagement`) is a plain sum over these rows and its timeline
 * (`sessionTimelines`) caps itself at 20 sessions regardless of how many
 * rows feed it, so a proposal opened hundreds of times still renders
 * correctly without this query ever needing to return more.
 *
 * The query asks for the NEWEST 5000 and reverses them in memory, rather
 * than asking for the oldest 5000: past the cap it is the recent sessions
 * that matter, and the outcome (accepted or declined) always lands in the
 * last events a proposal ever records. Ordering ascending in SQL would
 * silently drop exactly those.
 */
export function useProposalEvents(proposalId: string): UseQueryResult<EngagementRow[]> {
  const supabase = createClient();
  return useQuery({
    queryKey: PROPOSAL_EVENTS_QUERY_KEY(proposalId),
    queryFn: async (): Promise<EngagementRow[]> => {
      const { data, error } = await supabase
        .from('proposal_events')
        .select('session_id, type, payload, created_at')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      const rows = (data as unknown as EngagementRow[]) ?? [];
      // Back to oldest first, which is the order every aggregation expects.
      return rows.reverse();
    },
  });
}
