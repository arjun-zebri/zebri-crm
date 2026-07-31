/**
 * Validation + bot-heuristics for the public lead-capture ingest.
 *
 * Shared by the submit API route (server) and the public form component
 * (client) so the field contract stays in one place. No transport or DB
 * imports here - pure Zod + helpers.
 *
 * @module lib/lead-capture/schema
 */
import { z } from 'zod';

/** Minimum time a genuine human takes to fill the form, in ms. */
const MIN_FILL_MS = 2_000;

/** Trimmed optional text, with empty strings coerced to `undefined`. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** ISO calendar date (YYYY-MM-DD) from a date input. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/** Public submission payload. `hp` is the honeypot; `rendered_at` gates timing. */
export const leadSubmitSchema = z.object({
  token: z.uuid(),
  name: z.string().trim().min(1).max(120),
  partner_name: optionalText(120),
  email: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.email().max(200),
  ),
  phone: optionalText(40),
  wedding_date: z
    .union([isoDate, z.literal('')])
    .optional()
    .transform((v) => (v ? v : undefined)),
  venue: optionalText(200),
  referral_source: optionalText(200),
  message: optionalText(2000),
  hp: z.string().max(200).optional(),
  rendered_at: z.number().int().nonnegative(),
});

export type LeadSubmitInput = z.infer<typeof leadSubmitSchema>;

/**
 * True when a submission looks automated: a non-empty honeypot (bots fill
 * hidden fields) or an implausibly fast fill. Callers treat a bot as a silent
 * success so scrapers get no signal.
 */
export function isLikelyBot(
  input: { hp?: string; rendered_at: number },
  nowMs: number,
): boolean {
  if (input.hp && input.hp.trim().length > 0) return true;
  return nowMs - input.rendered_at < MIN_FILL_MS;
}
