/**
 * One-line text at the Zod boundary: names and email addresses.
 *
 * A couple's or contact's name and address end up in email headers
 * (`To:`, the subject through a variable) on the Gmail and Microsoft
 * transports, where a line break starts a new header (audit M5). The
 * dispatch layer strips control characters from every header value as
 * the last line of defence; this is the first, so a value with a pasted
 * line break is refused where it enters rather than stored and quietly
 * flattened on every send.
 *
 * Pure Zod, no server imports: the public lead form shares its schema
 * with the client.
 *
 * @module lib/utils/single-line
 */
import { z } from 'zod';

/** What the MC or the visitor is told when a value spans lines. */
export const SINGLE_LINE_MESSAGE = 'Names and email addresses must be on one line.';

/** True when `value` holds a carriage return or a line feed. */
export function hasLineBreak(value: string): boolean {
  return /[\r\n]/.test(value);
}

/**
 * A trimmed string of at most `max` characters with no line break in it.
 *
 * Trimmed first, so a stray trailing newline from a paste is forgiven
 * rather than refused; only a break inside the value is an error.
 */
export function singleLineText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .refine((value) => !hasLineBreak(value), SINGLE_LINE_MESSAGE);
}

/**
 * {@link SINGLE_LINE_MESSAGE} when any issue in `error` is a line break,
 * else null. Lets an action keep its generic "Invalid data." for
 * everything else while telling the user plainly what is wrong with this
 * one.
 */
export function singleLineIssue(error: z.ZodError): string | null {
  return error.issues.some((issue) => issue.message === SINGLE_LINE_MESSAGE) ? SINGLE_LINE_MESSAGE : null;
}
