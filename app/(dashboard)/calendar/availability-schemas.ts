/**
 * Zod schemas + input types for availability rules, overrides, and the
 * MC timezone.
 *
 * Lives OUTSIDE the 'use server' module on purpose: Next.js only allows
 * async-function exports from server-action files, so a schema exported
 * there crashes the module at runtime ("found object"). The actions and
 * the unit tests both import from here instead.
 *
 * @module app/(dashboard)/calendar/availability-schemas
 */
import { z } from 'zod';

/**
 * Validates time in HH:mm format (24h).
 */
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Input schema for an availability rule.
 * Enforces weekday 0-6, HH:mm time format, and start < end.
 */
export const availabilityRuleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: z
    .string()
    .regex(timeRegex, 'Start time must be in HH:mm format (00:00 to 23:59)'),
  end_time: z
    .string()
    .regex(timeRegex, 'End time must be in HH:mm format (00:00 to 23:59)'),
}).refine(
  (data) => {
    // Compare as minutes from midnight to handle start < end correctly.
    const toMinutes = (time: string) => {
      // Regex guarantee: format is HH:mm, so split produces exactly 2 elements.
      const [h, m] = time.split(':').map(Number) as [number, number];
      return h * 60 + m;
    };
    return toMinutes(data.start_time) < toMinutes(data.end_time);
  },
  { message: 'Start time must be before end time' },
);

/**
 * Input type for an availability rule.
 */
export type AvailabilityRuleInput = z.infer<typeof availabilityRuleSchema>;

/**
 * Input schema for an override: either a block (available=false, times null)
 * or a custom window (available=true, start_time and end_time set).
 */
export const overrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  available: z.boolean(),
  start_time: z
    .string()
    .regex(timeRegex, 'Start time must be in HH:mm format')
    .nullable(),
  end_time: z
    .string()
    .regex(timeRegex, 'End time must be in HH:mm format')
    .nullable(),
}).refine(
  (data) => {
    // Custom window: both times required. Block: both times must be null.
    if (data.available) {
      return data.start_time !== null && data.end_time !== null;
    }
    return data.start_time === null && data.end_time === null;
  },
  { message: 'Custom window needs both times; block needs neither' },
).refine(
  (data) => {
    if (data.available && data.start_time && data.end_time) {
      const toMinutes = (time: string) => {
        // Regex guarantee: format is HH:mm, so split produces exactly 2 elements.
        const [h, m] = time.split(':').map(Number) as [number, number];
        return h * 60 + m;
      };
      return toMinutes(data.start_time) < toMinutes(data.end_time);
    }
    return true;
  },
  { message: 'Start time must be before end time' },
);

/**
 * Input type for an override.
 */
export type OverrideInput = z.infer<typeof overrideSchema>;

/**
 * Validates timezone against Intl.supportedValuesOf('timeZone').
 * Server-side; the list is built into the JS runtime.
 */
export const timezoneSchema = z
  .string()
  .refine(
    (tz) => {
      try {
        return Intl.supportedValuesOf('timeZone').includes(tz);
      } catch {
        return false;
      }
    },
    'Timezone must be a valid IANA identifier',
  );

/**
 * Input type for timezone.
 */
export type TimezoneInput = z.infer<typeof timezoneSchema>;

