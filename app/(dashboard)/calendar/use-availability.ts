/**
 * React Query hooks for the availability editor.
 *
 * Provides data fetching and mutations for availability rules and overrides.
 * All mutations wrap server actions in the `./availability-actions.ts` file.
 *
 * @module app/(dashboard)/calendar/use-availability
 */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';

import {
  getAvailabilityAction,
  saveAvailabilityRulesAction,
  upsertOverrideAction,
  deleteOverrideAction,
  type ActionResult,
  type AvailabilityRuleInput,
  type OverrideInput,
} from './availability-actions';

/**
 * Throw on `ok: false` so React Query treats it as an error and the
 * hook's `onError` rollback runs.
 */
function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(result.error);
}

/**
 * Fetch availability rules, overrides, and timezone for the authenticated user.
 *
 * @returns { rules, overrides, timezone }, loading, error, and refetch
 */
export function useAvailability() {
  const query = useQuery({
    queryKey: ['availability'],
    queryFn: async () => {
      // Built inside the query, not in the hook body: the hook is mounted by
      // the meeting-type modal as well as the availability tab, and creating
      // a client during render made every consumer's test need Supabase env
      // vars to render at all.
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const result = await getAvailabilityAction();
      return unwrap(result);
    },
  });

  return query;
}

/**
 * Save availability rules and timezone.
 * Replace-all semantics: deletes existing rules and inserts new ones.
 *
 * @returns mutation object with mutateAsync, isPending, error
 */
export function useSaveAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rules,
      timezone,
    }: {
      rules: AvailabilityRuleInput[];
      timezone: string;
    }) => unwrap(await saveAvailabilityRulesAction(rules, timezone)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}

/**
 * Upsert an availability override (block or custom window).
 *
 * @returns mutation object with mutateAsync, isPending, error
 */
export function useUpsertOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OverrideInput) =>
      unwrap(await upsertOverrideAction(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}

/**
 * Delete an availability override by date.
 *
 * @returns mutation object with mutateAsync, isPending, error
 */
export function useDeleteOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (date: string) =>
      unwrap(await deleteOverrideAction(date)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}
