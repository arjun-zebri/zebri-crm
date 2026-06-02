/**
 * Server actions for the Events surface (Phase 4C).
 *
 * Events are couple-owned (`events.couple_id` is NOT NULL). Every
 * action runs against an RLS-scoped Supabase client - the user is
 * the authenticated session - and validates input with Zod before
 * any write. Tagged `ActionResult<T>` results match the couples
 * actions module so the UI can pattern-match the same way.
 *
 * Three groups of actions:
 *
 * 1. **Event CRUD** - create / update / delete the `events` row.
 * 2. **Per-event task CRUD** - the Tasks tab inside the Event
 *    Profile writes `tasks` rows with `related_event_id`. Mirrors
 *    the couple-task actions but scoped to an event.
 * 3. **Timeline + contact-link CRUD** - `timeline_items` writes
 *    (used by the day-calendar + the couple's Timeline tab) and
 *    `event_contacts` link/unlink (used by the Vendors tab).
 *
 * @module lib/events/actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { createClient } from '@/lib/supabase/server';

/**
 * Strip undefined-valued keys from a parsed Zod patch object. Zod
 * `.optional()` produces `T | undefined`; the generated Supabase
 * `Update<Row>` types reject `undefined` under exactOptionalPropertyTypes
 * (only missing keys are valid). This helper drops them so the spread
 * matches.
 */
function compactPatch<T extends Record<string, unknown>>(
  patch: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const result = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) result[k] = v;
  }
  return result as { [K in keyof T]: Exclude<T[K], undefined> };
}

/* ─── Tagged result type ───────────────────────────────────────── */

export interface ActionSuccess<T> {
  ok: true;
  data: T;
}

export interface ActionFailure {
  ok: false;
  error: string;
}

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

/* ─── Shared shapes ────────────────────────────────────────────── */

const uuidSchema = z.uuid();
// Postgres date columns expect YYYY-MM-DD. We accept the canonical
// form and reject anything that wouldn't round-trip cleanly.
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
// `time` in HH:MM (24-hour). The timeline-item start_time is a
// Postgres `time` column, not a timestamptz - local clock time
// matters here, not UTC.
const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM');

const eventStatusSchema = z.enum(['upcoming', 'completed', 'cancelled']);

/* ─── Event CRUD ──────────────────────────────────────────────── */

const eventInputSchema = z.object({
  couple_id: uuidSchema,
  date: dateSchema,
  // Optional short label (e.g. "Ceremony", "Reception"). Couples often
  // run multiple events on the same day, so the events list / calendar
  // need something more specific than venue to distinguish them.
  title: z.string().trim().max(200).nullable().default(null),
  venue: z.string().trim().max(300).default(''),
  // `.nullable().default(null)` (not `.nullable().optional()`) so the
  // parsed shape always has the key. Avoids exactOptionalPropertyTypes
  // mismatches when spreading into the Supabase Insert<'events'> arg.
  venue_phone: z.string().trim().max(50).nullable().default(null),
  venue_website: z.string().trim().max(500).nullable().default(null),
  venue_lat: z.number().nullable().default(null),
  venue_lng: z.number().nullable().default(null),
  timeline_notes: z.string().max(10_000).default(''),
  status: eventStatusSchema.default('upcoming'),
});

// Use z.input (not z.infer/z.output) so .default(null) fields stay
// optional on the *call signature*. After parsing, the output has
// every default applied - so the spread into Supabase Insert is
// always complete.
export type EventInput = z.input<typeof eventInputSchema>;

export async function createEventAction(
  input: EventInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid event data.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('events')
    .insert({ ...parsed.data, user_id: user.id })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('[events/actions] createEventAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not create event.' };
  }

  return { ok: true, data: { id: data.id } };
}

const updateEventSchema = eventInputSchema.extend({
  id: uuidSchema,
});

export type UpdateEventInput = z.input<typeof updateEventSchema>;

export async function updateEventAction(
  input: UpdateEventInput,
): Promise<ActionResult<void>> {
  const parsed = updateEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid event data.' };
  }
  const { id, ...rest } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase.from('events').update(rest).eq('id', id);

  if (error) {
    logger.error('[events/actions] updateEventAction failed', error, {
      userId: user.id,
      eventId: id,
    });
    return { ok: false, error: 'Could not update event.' };
  }

  return { ok: true, data: undefined };
}

export async function deleteEventAction(
  id: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid event ID.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase.from('events').delete().eq('id', parsed.data);

  if (error) {
    logger.error('[events/actions] deleteEventAction failed', error, {
      userId: user.id,
      eventId: id,
    });
    return { ok: false, error: 'Could not delete event.' };
  }

  return { ok: true, data: undefined };
}

/* ─── Event share-token controls ──────────────────────────────── */
//
// The event-timeline tab exposes a public share URL
// (`/event-timeline/<share_token>`) behind a per-event toggle.
// Both controls are owner-only writes. Pulled out of `updateEvent`
// so callers don't have to construct the full event-update shape
// for a single-flag flip.

export async function setEventShareEnabledAction(
  eventId: string,
  enabled: boolean,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(eventId);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid event ID.' };
  }
  if (typeof enabled !== 'boolean') {
    return { ok: false, error: 'Invalid toggle value.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('events')
    .update({ share_token_enabled: enabled })
    .eq('id', parsed.data);

  if (error) {
    logger.error(
      '[events/actions] setEventShareEnabledAction failed',
      error,
      { userId: user.id, eventId, enabled },
    );
    return { ok: false, error: 'Could not update share setting.' };
  }

  return { ok: true, data: undefined };
}

/**
 * Generate a new share token for the event, invalidating any
 * outstanding `/event-timeline/<token>` URLs. Returns the new
 * token so the UI can refresh the visible affordance without a
 * separate cache invalidation round-trip.
 */
export async function rotateEventShareTokenAction(
  eventId: string,
): Promise<ActionResult<{ share_token: string }>> {
  const parsed = uuidSchema.safeParse(eventId);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid event ID.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const newToken = crypto.randomUUID();
  const { error } = await supabase
    .from('events')
    .update({ share_token: newToken })
    .eq('id', parsed.data);

  if (error) {
    logger.error(
      '[events/actions] rotateEventShareTokenAction failed',
      error,
      { userId: user.id, eventId },
    );
    return { ok: false, error: 'Could not rotate share link.' };
  }

  return { ok: true, data: { share_token: newToken } };
}

/* ─── Per-event task CRUD ─────────────────────────────────────── */

const taskStatusSchema = z.string().trim().min(1).max(100);
const taskPrioritySchema = z.string().trim().min(1).max(100).nullable();

const createEventTaskSchema = z.object({
  eventId: uuidSchema,
  title: z.string().trim().min(1, 'Title is required').max(500),
});

export type CreateEventTaskInput = z.input<typeof createEventTaskSchema>;

export async function createEventTaskAction(
  input: CreateEventTaskInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createEventTaskSchema.safeParse(input);
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
      related_event_id: parsed.data.eventId,
      title: parsed.data.title,
      status: 'todo',
    })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('[events/actions] createEventTaskAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not create task.' };
  }

  return { ok: true, data: { id: data.id } };
}

const updateTaskSchema = z.object({
  id: uuidSchema,
  patch: z
    .object({
      title: z.string().trim().min(1).max(500).optional(),
      due_date: dateSchema.nullable().optional(),
      description: z.string().max(5000).nullable().optional(),
      status: taskStatusSchema.optional(),
      priority: taskPrioritySchema.optional(),
      task_type: z.string().trim().max(100).nullable().optional(),
      group_id: uuidSchema.nullable().optional(),
    })
    .refine((patch) => Object.keys(patch).length > 0, {
      message: 'Patch must contain at least one field',
    }),
});

export type UpdateEventTaskInput = z.input<typeof updateTaskSchema>;

export async function updateEventTaskAction(
  input: UpdateEventTaskInput,
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

  const { error } = await supabase
    .from('tasks')
    .update(compactPatch(patch))
    .eq('id', id);

  if (error) {
    logger.error('[events/actions] updateEventTaskAction failed', error, {
      userId: user.id,
      taskId: id,
    });
    return { ok: false, error: 'Could not update task.' };
  }

  return { ok: true, data: undefined };
}

export async function deleteEventTaskAction(
  id: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(id);
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
    logger.error('[events/actions] deleteEventTaskAction failed', error, {
      userId: user.id,
      taskId: id,
    });
    return { ok: false, error: 'Could not delete task.' };
  }

  return { ok: true, data: undefined };
}

/* ─── Timeline-item CRUD ──────────────────────────────────────── */

const createTimelineItemSchema = z.object({
  event_id: uuidSchema,
  title: z.string().trim().min(1, 'Title is required').max(500),
  start_time: timeSchema.nullable().default(null),
  description: z.string().max(5000).nullable().default(null),
  duration_min: z.number().int().min(0).max(1440).nullable().default(null),
  contact_id: uuidSchema.nullable().default(null),
  position: z.number().int().default(0),
  pending_review: z.boolean().default(false),
});

export type CreateTimelineItemInput = z.input<typeof createTimelineItemSchema>;

export async function createTimelineItemAction(
  input: CreateTimelineItemInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTimelineItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid timeline item.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('timeline_items')
    .insert({ ...parsed.data, user_id: user.id })
    .select('id')
    .single();

  if (error || !data) {
    logger.error(
      '[events/actions] createTimelineItemAction failed',
      error,
      { userId: user.id },
    );
    return { ok: false, error: 'Could not create timeline item.' };
  }

  return { ok: true, data: { id: data.id } };
}

const updateTimelineItemSchema = z.object({
  id: uuidSchema,
  patch: z
    .object({
      title: z.string().trim().min(1).max(500).optional(),
      start_time: timeSchema.nullable().optional(),
      description: z.string().max(5000).nullable().optional(),
      duration_min: z.number().int().min(0).max(1440).nullable().optional(),
      contact_id: uuidSchema.nullable().optional(),
      position: z.number().int().optional(),
      pending_review: z.boolean().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, {
      message: 'Patch must contain at least one field',
    }),
});

export type UpdateTimelineItemInput = z.input<typeof updateTimelineItemSchema>;

export async function updateTimelineItemAction(
  input: UpdateTimelineItemInput,
): Promise<ActionResult<void>> {
  const parsed = updateTimelineItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid timeline patch.' };
  }
  const { id, patch } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('timeline_items')
    .update(compactPatch(patch))
    .eq('id', id);

  if (error) {
    logger.error(
      '[events/actions] updateTimelineItemAction failed',
      error,
      { userId: user.id, itemId: id },
    );
    return { ok: false, error: 'Could not update timeline item.' };
  }

  return { ok: true, data: undefined };
}

export async function deleteTimelineItemAction(
  id: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid timeline item ID.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('timeline_items')
    .delete()
    .eq('id', parsed.data);

  if (error) {
    logger.error(
      '[events/actions] deleteTimelineItemAction failed',
      error,
      { userId: user.id, itemId: id },
    );
    return { ok: false, error: 'Could not delete timeline item.' };
  }

  return { ok: true, data: undefined };
}

/**
 * Bulk-insert timeline items (used when applying a template to an
 * event). The DB-side `position` defaults are inconvenient here -
 * callers supply explicit positions so the visual order matches
 * what the template intended.
 */
const bulkInsertTimelineSchema = z.array(createTimelineItemSchema).min(1);

export async function bulkInsertTimelineItemsAction(
  items: CreateTimelineItemInput[],
): Promise<ActionResult<{ count: number }>> {
  const parsed = bulkInsertTimelineSchema.safeParse(items);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid timeline items.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const rows = parsed.data.map((item) => ({ ...item, user_id: user.id }));
  const { data, error } = await supabase
    .from('timeline_items')
    .insert(rows)
    .select('id');

  if (error) {
    logger.error(
      '[events/actions] bulkInsertTimelineItemsAction failed',
      error,
      { userId: user.id, count: rows.length },
    );
    return { ok: false, error: 'Could not insert timeline items.' };
  }

  return { ok: true, data: { count: data?.length ?? 0 } };
}

/* ─── Event ⇄ Contact link CRUD ───────────────────────────────── */

const linkContactSchema = z.object({
  event_id: uuidSchema,
  contact_id: uuidSchema,
});

export type LinkContactToEventInput = z.input<typeof linkContactSchema>;

export async function linkContactToEventAction(
  input: LinkContactToEventInput,
): Promise<ActionResult<void>> {
  const parsed = linkContactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid link payload.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase.from('event_contacts').insert({
    user_id: user.id,
    event_id: parsed.data.event_id,
    contact_id: parsed.data.contact_id,
  });

  if (error) {
    logger.error('[events/actions] linkContactToEventAction failed', error, {
      userId: user.id,
      ...parsed.data,
    });
    return { ok: false, error: 'Could not link contact.' };
  }

  return { ok: true, data: undefined };
}

/**
 * Unlink by composite (event_id + contact_id) rather than the join
 * row's id - the UI maintains a per-event list keyed on contact_id
 * so this matches how the click handlers fire.
 */
export async function unlinkContactFromEventAction(
  input: LinkContactToEventInput,
): Promise<ActionResult<void>> {
  const parsed = linkContactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid link payload.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('event_contacts')
    .delete()
    .eq('event_id', parsed.data.event_id)
    .eq('contact_id', parsed.data.contact_id);

  if (error) {
    logger.error(
      '[events/actions] unlinkContactFromEventAction failed',
      error,
      { userId: user.id, ...parsed.data },
    );
    return { ok: false, error: 'Could not unlink contact.' };
  }

  return { ok: true, data: undefined };
}

const bulkLinkContactsSchema = z.object({
  event_id: uuidSchema,
  contact_ids: z.array(uuidSchema).min(1),
});

export type BulkLinkContactsInput = z.input<typeof bulkLinkContactsSchema>;

/**
 * Used when creating a new event with a pre-selected vendor team -
 * inserts every link in one round-trip.
 */
export async function bulkLinkContactsToEventAction(
  input: BulkLinkContactsInput,
): Promise<ActionResult<void>> {
  const parsed = bulkLinkContactsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid bulk-link payload.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const rows = parsed.data.contact_ids.map((contact_id) => ({
    user_id: user.id,
    event_id: parsed.data.event_id,
    contact_id,
  }));

  const { error } = await supabase.from('event_contacts').insert(rows);

  if (error) {
    logger.error(
      '[events/actions] bulkLinkContactsToEventAction failed',
      error,
      { userId: user.id, count: rows.length },
    );
    return { ok: false, error: 'Could not link contacts.' };
  }

  return { ok: true, data: undefined };
}
