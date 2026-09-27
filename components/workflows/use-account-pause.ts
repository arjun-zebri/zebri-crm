'use client';

/**
 * Shared read model for the account-wide workflow stop.
 *
 * The Settings switch and the Workflows page banner must never disagree,
 * and Settings opens as a modal over whatever page the MC is on, so both
 * read one React Query key and a change from either refreshes both.
 *
 * @module components/workflows/use-account-pause
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getAccountPauseAction,
  pauseAccountWorkflowsAction,
  resumeAccountWorkflowsAction,
  type AccountPauseView,
} from '@/app/(dashboard)/workflows/account-pause-actions';
import { useToast } from '@/components/ui/toast';

/** Query key shared by every consumer of the stop. */
export const ACCOUNT_PAUSE_KEY = ['workflows', 'account-pause'] as const;

/** What {@link useAccountPause} hands its caller. */
export interface AccountPause {
  /** True while the stop is on. False until the first read lands. */
  paused: boolean;
  /** When the stop went on, while it is on. */
  pausedAt: string | null;
  /** True until the first read lands; controls stay disabled meanwhile. */
  loading: boolean;
  /**
   * True when the state could not be read. `paused` is then unknown, not
   * false: callers show an error, never a control that reads "running".
   */
  failed: boolean;
  /** Read the state again, after a failure. */
  retry: () => void;
  /** True while a pause or resume is in flight. */
  busy: boolean;
  /** Turn the stop on or off. Resolves true when the server agreed. */
  setPaused: (next: boolean) => Promise<boolean>;
}

/** Read and change the signed-in MC's account-wide workflow stop. */
export function useAccountPause(): AccountPause {
  const { toast } = useToast();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ACCOUNT_PAUSE_KEY,
    queryFn: async (): Promise<AccountPauseView> => {
      const res = await getAccountPauseAction();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      const res = next ? await pauseAccountWorkflowsAction() : await resumeAccountWorkflowsAction();
      if (!res.ok) throw new Error(res.error);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ACCOUNT_PAUSE_KEY }),
  });

  async function setPaused(next: boolean): Promise<boolean> {
    try {
      await mutation.mutateAsync(next);
      toast(next ? 'All workflows paused' : 'Workflows resumed', 'success');
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not change that. Try again.', 'error');
      return false;
    }
  }

  return {
    paused: query.data?.paused ?? false,
    pausedAt: query.data?.pausedAt ?? null,
    loading: query.isPending,
    failed: query.isError,
    retry: () => void query.refetch(),
    busy: mutation.isPending,
    setPaused,
  };
}
