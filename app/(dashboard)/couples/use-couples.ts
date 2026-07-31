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
  bulkCreateCouplesAction,
  bulkDeleteCouplesAction,
  bulkMoveCouplesAction,
  bulkUpdateCouplesStatusAction,
  createCoupleAction,
  deleteCoupleAction,
  updateCoupleAction,
  upsertCoupleEventDateAction,
  type BulkImportSummary,
  type CoupleInput,
  type UpsertCoupleEventDateInput,
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

/** Minimal shape pulled from the embedded `events` relation — only the
 *  fields the list needs to resolve a couple's next event. */
type EmbeddedEvent = { date: string | null; venue: string | null };

/**
 * Resolve a couple's "next event" for list display: the soonest event
 * dated today-or-later, falling back to the most recent past event when
 * none are upcoming. Returns `null` when the couple has no dated events.
 */
function pickNextEvent(events: EmbeddedEvent[]): EmbeddedEvent | null {
  const dated = events.filter((e) => e.date);
  if (dated.length === 0) return null;
  // Lexicographic sort is correct for ISO `YYYY-MM-DD` date strings.
  const sorted = [...dated].sort((a, b) =>
    a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0,
  );
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = sorted.find((e) => e.date! >= today);
  // `sorted` is non-empty here (guarded above), but indexed access is
  // `T | undefined` under strict — fall back to null to satisfy the
  // `EmbeddedEvent | null` return contract.
  return upcoming ?? sorted[sorted.length - 1] ?? null;
}

export function useCouples() {
  const supabase = createClient();

  const query = useQuery({
    queryKey: ['couples'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error('Not authenticated');

      // Embed the couple-owned `events` so the list can show the next
      // event's date + venue. RLS scopes the embedded rows automatically.
      const { data, error } = await supabase
        .from('couples')
        .select('*, events(date, venue)')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data as (Couple & { events?: EmbeddedEvent[] })[]) || [];
      return rows.map(({ events, ...couple }) => {
        const next = pickNextEvent(events ?? []);
        return {
          ...couple,
          next_event_date: next?.date ?? null,
          next_event_venue: next?.venue ?? null,
        } satisfies Couple;
      });
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

/** Bulk-create couples from a CSV import. Returns the import summary
 *  (created / skipped / invalid) so the caller can message the result.
 *  Not optimistic — the row count is unknown until the server slices
 *  for the plan cap, so we just invalidate on success. */
export function useBulkCreateCouples() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: CoupleInput[]): Promise<BulkImportSummary> =>
      unwrap(await bulkCreateCouplesAction(rows)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couples'] });
    },
  });
}

/** Set a couple's wedding date by creating/updating its real `events`
 *  row. The couple-level `event_date` column is dead, so this is what
 *  actually surfaces the date on the calendar + list. */
export function useUpsertCoupleEventDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertCoupleEventDateInput) => {
      unwrap(await upsertCoupleEventDateAction(input));
    },
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
          referral_source: couple.referral_source ?? null,
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
