'use client';

/**
 * React Query hooks over the Outreach server actions.
 *
 * Query keys all start with `outreach` so one invalidation after a
 * mutation refreshes every view that might show the change (the data is
 * small and the founder is the only user, so precision isn't worth it).
 *
 * @module features/outreach/hooks
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '@/components/ui/toast';

import { unwrap, type ActionResult } from './action-result';
import {
  getAnalyticsAction, getCampaignsAction, getChecksAction, getPipelineAction, getProspectAction, getReviewQueueAction,
  getReadinessAction, getSendStatusAction, getSequencesAction, getSettingsAction, getSetupProgressAction, getTodayAction,
  listProspectsAction,
} from './actions';

/** Root of every outreach query key. */
export const OUTREACH_KEY = 'outreach';

/** Today view. Refreshes every minute so the queue follows the tick. */
export function useToday() {
  return useQuery({ queryKey: [OUTREACH_KEY, 'today'], queryFn: async () => unwrap(await getTodayAction()), refetchInterval: 60_000 });
}

/**
 * Why sending is blocked, or that it is running. Refreshes every minute
 * with Today, so the header line follows the scheduler.
 */
export function useSendStatus() {
  return useQuery({
    queryKey: [OUTREACH_KEY, 'send-status'],
    queryFn: async () => unwrap(await getSendStatusAction()),
    refetchInterval: 60_000,
  });
}

/** Prospect filters as the table holds them. */
export interface ProspectQuery {
  search?: string | undefined;
  verdict?: string | undefined;
  stage?: string | undefined;
  state?: string | undefined;
  minScore?: number | undefined;
  hasEmail?: boolean | undefined;
  hasInstagram?: boolean | undefined;
  page: number;
  pageSize: number;
}

/** One page of prospects. */
export function useProspects(filters: ProspectQuery) {
  return useQuery({
    queryKey: [OUTREACH_KEY, 'prospects', filters],
    queryFn: async () => unwrap(await listProspectsAction(filters)),
    placeholderData: (prev) => prev,
  });
}

/** Prospect modal data; disabled until an id is chosen. */
export function useProspect(id: string | null) {
  return useQuery({
    queryKey: [OUTREACH_KEY, 'prospect', id],
    queryFn: async () => unwrap(await getProspectAction(id)),
    enabled: !!id,
  });
}

/** Checks view; polls while a run is going. */
export function useChecks() {
  return useQuery({
    queryKey: [OUTREACH_KEY, 'checks'],
    queryFn: async () => unwrap(await getChecksAction()),
    refetchInterval: (q) => (q.state.data?.runs.some((r) => r.status === 'running' || r.status === 'queuing') ? 5_000 : false),
  });
}

/** Needs-review queue. */
export function useReviewQueue() {
  return useQuery({ queryKey: [OUTREACH_KEY, 'review'], queryFn: async () => unwrap(await getReviewQueueAction()) });
}

/** Sequences. */
export function useSequences() {
  return useQuery({ queryKey: [OUTREACH_KEY, 'sequences'], queryFn: async () => unwrap(await getSequencesAction()) });
}

/** Campaigns. */
export function useCampaigns() {
  return useQuery({ queryKey: [OUTREACH_KEY, 'campaigns'], queryFn: async () => unwrap(await getCampaignsAction()) });
}

/** Pipeline board. */
export function usePipeline() {
  return useQuery({ queryKey: [OUTREACH_KEY, 'pipeline'], queryFn: async () => unwrap(await getPipelineAction()) });
}

/** Analytics for all campaigns or one. */
export function useAnalytics(campaignId: string | null) {
  return useQuery({
    queryKey: [OUTREACH_KEY, 'analytics', campaignId],
    queryFn: async () => unwrap(await getAnalyticsAction({ campaignId })),
  });
}

/** Settings view. */
export function useOutreachSettings() {
  return useQuery({ queryKey: [OUTREACH_KEY, 'settings'], queryFn: async () => unwrap(await getSettingsAction()) });
}

/** Ready-to-send checklist. Shared by Settings and Campaigns; refreshed by any outreach mutation. */
export function useReadiness() {
  return useQuery({ queryKey: [OUTREACH_KEY, 'readiness'], queryFn: async () => unwrap(await getReadinessAction()) });
}

/**
 * First-run setup guide state. Today renders it until all five steps are
 * done. Refetches on mount, so returning from an import or a check shows the new count.
 */
export function useSetupProgress() {
  return useQuery({ queryKey: [OUTREACH_KEY, 'setup'], queryFn: async () => unwrap(await getSetupProgressAction()) });
}

/** A success toast whose tone is not `success`, e.g. neutral `info` news. */
export interface OutreachToastLine {
  message: string;
  tone: 'success' | 'info';
}

/**
 * Wrap a server action as a mutation: unwraps the result, toasts the
 * error (or `success`), and refreshes every outreach query. `success` may
 * return a plain line (green) or a {@link OutreachToastLine} with its own tone.
 */
export function useOutreachMutation<I, T>(
  action: (input: I) => Promise<ActionResult<T>>,
  success?: string | ((data: T) => string | OutreachToastLine),
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: I) => unwrap(await action(input)),
    onSuccess: (data) => {
      if (success) {
        const line = typeof success === 'function' ? success(data) : success;
        if (typeof line === 'string') toast(line, 'success');
        else toast(line.message, line.tone);
      }
      void queryClient.invalidateQueries({ queryKey: [OUTREACH_KEY] });
    },
    onError: (err: Error) => {
      toast(err.message, 'error');
      // Why: most failures here mean the list on screen is stale (a DM
      // cancelled by a reply, a row changed in another tab). Refetching
      // drops the stale row instead of leaving a button that keeps failing.
      void queryClient.invalidateQueries({ queryKey: [OUTREACH_KEY] });
    },
  });
}
