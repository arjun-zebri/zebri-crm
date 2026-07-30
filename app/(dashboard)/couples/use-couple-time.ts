/**
 * React Query hook for one couple's tracked time.
 *
 * Reads and writes route through the server actions in `./time-actions`,
 * so validation lives in one place and this stays a thin cache wrapper.
 * Mutations resolve to a boolean rather than throwing: the callers are
 * forms that want to stay open and show the failure inline, and the
 * shared mutation `onError` handler has already raised the alert.
 *
 * @module app/(dashboard)/couples/use-couple-time
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { COUPLE_TIME_ENTRIES_KEY } from '@/components/time-tracking/use-time-categories';
import { RUNNING_TIMER_KEY } from '@/components/time-tracking/use-timer';
import type { TimeEntry } from '@/types/time-tracking';

import {
  createCoupleTimeEntryAction,
  deleteCoupleTimeEntryAction,
  listCoupleTimeEntriesAction,
  updateCoupleTimeEntryAction,
  type CreateTimeEntryInput,
  type UpdateTimeEntryInput,
} from './time-actions';

export function useCoupleTime(coupleId: string) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: [COUPLE_TIME_ENTRIES_KEY, coupleId],
    queryFn: async (): Promise<TimeEntry[]> => {
      const result = await listCoupleTimeEntriesAction(coupleId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: [COUPLE_TIME_ENTRIES_KEY, coupleId],
    });
    // Deleting or editing the still-running session changes what the
    // pill should show, so its read has to be refreshed too.
    void queryClient.invalidateQueries({ queryKey: RUNNING_TIMER_KEY });
  };

  const createMutation = useMutation({
    mutationFn: async (input: CreateTimeEntryInput) => {
      const result = await createCoupleTimeEntryAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: async (input: UpdateTimeEntryInput) => {
      const result = await updateCoupleTimeEntryAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteCoupleTimeEntryAction(id);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: invalidate,
  });

  return {
    entries: data ?? [],
    isLoading,
    isError,
    saving: createMutation.isPending || updateMutation.isPending,
    create: async (input: CreateTimeEntryInput): Promise<boolean> => {
      try {
        await createMutation.mutateAsync(input);
        return true;
      } catch {
        return false;
      }
    },
    update: async (input: UpdateTimeEntryInput): Promise<boolean> => {
      try {
        await updateMutation.mutateAsync(input);
        return true;
      } catch {
        return false;
      }
    },
    remove: (id: string) => removeMutation.mutate(id),
  };
}
