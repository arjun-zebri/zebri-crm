/**
 * Zod schemas + input types for meeting types.
 *
 * Lives OUTSIDE the 'use server' module on purpose: Next.js only allows
 * async-function exports from server-action files, so a schema exported
 * there crashes the module at runtime ("found object"). The actions and
 * the unit tests both import from here instead.
 *
 * @module app/(dashboard)/calendar/meeting-type-schema
 */
import { z } from 'zod';

import type { Database } from '@/types/database';

/** Time in HH:mm, 24-hour. Mirrors the availability editor's schema. */
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/** One weekly window belonging to a single meeting type. */
export const meetingTypeAvailabilityRuleSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    start_time: z.string().regex(timeRegex, 'Start time must be in HH:mm format'),
    end_time: z.string().regex(timeRegex, 'End time must be in HH:mm format'),
  })
  .refine(
    (rule) => toMinutes(rule.start_time) < toMinutes(rule.end_time),
    { message: 'Start time must be before end time' },
  );

/**
 * A meeting type's own weekly hours.
 *
 * `custom: false` means the type follows the MC's standard weekly hours,
 * and `rules` is ignored. `custom: true` means these windows REPLACE the
 * standard hours for this type; an empty list is legal and means the type
 * is never bookable.
 *
 * The whole object is optional on the input schema, and absent means
 * "leave the stored hours alone". That matters because
 * {@link meetingTypeRowToInput} rebuilds the payload from a row that has
 * no rules attached, so a quick pause-from-the-card update would
 * otherwise wipe a type's schedule.
 */
export const meetingTypeAvailabilitySchema = z.object({
  custom: z.boolean(),
  rules: z.array(meetingTypeAvailabilityRuleSchema).max(70).default([]),
});

/** Input type for a meeting type's own weekly hours. */
export type MeetingTypeAvailabilityInput = z.input<typeof meetingTypeAvailabilitySchema>;

/** Minutes from midnight for an HH:mm string. */
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * Input schema for creating or updating a meeting type.
 * Enforces duration range (5-480 minutes), buffer constraints,
 * and required fields. Defaults mirror the DB column defaults.
 */
export const meetingTypeInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(500).nullable().default(null),
  duration_minutes: z
    .number()
    .int()
    .min(5, 'Duration must be at least 5 minutes')
    .max(480, 'Duration must be at most 480 minutes'),
  location_type: z.enum(['video', 'phone', 'in_person']),
  address: z.string().trim().max(300).nullable().default(null),
  buffer_before_minutes: z.number().int().min(0).max(240).default(0),
  buffer_after_minutes: z.number().int().min(0).max(240).default(0),
  min_notice_hours: z.number().int().min(0).max(720).default(24),
  max_advance_days: z
    .number()
    .int()
    .min(1, 'Max advance days must be at least 1')
    .max(365),
  reminder_enabled: z.boolean().default(true),
  active: z.boolean().default(true),
  /**
   * Weekly hours for this type alone. Optional on purpose: see
   * {@link meetingTypeAvailabilitySchema}.
   */
  availability: meetingTypeAvailabilitySchema.optional(),
});

/**
 * Input type for meeting type creation/update. Uses `z.input` so fields
 * with `.default(...)` remain optional on the call signature.
 */
export type MeetingTypeInput = z.input<typeof meetingTypeInputSchema>;

/** Update variant: the same fields plus the row id. */
export const updateMeetingTypeSchema = meetingTypeInputSchema.extend({
  id: z.uuid('Meeting type id must be a UUID'),
});

/** Input type for {@link updateMeetingTypeSchema}. */
export type UpdateMeetingTypeInput = z.input<typeof updateMeetingTypeSchema>;

/**
 * Turn a stored meeting type row back into a full update input.
 *
 * The update path validates against {@link meetingTypeInputSchema}, where
 * several fields carry `.default(null)`. Sending only the field you meant to
 * change therefore does not leave the rest alone: it overwrites them with
 * their defaults, so flipping `active` from a card would silently erase the
 * meeting type's description and address. Always start from the row and
 * override the one field.
 *
 * @param row - the stored meeting type
 * @returns every field the update schema expects
 *
 * @example
 * ```ts
 * updateMeetingType({ ...meetingTypeRowToInput(row), id: row.id, active: false })
 * ```
 */
export function meetingTypeRowToInput(
  row: Database['public']['Tables']['meeting_types']['Row'],
): MeetingTypeInput {
  return {
    name: row.name,
    description: row.description,
    duration_minutes: row.duration_minutes,
    location_type: row.location_type as 'video' | 'phone' | 'in_person',
    address: row.address,
    buffer_before_minutes: row.buffer_before_minutes,
    buffer_after_minutes: row.buffer_after_minutes,
    min_notice_hours: row.min_notice_hours,
    max_advance_days: row.max_advance_days,
    reminder_enabled: row.reminder_enabled,
    active: row.active,
  };
}
