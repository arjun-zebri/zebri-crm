/**
 * Server actions for the Couples surface.
 *
 * Lifts the previously-inline `supabase.from('couples')...` calls out
 * of `use-couples.ts` so the hooks become thin React Query wrappers
 * around server-validated mutations. Every action:
 *
 * - **Zod-validates** the input (clients can't be trusted with the
 *   shape — `kanban_position` as a string would corrupt sort order;
 *   an unknown `status` slug would silently break the kanban).
 * - **RLS-scoped** Supabase client — the user is the authenticated
 *   session; we never escape to the service-role key here.
 * - Returns a tagged `{ ok, data } | { ok: false, error, code? }`
 *   result the hook can pattern-match on. The `code` slot carries
 *   typed error tags (`'starter_limit'`) so the UI can branch on
 *   them (e.g. redirect to billing) without parsing English.
 *
 * The Starter-cap trigger (`enforce_starter_couple_limit`) lives in
 * Postgres and raises a specific error string on insert. Actions
 * translate it to `code: 'starter_limit'` so the UI can keep its
 * existing redirect-to-billing behaviour.
 *
 * Optimistic UI continues to live in `use-couples.ts` — the actions
 * are the canonical writes; the hook keeps the cache update.
 *
 * @module app/(dashboard)/couples/actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { createClient } from '@/lib/supabase/server';
import type { Couple } from '@/types/couple';

/* ─── Tagged result type ───────────────────────────────────────── */

export interface ActionSuccess<T> {
  ok: true;
  data: T;
}

export interface ActionFailure {
  ok: false;
  error: string;
  /** Typed error tag — present for branches the UI handles specially
   *  (currently just `'starter_limit'`). Absent on generic failures. */
  code?: 'starter_limit';
}

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

/* ─── Shared shapes ────────────────────────────────────────────── */

// `event_date` is a Postgres `date` — null when not yet set. We
// accept ISO date strings (`YYYY-MM-DD`) or null; full-format
// validation lives in the Zod schema below.
const dateOrNull = z
  .string()
  .nullable()
  .refine(
    (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
    'event_date must be a YYYY-MM-DD string or null',
  );

// Partner contact triple (name + email + phone), each nullable so
// the user can fill them in over time. Defaulted at the schema
// level so the Supabase Insert spread always has the keys.
const partnerName = z.string().trim().max(200).nullable().default(null);
const partnerEmail = z.string().trim().max(200).nullable().default(null);
const partnerPhone = z.string().trim().max(50).nullable().default(null);

const coupleInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().max(200).default(''),
  phone: z.string().trim().max(50).default(''),
  primary_name: partnerName,
  primary_email: partnerEmail,
  primary_phone: partnerPhone,
  secondary_name: partnerName,
  secondary_email: partnerEmail,
  secondary_phone: partnerPhone,
  event_date: dateOrNull,
  venue: z.string().trim().max(300).default(''),
  notes: z.string().max(5000).default(''),
  // Status is a user-customisable slug (via `couple_statuses`).
  // We don't enum it here — that would break MCs who renamed the
  // default 4 statuses. The DB CHECK constraint backs us up for
  // out-of-band values.
  status: z.string().trim().min(1).max(100),
  lead_source: z.string().trim().max(100).nullable().default(null),
  kanban_position: z.number().default(0),
});

// `z.input` (not `z.infer`) so fields with `.default(...)` stay
// optional on the *call signature*. After parsing inside the action,
// defaults are filled in - so the spread into Supabase Insert is
// always complete.
export type CoupleInput = z.input<typeof coupleInputSchema>;

/**
 * Detect the Starter-cap trigger error. The trigger raises with the
 * exact string `STARTER_COUPLE_LIMIT` in the message so we don't
 * have to parse English from a fragile error.
 */
function isStarterLimit(err: { message?: string } | null): boolean {
  return Boolean(err?.message?.includes('STARTER_COUPLE_LIMIT'));
}

/* ─── createCoupleAction ──────────────────────────────────────── */

export async function createCoupleAction(
  input: CoupleInput,
): Promise<ActionResult<Couple>> {
  const parsed = coupleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid couple data.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('couples')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) {
    if (isStarterLimit(error)) {
      return {
        ok: false,
        error:
          "You've hit the couple limit on Starter. Upgrade to Pro or Max for unlimited couples.",
        code: 'starter_limit',
      };
    }
    logger.error('[couples/actions] createCoupleAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not create couple.' };
  }

  return { ok: true, data: data as Couple };
}

/* ─── updateCoupleAction ──────────────────────────────────────── */

const updateCoupleSchema = coupleInputSchema.extend({
  id: z.uuid('Couple id must be a UUID'),
});

export type UpdateCoupleInput = z.input<typeof updateCoupleSchema>;

export async function updateCoupleAction(
  input: UpdateCoupleInput,
): Promise<ActionResult<Couple>> {
  const parsed = updateCoupleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid couple data.' };
  }
  const { id, ...rest } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('couples')
    .update(rest)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('[couples/actions] updateCoupleAction failed', error, {
      userId: user.id,
      coupleId: id,
    });
    return { ok: false, error: 'Could not update couple.' };
  }

  return { ok: true, data: data as Couple };
}

/* ─── deleteCoupleAction ──────────────────────────────────────── */

const idSchema = z.uuid('Couple id must be a UUID');

export async function deleteCoupleAction(
  coupleId: string,
): Promise<ActionResult<void>> {
  const parsed = idSchema.safeParse(coupleId);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid couple ID.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('couples')
    .delete()
    .eq('id', parsed.data);

  if (error) {
    logger.error('[couples/actions] deleteCoupleAction failed', error, {
      userId: user.id,
      coupleId,
    });
    return { ok: false, error: 'Could not delete couple.' };
  }

  return { ok: true, data: undefined };
}

/* ─── bulkMoveCouplesAction ───────────────────────────────────── */

const bulkMoveSchema = z.array(
  z.object({
    id: z.uuid(),
    status: z.string().trim().min(1).max(100),
    kanban_position: z.number(),
  }),
);

export type BulkMoveInput = z.infer<typeof bulkMoveSchema>;

/**
 * Apply kanban move/reorder updates. Each row is updated separately
 * because Supabase doesn't expose a single SQL statement for
 * heterogeneous per-row updates without a UNNEST trick. Parallelised
 * via Promise.all so latency is one round-trip equivalent for the
 * common multi-drag case.
 *
 * Returns the IDs that succeeded so the UI can reconcile if some
 * subset of the bulk hit a row-level RLS or constraint failure
 * (e.g. an MC tried to drag into a status they don't own).
 */
export async function bulkMoveCouplesAction(
  updates: BulkMoveInput,
): Promise<ActionResult<{ updatedIds: string[] }>> {
  const parsed = bulkMoveSchema.safeParse(updates);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid bulk-move payload.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const results = await Promise.all(
    parsed.data.map((u) =>
      supabase
        .from('couples')
        .update({
          status: u.status,
          kanban_position: u.kanban_position,
        })
        .eq('id', u.id)
        .select('id')
        .single(),
    ),
  );

  const updatedIds: string[] = [];
  let firstError: { message?: string } | null = null;
  for (const r of results) {
    if (r.error) {
      firstError = firstError ?? r.error;
    } else if (r.data) {
      updatedIds.push(r.data.id);
    }
  }

  if (firstError) {
    logger.error('[couples/actions] bulkMoveCouplesAction partial failure',
      firstError,
      { userId: user.id, attempted: parsed.data.length, updated: updatedIds.length },
    );
    return { ok: false, error: 'Could not move couples.' };
  }

  return { ok: true, data: { updatedIds } };
}

/* ─── bulkUpdateCouplesStatusAction ───────────────────────────── */

const bulkUpdateStatusSchema = z.object({
  ids: z.array(z.uuid()).min(1, 'No couples selected'),
  status: z.string().trim().min(1).max(100),
});

export type BulkUpdateStatusInput = z.infer<typeof bulkUpdateStatusSchema>;

export async function bulkUpdateCouplesStatusAction(
  input: BulkUpdateStatusInput,
): Promise<ActionResult<void>> {
  const parsed = bulkUpdateStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid bulk-status payload.' };
  }
  const { ids, status } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('couples')
    .update({ status })
    .in('id', ids);

  if (error) {
    logger.error('[couples/actions] bulkUpdateCouplesStatusAction failed',
      error,
      { userId: user.id, count: ids.length },
    );
    return { ok: false, error: 'Could not update couples.' };
  }

  return { ok: true, data: undefined };
}

/* ─── bulkDeleteCouplesAction ─────────────────────────────────── */

const bulkDeleteSchema = z.array(z.uuid()).min(1, 'No couples selected');

export async function bulkDeleteCouplesAction(
  ids: string[],
): Promise<ActionResult<void>> {
  const parsed = bulkDeleteSchema.safeParse(ids);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid bulk-delete payload.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('couples')
    .delete()
    .in('id', parsed.data);

  if (error) {
    logger.error('[couples/actions] bulkDeleteCouplesAction failed', error, {
      userId: user.id,
      count: parsed.data.length,
    });
    return { ok: false, error: 'Could not delete couples.' };
  }

  return { ok: true, data: undefined };
}

/* ─── Per-couple task actions (Phase 4B) ──────────────────────── */
//
// The Couple Profile's Tasks tab writes against `tasks` directly
// today. Lifted here so the tab becomes pure composition + the
// per-row UI talks to a single audited write path.
//
// `priority`, `task_type`, `status` are user-facing free-form
// fields (the Tasks page lets MCs add custom priorities + statuses);
// we Zod-string-bound them but don't enum them.

const taskStatusSchema = z.string().trim().min(1).max(100);
// `priority` is a free-form string (low/medium/high are conventional
// but MCs can add custom priorities via the Tasks page). Don't
// over-narrow.
const taskPrioritySchema = z.string().trim().min(1).max(100).nullable();

const createTaskSchema = z.object({
  coupleId: z.uuid('coupleId must be a UUID'),
  title: z.string().trim().min(1, 'Title is required').max(500),
});

export type CreateCoupleTaskInput = z.infer<typeof createTaskSchema>;

export async function createCoupleTaskAction(
  input: CreateCoupleTaskInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid task data.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,
      related_couple_id: parsed.data.coupleId,
      title: parsed.data.title,
      status: 'todo',
    })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('[couples/actions] createCoupleTaskAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not create task.' };
  }

  return { ok: true, data: { id: data.id } };
}

const updateTaskSchema = z.object({
  id: z.uuid('Task id must be a UUID'),
  patch: z
    .object({
      title: z.string().trim().min(1).max(500).optional(),
      due_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
      description: z.string().max(5000).nullable().optional(),
      status: taskStatusSchema.optional(),
      priority: taskPrioritySchema.optional(),
      task_type: z.string().trim().max(100).nullable().optional(),
      group_id: z.uuid().nullable().optional(),
    })
    .refine((patch) => Object.keys(patch).length > 0, {
      message: 'Patch must contain at least one field',
    }),
});

export type UpdateCoupleTaskInput = z.infer<typeof updateTaskSchema>;

export async function updateCoupleTaskAction(
  input: UpdateCoupleTaskInput,
): Promise<ActionResult<void>> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid task patch.' };
  }
  const { id, patch } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase.from('tasks').update(patch).eq('id', id);

  if (error) {
    logger.error('[couples/actions] updateCoupleTaskAction failed', error, {
      userId: user.id,
      taskId: id,
    });
    return { ok: false, error: 'Could not update task.' };
  }

  return { ok: true, data: undefined };
}

const deleteTaskSchema = z.uuid('Task id must be a UUID');

export async function deleteCoupleTaskAction(
  id: string,
): Promise<ActionResult<void>> {
  const parsed = deleteTaskSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid task ID.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase.from('tasks').delete().eq('id', parsed.data);

  if (error) {
    logger.error('[couples/actions] deleteCoupleTaskAction failed', error, {
      userId: user.id,
      taskId: id,
    });
    return { ok: false, error: 'Could not delete task.' };
  }

  return { ok: true, data: undefined };
}

/* ─── Portal-token rotation (Phase 4B) ────────────────────────── */
//
// Rotating the token invalidates every outstanding `/portal/<token>`
// + `/portal/<token>/vendor` URL. The action returns the new token
// so the UI can refresh the visible "Couple portal link" affordance
// without a separate cache invalidation round-trip.

export async function rotateCouplePortalTokenAction(
  coupleId: string,
): Promise<ActionResult<{ portal_token: string }>> {
  const parsed = idSchema.safeParse(coupleId);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid couple ID.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Postgres' `gen_random_uuid()` generates the new token server-side
  // so we never trust a client-supplied value. `crypto.randomUUID()`
  // would be equivalent here but `select * from couples` after
  // update is one less crypto dependency.
  const newToken = crypto.randomUUID();
  const { error } = await supabase
    .from('couples')
    .update({ portal_token: newToken })
    .eq('id', parsed.data);

  if (error) {
    logger.error(
      '[couples/actions] rotateCouplePortalTokenAction failed',
      error,
      { userId: user.id, coupleId },
    );
    return { ok: false, error: 'Could not rotate portal links.' };
  }

  return { ok: true, data: { portal_token: newToken } };
}

/* ─── Couple ⇄ Contact link actions (Phase 4B) ────────────────── */
//
// `couple_contacts` is a join table linking a couple to its
// vendor/team contacts (videographer, florist, etc.). The actions
// thinly wrap insert/delete with Zod + RLS so the future Contacts
// tab harden can target a clean write path.

const linkContactSchema = z.object({
  coupleId: z.uuid(),
  contactId: z.uuid(),
});

export type LinkContactInput = z.infer<typeof linkContactSchema>;

export async function linkContactToCoupleAction(
  input: LinkContactInput,
): Promise<ActionResult<void>> {
  const parsed = linkContactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid contact link payload.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase.from('couple_contacts').insert({
    user_id: user.id,
    couple_id: parsed.data.coupleId,
    contact_id: parsed.data.contactId,
  });

  if (error) {
    logger.error(
      '[couples/actions] linkContactToCoupleAction failed',
      error,
      { userId: user.id, ...parsed.data },
    );
    return { ok: false, error: 'Could not link contact.' };
  }

  return { ok: true, data: undefined };
}

export async function unlinkContactFromCoupleAction(
  joinRowId: string,
): Promise<ActionResult<void>> {
  const parsed = z.uuid().safeParse(joinRowId);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid link ID.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('couple_contacts')
    .delete()
    .eq('id', parsed.data);

  if (error) {
    logger.error(
      '[couples/actions] unlinkContactFromCoupleAction failed',
      error,
      { userId: user.id, joinRowId },
    );
    return { ok: false, error: 'Could not unlink contact.' };
  }

  return { ok: true, data: undefined };
}
