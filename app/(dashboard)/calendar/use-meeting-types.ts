/**
 * React Query hooks for the meeting types surface.
 *
 * Reads stay client-side (RLS scopes them automatically). Mutations are
 * thin wrappers around the server actions in `./meeting-type-actions.ts`:
 * the action does the validated, RLS-scoped write; the hook keeps the
 * optimistic cache update + invalidation.
 *
 * @module app/(dashboard)/calendar/use-meeting-types
 */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

/** Row shape held in the `meeting-types` query cache. */
type MeetingType = Database['public']['Tables']['meeting_types']['Row'];

import {
  createMeetingTypeAction,
  deleteMeetingTypeAction,
  listMeetingTypesAction,
  updateMeetingTypeAction,
  type ActionResult,
  type MeetingTypeInput,
} from './meeting-type-actions';

/**
 * Throw on `ok: false` so React Query treats it as an error and the
 * hook's `onError` rollback runs.
 */
function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(result.error);
}

/**
 * Fetch all meeting types for the authenticated user.
 *
 * @returns data array (empty if none), loading, error, and refetch state
 */
export function useMeetingTypes() {
  const supabase = createClient();

  const query = useQuery({
    queryKey: ['meeting-types'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const result = await listMeetingTypesAction();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  return { ...query, data: query.data || [] };
}

/**
 * Create a new meeting type.
 *
 * @returns mutation object with mutate / mutateAsync / isPending / error
 */
export function useCreateMeetingType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MeetingTypeInput) =>
      unwrap(await createMeetingTypeAction(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-types'] });
    },
  });
}

/**
 * Update an existing meeting type.
 *
 * Applies the change to the cached list immediately and rolls it back if the
 * server rejects it. Without that, flipping a meeting type's status from its
 * card left the switch showing the old state until a round trip and a refetch
 * had both completed, which reads as a dead control and invites a second click.
 *
 * @returns mutation object with mutate / mutateAsync / isPending / error
 */
export function useUpdateMeetingType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: MeetingTypeInput & { id: string }) =>
      unwrap(await updateMeetingTypeAction(id, input)),

    onMutate: async ({ id, ...input }) => {
      // Stop an in-flight refetch from landing on top of the optimistic value.
      await queryClient.cancelQueries({ queryKey: ['meeting-types'] });
      const previous = queryClient.getQueryData<MeetingType[]>(['meeting-types']);

      // Only fields the caller actually supplied are applied. A plain spread
      // would copy the input's optional keys across as `undefined`, punching
      // holes in a row type that permits none.
      //
      // `availability` is not a column: it carries the type's own weekly
      // hours, which live in a child table. Its `custom` flag maps onto the
      // row's `uses_custom_availability` so a card showing "Custom hours"
      // updates with the rest; the windows themselves are not cached here.
      const { availability, ...columns } = input;
      const patch: Record<string, unknown> = Object.fromEntries(
        Object.entries(columns).filter(([, value]) => value !== undefined),
      );
      if (availability) {
        patch['uses_custom_availability'] = availability.custom;
      }

      queryClient.setQueryData<MeetingType[]>(['meeting-types'], (current) =>
        current?.map((type) => (type.id === id ? { ...type, ...patch } : type)),
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      // Put the list back exactly as it was, rather than guessing at an
      // inverse: the mutation may have carried several fields.
      if (context?.previous) {
        queryClient.setQueryData(['meeting-types'], context.previous);
      }
    },

    onSettled: (_data, _error, variables) => {
      // Reconcile with the server on success and failure alike, so the cache
      // cannot drift from what was actually stored.
      queryClient.invalidateQueries({ queryKey: ['meeting-types'] });
      // The type's own hours are a separate query; without this a reopened
      // modal would show the windows from before the save.
      queryClient.invalidateQueries({
        queryKey: ['meeting-type-availability', variables.id],
      });
    },
  });
}

/**
 * Delete a meeting type.
 *
 * @returns mutation object with mutate / mutateAsync / isPending / error
 */
export function useDeleteMeetingType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteMeetingTypeAction(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-types'] });
    },
  });
}
