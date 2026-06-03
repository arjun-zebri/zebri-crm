/**
 * React Query hooks for the Couples surface.
 *
 * Reads stay client-side (RLS scopes them automatically). Mutations
 * are thin wrappers around the server actions in `./actions.ts` —
 * the action does the validated, RLS-scoped write; the hook keeps
 * the optimistic cache update + invalidation.
 *
 * `StarterLimitError` is preserved as the typed exception thrown
 * from `useCreateCouple` so the page's existing `catch (e instanceof
 * StarterLimitError)` redirect-to-billing branch keeps working.
 *
 * @module app/(dashboard)/couples/use-couples
 */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';
import { Couple } from '@/types/couple';

import {
  bulkDeleteCouplesAction,
  bulkMoveCouplesAction,
  bulkUpdateCouplesStatusAction,
  createCoupleAction,
  deleteCoupleAction,
  updateCoupleAction,
  type CoupleInput,
} from './actions';

export class StarterLimitError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "You've hit the couple limit on Starter. Upgrade to Pro or Max for unlimited couples.",
    );
    this.name = 'StarterLimitError';
  }
}

/** Throw on `ok: false` so React Query treats it as an error and the
 *  hook's `onError` rollback runs. Translate the typed
 *  `starter_limit` tag into the historical typed exception. */
function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string; code?: 'starter_limit' }): T {
  if (result.ok) return result.data;
  if (result.code === 'starter_limit') {
    throw new StarterLimitError(result.error);
  }
  throw new Error(result.error);
}

export function useCouples() {
  const supabase = createClient();

  const query = useQuery({
    queryKey: ['couples'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('couples')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as Couple[]) || [];
    },
  });

  return { ...query, data: query.data || [] };
}

export function useCreateCouple() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (couple: CoupleInput) => unwrap(await createCoupleAction(couple)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couples'] });
    },
  });
}

export function useUpdateCouple() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (couple: Couple) =>
      unwrap(
        await updateCoupleAction({
          id: couple.id,
          name: couple.name,
          email: couple.email,
          phone: couple.phone,
          primary_name: couple.primary_name ?? null,
          primary_email: couple.primary_email ?? null,
          primary_phone: couple.primary_phone ?? null,
          secondary_name: couple.secondary_name ?? null,
          secondary_email: couple.secondary_email ?? null,
          secondary_phone: couple.secondary_phone ?? null,
          event_date: couple.event_date,
          venue: couple.venue,
          notes: couple.notes,
          status: couple.status,
          lead_source: couple.lead_source,
          kanban_position: couple.kanban_position,
        }),
      ),
    onMutate: async (couple: Couple) => {
      queryClient.cancelQueries({ queryKey: ['couples'] });
      const previousCouples = queryClient.getQueryData<Couple[]>(['couples']);

      queryClient.setQueryData<Couple[]>(['couples'], (old) => {
        if (!old) return [couple];
        return old.map((c) => (c.id === couple.id ? couple : c));
      });

      return { previousCouples };
    },
    onError: (_err, _couple, context) => {
      const ctx = context as { previousCouples?: Couple[] } | undefined;
      if (ctx?.previousCouples) {
        queryClient.setQueryData(['couples'], ctx.previousCouples);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couples'] });
    },
  });
}

export function useDeleteCouple() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await deleteCoupleAction(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couples'] });
    },
  });
}

export function useBulkMoveCouples() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updates: Array<{ id: string; status: string; kanban_position: number }>,
    ) => unwrap(await bulkMoveCouplesAction(updates)),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['couples'] });
      const previousCouples = queryClient.getQueryData<Couple[]>(['couples']);
      const updateMap = new Map(updates.map((u) => [u.id, u]));
      queryClient.setQueryData<Couple[]>(['couples'], (old) => {
        if (!old) return old;
        return old.map((c) => {
          const u = updateMap.get(c.id);
          return u
            ? { ...c, status: u.status, kanban_position: u.kanban_position }
            : c;
        });
      });
      return { previousCouples };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previousCouples?: Couple[] } | undefined;
      if (ctx?.previousCouples) {
        queryClient.setQueryData(['couples'], ctx.previousCouples);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couples'] });
    },
  });
}

export function useBulkUpdateCouplesStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      unwrap(await bulkUpdateCouplesStatusAction({ ids, status }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couples'] });
    },
  });
}

export function useBulkDeleteCouples() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      unwrap(await bulkDeleteCouplesAction(ids));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couples'] });
    },
  });
}
