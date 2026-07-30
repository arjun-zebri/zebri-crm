/**
 * React Query access to the user's time categories.
 *
 * Every write is optimistic: the list updates before the round-trip and
 * rolls back if the server refuses. Labelling a session happens in the
 * seconds after stopping a timer, so a spinner on "create category" would
 * be felt immediately.
 *
 * Reads and writes both go through the server actions so validation and
 * the seed-once rule live in one place.
 *
 * @module components/time-tracking/use-time-categories
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createTimeCategoryAction,
  deleteTimeCategoryAction,
  listTimeCategoriesAction,
  renameTimeCategoryAction,
} from '@/app/(dashboard)/couples/time-actions';
import type { TimeCategory } from '@/types/time-tracking';

/** Query key for the category list. */
export const TIME_CATEGORIES_KEY = ['time-categories'] as const;

/** Query-key prefix for every couple's entry list. */
export const COUPLE_TIME_ENTRIES_KEY = 'couple-time-entries';

/**
 * Id prefix for a category that exists on screen but not yet in the
 * database. Never sent to the server: the picker holds the pending name
 * locally and only reports the real id once it arrives.
 */
const PENDING_ID_PREFIX = 'pending:';

/** Whether an id belongs to an optimistic, not-yet-saved category. */
export function isPendingCategoryId(id: string): boolean {
  return id.startsWith(PENDING_ID_PREFIX);
}

/**
 * The user's categories plus optimistic create / rename / delete.
 *
 * `create` resolves to the saved category (or null when the write
 * failed), so the caller can select it by its real id.
 */
export function useTimeCategories() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: TIME_CATEGORIES_KEY,
    queryFn: async (): Promise<TimeCategory[]> => {
      const result = await listTimeCategoriesAction();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const rows = () =>
    queryClient.getQueryData<TimeCategory[]>(TIME_CATEGORIES_KEY) ?? [];

  const write = (next: TimeCategory[]) =>
    queryClient.setQueryData(TIME_CATEGORIES_KEY, next);

  /** Re-sync after a write settles, including the entry lists when a
   *  category's name or existence changed under them. */
  const settle = (touchesEntries: boolean) => {
    void queryClient.invalidateQueries({ queryKey: TIME_CATEGORIES_KEY });
    if (touchesEntries) {
      void queryClient.invalidateQueries({
        queryKey: [COUPLE_TIME_ENTRIES_KEY],
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: async (name: string): Promise<TimeCategory> => {
      const result = await createTimeCategoryAction(name);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: TIME_CATEGORIES_KEY });
      const previous = rows();
      const pendingId = `${PENDING_ID_PREFIX}${name}`;
      write([...previous, { id: pendingId, name, position: previous.length }]);
      return { previous, pendingId };
    },
    onError: (_error, _name, context) => {
      if (context) write(context.previous);
    },
    onSuccess: (created, _name, context) => {
      // Swap the placeholder for the saved row so the list never flickers
      // between the optimistic entry and the refetch.
      write(rows().map((r) => (r.id === context?.pendingId ? created : r)));
    },
    onSettled: () => settle(false),
  });

  const renameMutation = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const result = await renameTimeCategoryAction(input);
      if (!result.ok) throw new Error(result.error);
    },
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: TIME_CATEGORIES_KEY });
      const previous = rows();
      write(previous.map((r) => (r.id === id ? { ...r, name } : r)));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context) write(context.previous);
    },
    // Entry rows carry the flattened category name, so a rename has to
    // refresh them too or the timesheet keeps showing the old label.
    onSettled: () => settle(true),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteTimeCategoryAction(id);
      if (!result.ok) throw new Error(result.error);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TIME_CATEGORIES_KEY });
      const previous = rows();
      write(previous.filter((r) => r.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context) write(context.previous);
    },
    onSettled: () => settle(true),
  });

  return {
    categories: data ?? [],
    isLoading,
    create: async (name: string): Promise<TimeCategory | null> => {
      try {
        return await createMutation.mutateAsync(name);
      } catch {
        return null;
      }
    },
    rename: (id: string, name: string) => renameMutation.mutate({ id, name }),
    remove: (id: string) => removeMutation.mutate(id),
  };
}
