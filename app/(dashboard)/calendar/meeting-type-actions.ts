/**
 * Server actions for meeting types.
 *
 * Lifts meeting-type CRUD operations out of the UI layer so hooks
 * become thin React Query wrappers around server-validated mutations.
 * Every action:
 *
 * - **Zod-validates** the input so clients cannot corrupt meeting-type
 *   configurations (duration, location type, buffers).
 * - **RLS-scoped** Supabase client; the user is the authenticated session.
 * - Returns a tagged `{ ok, data } | { ok: false, error }` result the
 *   hook can pattern-match on.
 *
 * @module app/(dashboard)/calendar/meeting-type-actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

import { meetingTypeInputSchema, updateMeetingTypeSchema } from './meeting-type-schema';
import type {
  MeetingTypeAvailabilityInput,
  MeetingTypeInput,
} from './meeting-type-schema';

export type { MeetingTypeInput, UpdateMeetingTypeInput } from './meeting-type-schema';

/* ─── Tagged result type ───────────────────────────────────────── */

/**
 * Successful action result carrying typed data.
 */
export interface ActionSuccess<T> {
  ok: true;
  data: T;
}

/**
 * Failed action result carrying an error message.
 */
export interface ActionFailure {
  ok: false;
  error: string;
}

/**
 * Tagged union of success or failure. Pattern-match with `if (result.ok)`.
 */
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

/* ─── Schemas ──────────────────────────────────────────────────── */
// Schemas live in ./meeting-type-schema (a plain module): Next.js allows
// only async-function exports from 'use server' files, so exporting a
// Zod object here crashes the module at runtime.

/**
 * Database row type for meeting types.
 */
type MeetingType = Database['public']['Tables']['meeting_types']['Row'];

/* ─── listMeetingTypesAction ──────────────────────────────────── */

/**
 * Fetch all meeting types for the authenticated user.
 *
 * @returns ordered by created_at descending, or an error.
 */
export async function listMeetingTypesAction(): Promise<ActionResult<MeetingType[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('meeting_types')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('[calendar/meeting-type-actions] listMeetingTypesAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not load meeting types.' };
  }

  return { ok: true, data: (data as MeetingType[]) || [] };
}

/* ─── createMeetingTypeAction ──────────────────────────────────── */

/**
 * Create a new meeting type for the authenticated user.
 *
 * @param input - validated meeting type fields
 * @returns the newly created meeting type, or an error
 */
export async function createMeetingTypeAction(
  input: MeetingTypeInput,
): Promise<ActionResult<MeetingType>> {
  const parsed = meetingTypeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid meeting type data.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // `availability` is not a column: it is the type's own weekly hours,
  // stored in a child table below.
  const { availability, ...columns } = parsed.data;

  const { data, error } = await supabase
    .from('meeting_types')
    .insert({
      ...columns,
      uses_custom_availability: availability?.custom ?? false,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    logger.error('[calendar/meeting-type-actions] createMeetingTypeAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not create meeting type.' };
  }

  const row = data as MeetingType;

  if (availability?.custom) {
    const written = await replaceMeetingTypeRules(
      supabase,
      user.id,
      row.id,
      availability.rules ?? [],
    );
    if (!written) {
      return { ok: false, error: 'Meeting type saved, but its hours could not be stored.' };
    }
  }

  return { ok: true, data: row };
}

/* ─── updateMeetingTypeAction ──────────────────────────────────── */

/**
 * Update an existing meeting type.
 *
 * @param id - the meeting type UUID
 * @param input - validated meeting type fields to update
 * @returns the updated meeting type, or an error
 */
export async function updateMeetingTypeAction(
  id: string,
  input: MeetingTypeInput,
): Promise<ActionResult<MeetingType>> {
  const parsed = updateMeetingTypeSchema.safeParse({ id, ...input });
  if (!parsed.success) {
    return { ok: false, error: 'Invalid meeting type data.' };
  }
  const { id: meetingTypeId, availability, ...rest } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // An absent `availability` leaves the stored hours untouched. The card's
  // pause action rebuilds its payload from the row, which carries no
  // rules, so writing unconditionally here would wipe a type's schedule
  // every time someone paused it.
  const { data, error } = await supabase
    .from('meeting_types')
    .update(
      availability
        ? { ...rest, uses_custom_availability: availability.custom }
        : rest,
    )
    .eq('id', meetingTypeId)
    .select()
    .single();

  if (error) {
    logger.error('[calendar/meeting-type-actions] updateMeetingTypeAction failed', error, {
      userId: user.id,
      meetingTypeId,
    });
    return { ok: false, error: 'Could not update meeting type.' };
  }

  if (availability) {
    const written = await replaceMeetingTypeRules(
      supabase,
      user.id,
      meetingTypeId,
      availability.custom ? (availability.rules ?? []) : [],
    );
    if (!written) {
      return { ok: false, error: 'Meeting type saved, but its hours could not be stored.' };
    }
  }

  return { ok: true, data: data as MeetingType };
}

/* ─── per-type weekly hours ────────────────────────────────────── */

/**
 * Replace every stored window for one meeting type.
 *
 * Delete-then-insert, matching how the user-level availability editor
 * saves. Rows are scoped by meeting_type_id AND user_id so a malformed id
 * cannot reach another tenant's rows; RLS enforces the same thing, this
 * is belt and braces.
 *
 * Falling back to the standard hours passes an empty list, which clears
 * the rows: a type that is not on custom hours should not keep a stale
 * schedule waiting to reappear.
 *
 * @returns true on success; false when either statement failed
 */
async function replaceMeetingTypeRules(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  meetingTypeId: string,
  rules: NonNullable<MeetingTypeAvailabilityInput['rules']>,
): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from('meeting_type_availability_rules')
    .delete()
    .eq('meeting_type_id', meetingTypeId)
    .eq('user_id', userId);

  if (deleteError) {
    logger.error(
      '[calendar/meeting-type-actions] clearing meeting type hours failed',
      deleteError,
      { userId, meetingTypeId },
    );
    return false;
  }

  if (rules.length === 0) return true;

  const { error: insertError } = await supabase
    .from('meeting_type_availability_rules')
    .insert(
      rules.map((rule) => ({
        user_id: userId,
        meeting_type_id: meetingTypeId,
        weekday: rule.weekday,
        start_time: rule.start_time,
        end_time: rule.end_time,
      })),
    );

  if (insertError) {
    logger.error(
      '[calendar/meeting-type-actions] storing meeting type hours failed',
      insertError,
      { userId, meetingTypeId },
    );
    return false;
  }

  return true;
}

/* ─── getMeetingTypeAvailabilityAction ─────────────────────────── */

/**
 * Load one meeting type's own weekly hours.
 *
 * Returns an empty list for a type on the MC's standard hours; the caller
 * decides what to seed the editor with in that case.
 *
 * @param meetingTypeId - the meeting type UUID
 */
export async function getMeetingTypeAvailabilityAction(
  meetingTypeId: string,
): Promise<ActionResult<{ weekday: number; start_time: string; end_time: string }[]>> {
  const parsed = z.uuid('Meeting type id must be a UUID').safeParse(meetingTypeId);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid meeting type ID.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('meeting_type_availability_rules')
    .select('weekday, start_time, end_time')
    .eq('meeting_type_id', parsed.data);

  if (error) {
    logger.error(
      '[calendar/meeting-type-actions] getMeetingTypeAvailabilityAction failed',
      error,
      { userId: user.id, meetingTypeId },
    );
    return { ok: false, error: 'Could not load the hours for this meeting type.' };
  }

  return { ok: true, data: data ?? [] };
}

/* ─── deleteMeetingTypeAction ──────────────────────────────────── */

const idSchema = z.uuid('Meeting type id must be a UUID');

/**
 * Delete a meeting type.
 *
 * @param id - the meeting type UUID
 * @returns success or error
 */
export async function deleteMeetingTypeAction(id: string): Promise<ActionResult<void>> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid meeting type ID.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('meeting_types')
    .delete()
    .eq('id', parsed.data);

  if (error) {
    logger.error('[calendar/meeting-type-actions] deleteMeetingTypeAction failed', error, {
      userId: user.id,
      meetingTypeId: id,
    });
    return { ok: false, error: 'Could not delete meeting type.' };
  }

  return { ok: true, data: undefined };
}
