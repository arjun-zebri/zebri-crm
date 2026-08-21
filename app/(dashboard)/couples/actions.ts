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

import { sendAlert } from '@/lib/alerts';
import { logger } from '@/lib/alerts/logger';
import { currentPlan } from '@/lib/auth/entitlements';
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
  // "How did you hear about me" - free text, surfaced on the couple profile.
  referral_source: z.string().trim().max(200).nullable().default(null),
  // Selected package — optional field set by the couple or MC in the add/edit flow.
  selected_package_id: z.string().uuid().nullable().default(null),
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

/* ─── Couple event date (writes the real `events` row) ────────── */
//
// The couple-level `event_date` column is legacy/dead — the schedule
// lives in the couple-owned `events` table (calendar + list read from
// there). So setting a couple's wedding date, whether typed in the Add
// Couple modal or imported from CSV, must create/update a real event.

type RlsClient = Awaited<ReturnType<typeof createClient>>;

const dateOrNullStrict = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .nullable();

/**
 * Pick the event a couple "shows" as its next one: the soonest
 * upcoming (today-or-later), falling back to the most recent past. This
 * mirrors `pickNextEvent` on the list so an edit updates the same row
 * the user sees. `events` must be non-empty.
 */
function pickDisplayEventId(events: { id: string; date: string }[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...events].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  const upcoming = sorted.find((e) => e.date >= today);
  return (upcoming ?? sorted[sorted.length - 1]!).id;
}

const upsertEventDateSchema = z.object({
  coupleId: z.uuid('Couple id must be a UUID'),
  date: dateOrNullStrict,
  venue: z.string().trim().max(300).nullable().default(null),
  // Place-autocomplete metadata, optional — present when the venue was
  // picked from the maps suggestions rather than typed free-hand.
  venue_phone: z.string().trim().max(50).nullable().default(null),
  venue_website: z.string().trim().max(500).nullable().default(null),
  venue_lat: z.number().nullable().default(null),
  venue_lng: z.number().nullable().default(null),
});

export type UpsertCoupleEventDateInput = z.input<typeof upsertEventDateSchema>;

/** The event-venue columns written by an upsert (shared insert/update shape). */
type EventVenueFields = Pick<
  z.infer<typeof upsertEventDateSchema>,
  'venue' | 'venue_phone' | 'venue_website' | 'venue_lat' | 'venue_lng'
>;

/**
 * Set a couple's wedding date by creating or updating its event.
 *
 * If the couple has no events yet, a new one is created; otherwise the
 * couple's displayed event (see {@link pickDisplayEventId}) is updated
 * in place so a repeated set never piles up duplicate rows. A `null`
 * date is a no-op (we never delete events here). RLS scopes every read
 * and write to the owner, so a cross-tenant `coupleId` finds no events
 * and the INSERT/UPDATE is filtered out.
 */
export async function upsertCoupleEventDateAction(
  input: UpsertCoupleEventDateInput,
): Promise<ActionResult<void>> {
  const parsed = upsertEventDateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid event date.' };
  }
  const { coupleId, date, ...venueFields } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Clearing the date is intentionally a no-op — removing a wedding
  // date shouldn't silently delete the whole event + its timeline.
  if (date === null) return { ok: true, data: undefined };

  // Confirm the couple is ours before touching events. The `events`
  // RLS INSERT policy only checks `user_id`, so without this a caller
  // could attach an event (under their own id) to someone else's
  // couple. The couples SELECT policy scopes this read to the owner.
  const { data: couple } = await supabase
    .from('couples')
    .select('id')
    .eq('id', coupleId)
    .maybeSingle();
  if (!couple) return { ok: true, data: undefined };

  const { data: events, error: readError } = await supabase
    .from('events')
    .select('id, date')
    .eq('couple_id', coupleId);
  if (readError) {
    logger.error('[couples/actions] upsert event read failed', readError, {
      userId: user.id,
      coupleId,
    });
    return { ok: false, error: 'Could not set event date.' };
  }

  const error =
    events && events.length > 0
      ? await updateExistingEvent(
          supabase,
          pickDisplayEventId(events),
          date,
          venueFields,
        )
      : await insertCoupleEvent(supabase, user.id, coupleId, date, venueFields);

  if (error) {
    logger.error('[couples/actions] upsert event write failed', error, {
      userId: user.id,
      coupleId,
    });
    return { ok: false, error: 'Could not set event date.' };
  }
  return { ok: true, data: undefined };
}

/** Insert a wedding event for a couple. Returns the error (or null). */
async function insertCoupleEvent(
  supabase: RlsClient,
  userId: string,
  coupleId: string,
  date: string,
  venueFields: EventVenueFields,
): Promise<{ message?: string } | null> {
  const { error } = await supabase.from('events').insert({
    user_id: userId,
    couple_id: coupleId,
    date,
    venue: venueFields.venue ?? null,
    venue_phone: venueFields.venue_phone,
    venue_website: venueFields.venue_website,
    venue_lat: venueFields.venue_lat,
    venue_lng: venueFields.venue_lng,
    status: 'upcoming',
  });
  return error;
}

/**
 * Update an existing event's date, plus any venue fields the caller
 * supplied. A `null` venue means "venue not provided by this edit" (the
 * date-only path), so we leave the stored venue untouched; a non-null
 * venue replaces it along with its place metadata.
 */
async function updateExistingEvent(
  supabase: RlsClient,
  eventId: string,
  date: string,
  venueFields: EventVenueFields,
): Promise<{ message?: string } | null> {
  const patch: { date: string } & Partial<EventVenueFields> = { date };
  if (venueFields.venue !== null) {
    patch.venue = venueFields.venue;
    patch.venue_phone = venueFields.venue_phone;
    patch.venue_website = venueFields.venue_website;
    patch.venue_lat = venueFields.venue_lat;
    patch.venue_lng = venueFields.venue_lng;
  }
  const { error } = await supabase.from('events').update(patch).eq('id', eventId);
  return error;
}

/* ─── bulkCreateCouplesAction (CSV import) ────────────────────── */

/** Hard ceiling on a single import payload — a basic abuse guard so a
 *  pasted megafile can't tie up a request. The UI caps well below this. */
const MAX_IMPORT_ROWS = 500;

/** Starter free-tier couple cap. Mirrors the Postgres
 *  `enforce_starter_couple_limit` trigger (5). Kept in sync by hand —
 *  the trigger is the authoritative backstop, this just lets us slice
 *  the batch up-front instead of tripping it mid-insert. */
const STARTER_COUPLE_LIMIT_COUNT = 5;

export interface BulkImportSummary {
  /** Rows actually inserted. */
  created: number;
  /** Valid rows dropped because they'd exceed the Starter cap. */
  skippedForLimit: number;
  /** Rows that failed server-side validation, with the first reason. */
  invalidRows: { index: number; reason: string }[];
}

/**
 * Bulk-create couples from a CSV import. The client preview is
 * convenience only — every row is **re-validated here** with the same
 * `coupleInputSchema` the single-create path uses, and `user_id` is
 * taken from the session (never the payload), so RLS owns tenancy.
 *
 * Starter users are sliced to their remaining quota up-front: a single
 * multi-row insert is atomic, so relying on the Postgres cap trigger
 * mid-batch would roll back the whole import the moment one row tripped
 * it. The trigger remains the backstop for the race where couples are
 * added between our count and the insert.
 *
 * @param rows - validated-shape couple inputs (status already resolved
 *   to a real slug by the caller).
 * @returns a summary of created / limit-skipped / invalid rows. Only a
 *   genuine DB failure returns `{ ok: false }`.
 */
export async function bulkCreateCouplesAction(
  rows: CoupleInput[],
): Promise<ActionResult<BulkImportSummary>> {
  if (!Array.isArray(rows)) {
    return { ok: false, error: 'Invalid import payload.' };
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `You can import at most ${MAX_IMPORT_ROWS} couples at once.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Re-validate every row; collect the survivors and the rejects.
  const valid: z.infer<typeof coupleInputSchema>[] = [];
  const invalidRows: { index: number; reason: string }[] = [];
  rows.forEach((raw, index) => {
    const parsed = coupleInputSchema.safeParse(raw);
    if (parsed.success) valid.push(parsed.data);
    else
      invalidRows.push({
        index,
        reason: parsed.error.issues[0]?.message ?? 'Invalid row',
      });
  });

  // Starter is capped; Pro/Max are uncapped (remaining = ∞).
  let remaining = Number.POSITIVE_INFINITY;
  if (currentPlan(user) === 'starter') {
    const { count } = await supabase
      .from('couples')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    remaining = Math.max(0, STARTER_COUPLE_LIMIT_COUNT - (count ?? 0));
  }

  const insertCount = Number.isFinite(remaining)
    ? Math.min(valid.length, remaining)
    : valid.length;
  const toInsert = valid.slice(0, insertCount);
  const skippedForLimit = valid.length - toInsert.length;

  if (toInsert.length === 0) {
    return { ok: true, data: { created: 0, skippedForLimit, invalidRows } };
  }

  // `.select('id')` returns the inserted rows in input order, so we can
  // pair each new couple with its source row to create the event.
  const { data: insertedCouples, error } = await supabase
    .from('couples')
    .insert(toInsert.map((c) => ({ ...c, user_id: user.id })))
    .select('id');

  if (error || !insertedCouples) {
    if (error && isStarterLimit(error)) {
      // Race: the cap filled between our count and this insert. The
      // atomic batch rolled back, so nothing was created — report the
      // whole attempt as limit-skipped rather than a hard failure.
      return {
        ok: true,
        data: {
          created: 0,
          skippedForLimit: skippedForLimit + toInsert.length,
          invalidRows,
        },
      };
    }
    logger.error('[couples/actions] bulkCreateCouplesAction failed', error, {
      userId: user.id,
      attempted: toInsert.length,
    });
    await sendAlert({
      type: 'app_error',
      severity: 'error',
      message: `Couples CSV import failed for ${user.id}: ${error?.message ?? 'no rows returned'}`,
      source: 'couples/bulkCreateCouplesAction',
    });
    return { ok: false, error: 'Could not import couples.' };
  }

  // Create a wedding event for every imported couple that carried a
  // date — the couple-level `event_date` column is dead, so the date
  // only shows up once it's a real `events` row. Best-effort: an event
  // failure is logged but doesn't fail the (already committed) import.
  const events = insertedCouples
    .map((couple, i) => ({ couple, src: toInsert[i] }))
    .filter(({ src }) => src?.event_date)
    .map(({ couple, src }) => ({
      user_id: user.id,
      couple_id: couple.id,
      date: src!.event_date as string,
      venue: src!.venue || null,
      status: 'upcoming',
    }));
  if (events.length > 0) {
    const { error: eventError } = await supabase.from('events').insert(events);
    if (eventError) {
      logger.error('[couples/actions] import event insert failed', eventError, {
        userId: user.id,
        count: events.length,
      });
    }
  }

  return { ok: true, data: { created: toInsert.length, skippedForLimit, invalidRows } };
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
  // Optional client-generated UUID so the optimistic UI row can be
  // created with the same id that the server-side row ends up with —
  // that way cell edits (status, priority, etc.) fire `patchTask`
  // against a real UUID immediately after `+ New task` is clicked,
  // instead of failing Zod's UUID check on a `temp-` placeholder.
  // RLS still enforces ownership, so accepting a client-supplied id
  // is safe; an unlikely collision would surface as a unique-violation
  // error from Postgres.
  id: z.uuid().optional(),
  coupleId: z.uuid('coupleId must be a UUID'),
  title: z.string().trim().min(1, 'Title is required').max(500),
});

export type CreateCoupleTaskInput = z.input<typeof createTaskSchema>;

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

  const insertPayload: {
    id?: string;
    user_id: string;
    related_couple_id: string;
    title: string;
    status: string;
  } = {
    user_id: user.id,
    related_couple_id: parsed.data.coupleId,
    title: parsed.data.title,
    status: 'todo',
  };
  if (parsed.data.id) insertPayload.id = parsed.data.id;

  const { data, error } = await supabase
    .from('tasks')
    .insert(insertPayload)
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
// Rotating invalidates every outstanding link for the couple — the
// primary partner's `/portal/<portal_token>`, the secondary partner's
// `/portal/<secondary_portal_token>`, and the `/portal/<token>/vendor`
// URL. The action returns both new tokens so the UI can refresh the
// visible link affordances without a separate cache-invalidation round-trip.

export async function rotateCouplePortalTokenAction(
  coupleId: string,
): Promise<ActionResult<{ portal_token: string; secondary_portal_token: string }>> {
  const parsed = idSchema.safeParse(coupleId);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid couple ID.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Both partners' links rotate together — the primary (`portal_token`)
  // and the secondary (`secondary_portal_token`). New values are minted
  // client-side via `crypto.randomUUID()` so the update can echo them
  // straight back to the UI without a re-fetch. RLS still scopes the
  // update to the owner's couple.
  const newToken = crypto.randomUUID();
  const newSecondaryToken = crypto.randomUUID();
  const { error } = await supabase
    .from('couples')
    .update({ portal_token: newToken, secondary_portal_token: newSecondaryToken })
    .eq('id', parsed.data);

  if (error) {
    logger.error(
      '[couples/actions] rotateCouplePortalTokenAction failed',
      error,
      { userId: user.id, coupleId },
    );
    return { ok: false, error: 'Could not rotate portal links.' };
  }

  return {
    ok: true,
    data: { portal_token: newToken, secondary_portal_token: newSecondaryToken },
  };
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
