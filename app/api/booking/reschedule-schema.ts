/**
 * Validation for the public booking reschedule request.
 *
 * The booker's timezone is validated against the full list of IANA timezones.
 *
 * @module app/api/booking/reschedule-schema
 */
import { z } from 'zod';

/** ISO 8601 datetime (e.g. 2026-09-15T10:00:00Z). */
// Accept optional fractional seconds: Date.prototype.toISOString() always
// emits them, so a client that round-trips a slot through Date would other-
// wise be rejected. The slot engine emits second precision; both are valid.
const isoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z?$/, 'Must be ISO 8601 datetime');

/** Get the set of supported IANA timezone identifiers. */
function getSupportedTimezones(): readonly string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    // Fallback for older JS runtimes
    return ['Australia/Sydney', 'Australia/Melbourne', 'America/New_York', 'Europe/London'] as const;
  }
}

/**
 * Reschedule booking request payload.
 * manageToken is the booking's manage capability UUID.
 * startsAt is the new start time in ISO 8601 format.
 * timezone is the booker's timezone (validated against IANA list).
 */
export const bookingRescheduleSchema = z.object({
  manageToken: z.uuid(),
  startsAt: isoDateTime,
  timezone: z
    .string()
    .refine(
      (tz: string) => getSupportedTimezones().includes(tz),
      'Not a valid IANA timezone',
    ),
});

export type BookingRescheduleInput = z.infer<typeof bookingRescheduleSchema>;
