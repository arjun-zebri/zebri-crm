/**
 * React Query hooks for the /proposals analytics figures. They throw on a
 * failed action so React Query's `error` drives the ErrorState.
 *
 * @module app/(dashboard)/proposals/use-proposal-analytics
 */
'use client';

import { useQuery } from '@tanstack/react-query';

import {
  getAccountSummaryAction,
  getTemplatePerformanceAction,
  PROPOSAL_ANALYTICS_QUERY_KEY,
  type AccountSummary,
  type TemplateStats,
} from '@/features/proposals';

/** Options for the analytics hooks. */
export interface AnalyticsQueryOptions {
  /** False skips the fetch entirely, e.g. while the Layout v2 flag hides the surface. Defaults to true. */
  enabled?: boolean;
}

/** The account strip's figures. */
export function useAccountSummary({ enabled = true }: AnalyticsQueryOptions = {}) {
  return useQuery({
    enabled,
    queryKey: [...PROPOSAL_ANALYTICS_QUERY_KEY, 'account'],
    queryFn: async (): Promise<AccountSummary> => {
      const result = await getAccountSummaryAction();
      if (!result.ok) throw new Error(result.error);
      return result.summary;
    },
  });
}

/** Per-template outcomes keyed by template id. */
export function useTemplatePerformance({ enabled = true }: AnalyticsQueryOptions = {}) {
  return useQuery({
    enabled,
    queryKey: [...PROPOSAL_ANALYTICS_QUERY_KEY, 'templates'],
    queryFn: async (): Promise<Record<string, TemplateStats>> => {
      const result = await getTemplatePerformanceAction();
      if (!result.ok) throw new Error(result.error);
      return result.byTemplate;
    },
  });
}
