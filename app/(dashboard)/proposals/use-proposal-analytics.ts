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
  type AccountSummary,
  type TemplateStats,
} from '@/features/proposals';

/** Prefix of both analytics queries: invalidate this after a send or an accept. */
export const PROPOSAL_ANALYTICS_QUERY_KEY = ['proposal-analytics'] as const;

/** The account strip's figures. */
export function useAccountSummary() {
  return useQuery({
    queryKey: [...PROPOSAL_ANALYTICS_QUERY_KEY, 'account'],
    queryFn: async (): Promise<AccountSummary> => {
      const result = await getAccountSummaryAction();
      if (!result.ok) throw new Error(result.error);
      return result.summary;
    },
  });
}

/** Per-template outcomes keyed by template id. */
export function useTemplatePerformance() {
  return useQuery({
    queryKey: [...PROPOSAL_ANALYTICS_QUERY_KEY, 'templates'],
    queryFn: async (): Promise<Record<string, TemplateStats>> => {
      const result = await getTemplatePerformanceAction();
      if (!result.ok) throw new Error(result.error);
      return result.byTemplate;
    },
  });
}
