/**
 * React Query access to the user's time categories.
 *
 * Reads and writes both go through the server actions so validation and
 * the seed-once rule live in one place. `create` resolves to the new (or
 * already-existing) category so the caller can select it immediately,
 * which is what makes type-to-create feel instant.
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
 * The user's categories plus create / rename / delete.
 *
 * `create` swallows failures into `null` rather than throwing: the
 * caller is a picker mid-keystroke, and the shared mutation `onError`
 * handler has already alerted.
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

  const invalidateCategories = () =>
    queryClient.invalidateQueries({ queryKey: TIME_CATEGORIES_KEY });

  const createMutation = useMutation({
    mutationFn: async (name: string): Promise<TimeCategory> => {
      const result = await createTimeCategoryAction(name);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidateCategories,
  });

  const renameMutation = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const result = await renameTimeCategoryAction(input);
      if (!result.ok) throw new Error(result.error);
    },
    // Entry rows carry the flattened category name, so a rename has to
    // refresh them too or the timesheet keeps showing the old label.
    onSuccess: () => {
      void invalidateCategories();
      void queryClient.invalidateQueries({ queryKey: [COUPLE_TIME_ENTRIES_KEY] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteTimeCategoryAction(id);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      void invalidateCategories();
      void queryClient.invalidateQueries({ queryKey: [COUPLE_TIME_ENTRIES_KEY] });
    },
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
