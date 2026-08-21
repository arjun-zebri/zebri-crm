/**
 * Validation for the public booking form submission.
 *
 * Booking submit shares the honeypot + timing pattern with lead capture.
 * The booker's timezone is validated against the full list of IANA timezones.
 *
 * @module app/api/booking/submit-schema
 */
import { z } from 'zod';

/** Minimum time a genuine human takes to fill the form, in ms. */
const MIN_FILL_MS = 2_000;

/** Get the set of supported IANA timezone identifiers. */
function getSupportedTimezones(): readonly string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    // Fallback for older JS runtimes
    return ['Australia/Sydney', 'Australia/Melbourne', 'America/New_York', 'Europe/London'] as const;
  }
}

/** Trimmed optional text, with empty strings coerced to `undefined`. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** ISO 8601 datetime (e.g. 2026-09-15T10:00:00Z). */
// Accept optional fractional seconds: Date.prototype.toISOString() always
// emits them, so a client that round-trips a slot through Date would other-
// wise be rejected. The slot engine emits second precision; both are valid.
const isoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z?$/, 'Must be ISO 8601 datetime');

/**
 * Public booking submission payload.
 * `website` is the honeypot (should stay empty); `startedAt` gates timing.
 */
export const bookingSubmitSchema = z.object({
  token: z.uuid(),
  startsAt: isoDateTime,
  timezone: z
    .string()
    .refine(
      (tz: string) => getSupportedTimezones().includes(tz),
      `Not a valid IANA timezone`,
    ),
  name: z.string().trim().min(1).max(120),
  partnerName: optionalText(120),
  email: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.email().max(200),
  ),
  phone: optionalText(40),
  notes: optionalText(2000),
  // Honeypot: bots fill hidden form fields; must be empty
  website: z
    .string()
    .max(200)
    .refine((v) => !v || v.trim().length === 0, 'Honeypot field should be empty'),
  // Timing gate: measures form fill time to detect bots
  startedAt: z.number().int().nonnegative(),
});

export type BookingSubmitInput = z.infer<typeof bookingSubmitSchema>;

/**
 * True when a submission looks automated: a non-empty honeypot (bots fill
 * hidden fields) or an implausibly fast fill. Callers treat a bot as a silent
 * success so scrapers get no signal.
 */
export function isLikelyBot(
  input: { website?: string | undefined; startedAt: number },
  nowMs: number,
): boolean {
  if (input.website && input.website.trim().length > 0) return true;
  return nowMs - input.startedAt < MIN_FILL_MS;
}
