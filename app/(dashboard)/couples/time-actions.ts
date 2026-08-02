/**
 * Server actions for per-couple time tracking.
 *
 * Every action is Zod-validated, runs on the RLS-scoped Supabase client
 * (never the service-role key), and returns the couples surface's tagged
 * {@link ActionResult}, so the React Query wrappers can pattern-match and
 * the provider-level Slack alert fires on failure.
 *
 * The single running timer is expressed as a row with `ended_at is null`,
 * guarded by a partial unique index, so "start" is an atomic
 * stop-then-insert rather than a client-side invariant.
 *
 * @module app/(dashboard)/couples/time-actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { createClient } from '@/lib/supabase/server';
import {
  DEFAULT_CATEGORY_COLORS,
  nextCategoryColor,
  normalizeCategoryColor,
} from '@/lib/time-tracking/colors';
import { capReachedAt, isOverCap } from '@/lib/time-tracking/format';
import type { Database } from '@/types/database';
import type {
  RunningTimer,
  StoppedSession,
  TimeCategory,
  TimeEntry,
} from '@/types/time-tracking';

import type { ActionResult } from './actions';

/** Columns every entry read selects, including the flattened category. */
const ENTRY_SELECT =
  'id, couple_id, started_at, ended_at, category_id, note, auto_stopped, time_categories(name, color)';

/** Shape PostgREST returns for {@link ENTRY_SELECT}. */
interface EntryRow {
  id: string;
  couple_id: string;
  started_at: string;
  ended_at: string | null;
  category_id: string | null;
  note: string | null;
  auto_stopped: boolean;
  time_categories: CategoryEmbed | CategoryEmbed[] | null;
}

/** The joined category columns an entry read carries. */
interface CategoryEmbed {
  name: string;
  color: string | null;
}

/** Generated Update shape for a time entry, used by the patch builder. */
type EntryUpdate = Database['public']['Tables']['couple_time_entries']['Update'];

/** {@link EntryRow} plus the embedded couple name, for the pill. */
type EntryWithCoupleRow = EntryRow & {
  couples: { name: string } | { name: string }[] | null;
};

/**
 * Unwrap a PostgREST embedded to-one relation. It is typed as either an
 * object or a one-element array depending on how the relationship is
 * inferred, so both shapes have to be tolerated.
 */
function embedded<T>(value: T | T[] | null): T | undefined {
  return (Array.isArray(value) ? value[0] : value) ?? undefined;
}

/** Flatten a joined row into the app-facing {@link TimeEntry}. */
function toEntry(row: EntryRow): TimeEntry {
  return {
    id: row.id,
    couple_id: row.couple_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    category_id: row.category_id,
    category_name: embedded(row.time_categories)?.name ?? null,
    category_color: embedded(row.time_categories)?.color ?? null,
    note: row.note,
    auto_stopped: row.auto_stopped,
  };
}

/** Pair a joined row with its couple name. */
function toStoppedSession(row: EntryWithCoupleRow): StoppedSession {
  return {
    entry: toEntry(row),
    couple_name: embedded(row.couples)?.name ?? 'Couple',
  };
}

const uuid = z.uuid();
const noteSchema = z.string().trim().max(2000).nullable().optional();
const categoryName = z.string().trim().min(1, 'Name is required').max(40);
const instant = z.iso.datetime();

const createEntrySchema = z
  .object({
    couple_id: uuid,
    started_at: instant,
    ended_at: instant,
    category_id: uuid.nullable().optional(),
    note: noteSchema,
  })
  .refine((v) => Date.parse(v.ended_at) > Date.parse(v.started_at), {
    message: 'End must be after start',
    path: ['ended_at'],
  })
  .refine((v) => Date.parse(v.started_at) <= Date.now(), {
    message: 'Start cannot be in the future',
    path: ['started_at'],
  })
  .refine(
    (v) => Date.parse(v.ended_at) - Date.parse(v.started_at) <= 24 * 3_600_000,
    { message: 'A single entry cannot exceed 24 hours', path: ['ended_at'] },
  );

const updateEntrySchema = z.object({
  id: uuid,
  patch: z
    .object({
      started_at: instant.optional(),
      ended_at: instant.optional(),
      category_id: uuid.nullable().optional(),
      note: noteSchema,
    })
    .refine((p) => Object.keys(p).length > 0, {
      message: 'Patch must contain at least one field',
    })
    .refine(
      (p) =>
        !p.started_at ||
        !p.ended_at ||
        Date.parse(p.ended_at) > Date.parse(p.started_at),
      { message: 'End must be after start', path: ['ended_at'] },
    ),
});

export type CreateTimeEntryInput = z.input<typeof createEntrySchema>;
export type UpdateTimeEntryInput = z.input<typeof updateEntrySchema>;

/** Resolve the signed-in user alongside an RLS-scoped client. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** First Zod issue message, for surfacing a specific complaint inline. */
function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

/**
 * The user's running session, or null.
 *
 * This read is also where the 8h cap is enforced: a session older than
 * the cap is clamped to `started_at + 8h`, flagged `auto_stopped`, and
 * reported as "nothing running". Doing it here rather than in a cron
 * keeps the behaviour identical (a capped session is only ever observed
 * as capped) with no scheduled infrastructure to own.
 */
export async function getRunningTimerAction(): Promise<
  ActionResult<RunningTimer | null>
> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('couple_time_entries')
    .select(`${ENTRY_SELECT}, couples(name)`)
    .is('ended_at', null)
    .maybeSingle();

  if (error) {
    logger.error('[couples/time-actions] getRunningTimerAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not read the running timer.' };
  }
  if (!data) return { ok: true, data: null };

  const row = data as unknown as EntryWithCoupleRow;

  if (isOverCap(row.started_at, Date.now())) {
    const { error: capError } = await supabase
      .from('couple_time_entries')
      .update({ ended_at: capReachedAt(row.started_at), auto_stopped: true })
      .eq('id', row.id);
    if (capError) {
      logger.error('[couples/time-actions] cap clamp failed', capError, {
        userId: user.id,
        entryId: row.id,
      });
    }
    return { ok: true, data: null };
  }

  return {
    ok: true,
    data: {
      ...toStoppedSession(row),
      server_now: new Date().toISOString(),
    },
  };
}

/**
 * Stop whatever is running (if anything) and start a new session on
 * `coupleId`. The stopped session comes back too, so the caller can open
 * its note dialog: switching couples must not silently swallow the
 * chance to annotate the work just finished.
 */
export async function startCoupleTimerAction(coupleId: string): Promise<
  ActionResult<{ started: TimeEntry; stopped: StoppedSession | null }>
> {
  if (!uuid.safeParse(coupleId).success) {
    return { ok: false, error: 'Invalid couple.' };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Stop first: the partial unique index would reject the insert while
  // another session is still open.
  const previous = await stopCoupleTimerAction();
  if (!previous.ok) return { ok: false, error: previous.error };

  const { data, error } = await supabase
    .from('couple_time_entries')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      started_at: new Date().toISOString(),
    })
    .select(ENTRY_SELECT)
    .single();

  if (error || !data) {
    logger.error(
      '[couples/time-actions] startCoupleTimerAction failed',
      error,
      { userId: user.id, coupleId },
    );
    return { ok: false, error: 'Could not start the timer.' };
  }

  return {
    ok: true,
    data: {
      started: toEntry(data as unknown as EntryRow),
      stopped: previous.data,
    },
  };
}

/** Stop the user's running session, returning it (or null if none ran). */
export async function stopCoupleTimerAction(): Promise<
  ActionResult<StoppedSession | null>
> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('couple_time_entries')
    .update({ ended_at: new Date().toISOString() })
    .is('ended_at', null)
    .select(`${ENTRY_SELECT}, couples(name)`)
    .maybeSingle();

  if (error) {
    logger.error('[couples/time-actions] stopCoupleTimerAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not stop the timer.' };
  }
  if (!data) return { ok: true, data: null };

  return { ok: true, data: toStoppedSession(data as unknown as EntryWithCoupleRow) };
}

/** One couple's sessions, newest first. */
export async function listCoupleTimeEntriesAction(
  coupleId: string,
): Promise<ActionResult<TimeEntry[]>> {
  if (!uuid.safeParse(coupleId).success) {
    return { ok: false, error: 'Invalid couple.' };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('couple_time_entries')
    .select(ENTRY_SELECT)
    .eq('couple_id', coupleId)
    .order('started_at', { ascending: false });

  if (error || !data) {
    logger.error(
      '[couples/time-actions] listCoupleTimeEntriesAction failed',
      error,
      { userId: user.id, coupleId },
    );
    return { ok: false, error: 'Could not load tracked time.' };
  }
  return { ok: true, data: (data as unknown as EntryRow[]).map(toEntry) };
}

/** Log a session that was never timed live. */
export async function createCoupleTimeEntryAction(
  input: CreateTimeEntryInput,
): Promise<ActionResult<TimeEntry>> {
  const parsed = createEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error, 'Invalid entry.') };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('couple_time_entries')
    .insert({
      user_id: user.id,
      couple_id: parsed.data.couple_id,
      started_at: parsed.data.started_at,
      ended_at: parsed.data.ended_at,
      category_id: parsed.data.category_id ?? null,
      note: parsed.data.note ?? null,
    })
    .select(ENTRY_SELECT)
    .single();

  if (error || !data) {
    logger.error(
      '[couples/time-actions] createCoupleTimeEntryAction failed',
      error,
      { userId: user.id, coupleId: parsed.data.couple_id },
    );
    return { ok: false, error: 'Could not add the entry.' };
  }
  return { ok: true, data: toEntry(data as unknown as EntryRow) };
}

/** Patch one session: its times, its category, or its note. */
export async function updateCoupleTimeEntryAction(
  input: UpdateTimeEntryInput,
): Promise<ActionResult<TimeEntry>> {
  const parsed = updateEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error, 'Invalid patch.') };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Copy only the keys actually present. Spreading the parsed patch
  // would carry explicit `undefined` values, which the generated Update
  // type rejects under `exactOptionalPropertyTypes`.
  const patch: EntryUpdate = {};
  const requested = parsed.data.patch;
  if (requested.started_at !== undefined) {
    patch.started_at = requested.started_at;
  }
  if (requested.ended_at !== undefined) patch.ended_at = requested.ended_at;
  if (requested.category_id !== undefined) {
    patch.category_id = requested.category_id;
  }
  if (requested.note !== undefined) patch.note = requested.note;

  const { data, error } = await supabase
    .from('couple_time_entries')
    .update(patch)
    .eq('id', parsed.data.id)
    .select(ENTRY_SELECT)
    .single();

  if (error || !data) {
    logger.error(
      '[couples/time-actions] updateCoupleTimeEntryAction failed',
      error,
      { userId: user.id, entryId: parsed.data.id },
    );
    return { ok: false, error: 'Could not save the entry.' };
  }
  return { ok: true, data: toEntry(data as unknown as EntryRow) };
}

/** Delete one session. */
export async function deleteCoupleTimeEntryAction(
  id: string,
): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) {
    return { ok: false, error: 'Invalid entry.' };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('couple_time_entries')
    .delete()
    .eq('id', id);
  if (error) {
    logger.error(
      '[couples/time-actions] deleteCoupleTimeEntryAction failed',
      error,
      { userId: user.id, entryId: id },
    );
    return { ok: false, error: 'Could not delete the entry.' };
  }
  return { ok: true, data: null };
}

/** Columns every category read selects. */
const CATEGORY_SELECT = 'id, name, position, color';

/** The categories every user starts with, in display order. */
const STARTER_CATEGORIES = [
  'Meeting',
  'Call',
  'Admin',
  'Travel',
  'Rehearsal',
  'Ceremony',
] as const;

/**
 * The user's categories, seeding the starter set exactly once.
 *
 * The `time_categories_seeded` flag is what makes it "once": keying off
 * an empty table instead would resurrect the starter six for a user who
 * had deliberately deleted them all.
 */
export async function listTimeCategoriesAction(): Promise<
  ActionResult<TimeCategory[]>
> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: settings } = await supabase
    .from('user_public_settings')
    .select('time_categories_seeded')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!settings?.time_categories_seeded) {
    const { error: seedError } = await supabase.from('time_categories').insert(
      // Colour comes from the slot, so every MC's starter six land on
      // the same validated hues and the breakdown bar is readable
      // before anyone opens a picker.
      STARTER_CATEGORIES.map((name, position) => ({
        user_id: user.id,
        name,
        position,
        color:
          DEFAULT_CATEGORY_COLORS[position % DEFAULT_CATEGORY_COLORS.length] ??
          null,
      })),
    );
    // A duplicate-name collision here means a concurrent seed already
    // ran, which is fine: the flag write below still closes the door.
    if (seedError) {
      logger.error('[couples/time-actions] category seed failed', seedError, {
        userId: user.id,
      });
    }
    const { error: flagError } = await supabase
      .from('user_public_settings')
      .upsert(
        { user_id: user.id, time_categories_seeded: true },
        { onConflict: 'user_id' },
      );
    if (flagError) {
      logger.error('[couples/time-actions] seed flag write failed', flagError, {
        userId: user.id,
      });
    }
  }

  const { data, error } = await supabase
    .from('time_categories')
    .select(CATEGORY_SELECT)
    .order('position', { ascending: true });

  if (error || !data) {
    logger.error(
      '[couples/time-actions] listTimeCategoriesAction failed',
      error,
      { userId: user.id },
    );
    return { ok: false, error: 'Could not load categories.' };
  }
  return { ok: true, data };
}

/**
 * Create a category, or return the existing one when the name already
 * exists (case-insensitively). Type-to-create must never fail just
 * because the MC retyped something they already have.
 */
export async function createTimeCategoryAction(
  name: string,
): Promise<ActionResult<TimeCategory>> {
  const parsed = categoryName.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error, 'Invalid name.') };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: existing } = await supabase
    .from('time_categories')
    .select(CATEGORY_SELECT)
    .ilike('name', parsed.data)
    .maybeSingle();
  if (existing) return { ok: true, data: existing };

  // Position is computed server-side so two concurrent creates cannot
  // collide on a stale client-side max.
  const { data: last } = await supabase
    .from('time_categories')
    .select('position')
    .order('position', { ascending: false })
    .limit(1);
  const position = last && last.length > 0 ? (last[0]?.position ?? 0) + 1 : 0;

  // Take the first unused slot rather than the next one by position, so
  // a category created after a deletion reuses the freed colour instead
  // of duplicating a hue that is still on screen.
  const { data: inUse } = await supabase
    .from('time_categories')
    .select('color');
  const color = nextCategoryColor((inUse ?? []).map((row) => row.color));

  const { data, error } = await supabase
    .from('time_categories')
    .insert({ user_id: user.id, name: parsed.data, position, color })
    .select(CATEGORY_SELECT)
    .single();

  if (error || !data) {
    logger.error(
      '[couples/time-actions] createTimeCategoryAction failed',
      error,
      { userId: user.id },
    );
    return { ok: false, error: 'Could not create the category.' };
  }
  return { ok: true, data };
}

/** Rename one category. */
export async function renameTimeCategoryAction(input: {
  id: string;
  name: string;
}): Promise<ActionResult<TimeCategory>> {
  const parsed = z.object({ id: uuid, name: categoryName }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error, 'Invalid name.') };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('time_categories')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.id)
    .select(CATEGORY_SELECT)
    .single();

  if (error || !data) {
    logger.error(
      '[couples/time-actions] renameTimeCategoryAction failed',
      error,
      { userId: user.id, categoryId: parsed.data.id },
    );
    return { ok: false, error: 'Could not rename the category.' };
  }
  return { ok: true, data };
}

/**
 * Set one category's colour.
 *
 * Separate from {@link renameTimeCategoryAction} because the picker
 * commits colour live as the MC drags the hue strip, while a rename
 * commits once on blur. Folding them together would fire a name write
 * on every pointer move.
 */
export async function setTimeCategoryColorAction(input: {
  id: string;
  color: string;
}): Promise<ActionResult<TimeCategory>> {
  const parsed = z.object({ id: uuid, color: z.string() }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error, 'Invalid colour.') };
  }
  // Normalise before the write so the column's CHECK is never the thing
  // that reports a malformed hex to the user.
  const color = normalizeCategoryColor(parsed.data.color);
  if (!color) return { ok: false, error: 'That is not a valid colour.' };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('time_categories')
    .update({ color })
    .eq('id', parsed.data.id)
    .select(CATEGORY_SELECT)
    .single();

  if (error || !data) {
    logger.error(
      '[couples/time-actions] setTimeCategoryColorAction failed',
      error,
      { userId: user.id, categoryId: parsed.data.id },
    );
    return { ok: false, error: 'Could not save the colour.' };
  }
  return { ok: true, data };
}

/**
 * Delete one category. Sessions that referenced it survive and read as
 * uncategorised (`on delete set null`): deleting a label must never
 * destroy tracked time.
 */
export async function deleteTimeCategoryAction(
  id: string,
): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) {
    return { ok: false, error: 'Invalid category.' };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('time_categories')
    .delete()
    .eq('id', id);
  if (error) {
    logger.error(
      '[couples/time-actions] deleteTimeCategoryAction failed',
      error,
      { userId: user.id, categoryId: id },
    );
    return { ok: false, error: 'Could not delete the category.' };
  }
  return { ok: true, data: null };
}
