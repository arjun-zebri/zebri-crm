/**
 * Idempotency keys for automated sends.
 *
 * The executor retries a failed step, which is only safe because the
 * send behind it can be named stably enough for the provider to
 * recognise a repeat. Every automated send path builds its key the same
 * way through this module, so a new one cannot quietly ship without the
 * protection: `<step id>:<recipient>:<fingerprint of what is being
 * sent>`.
 *
 * Whether the key does anything is the transport's business. Resend
 * collapses a repeat for 24 hours; the OAuth mailbox transports have no
 * equivalent and ignore it, which is what
 * {@link transportDeduplicates} in `./dispatch` is for.
 *
 * @module lib/email/idempotency
 */
import { createHash } from 'node:crypto';

/**
 * A short hex fingerprint of everything about a send that changes what
 * the recipient actually gets.
 *
 * Callers pass the send's configured subject, body and headers, not the
 * rendered output: variables like `event.days_until` resolve against
 * `new Date()` at render time, so the same unedited step fingerprints
 * differently a day apart, a retry would mint a new key every time, and
 * the deduplication would never trigger. The configured values only
 * change when the MC edits the step, which is exactly when the provider
 * should treat the send as a new message rather than a repeat.
 *
 * `sha256` is Node's built in hash, and only a short prefix of the
 * digest is kept: this is a cache key, not a security control, so speed
 * and a readable log line matter more than the full digest.
 *
 * @param parts - any JSON-serialisable description of the send. Key
 *   order is part of the hash, so a caller must build it the same way
 *   every time rather than spreading a variable-shaped object into it.
 */
export function contentFingerprint(parts: unknown): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 12);
}

/**
 * The key one step's send to one recipient carries.
 *
 * Per recipient, not per step: a step that mails both partners sends two
 * different messages, and one key for both would suppress the second.
 *
 * @param stepId - the workflow step, which is what the retry repeats
 * @param recipient - the address this message is going to
 * @param fingerprint - from {@link contentFingerprint}
 */
export function sendIdempotencyKey(
  stepId: string,
  recipient: string,
  fingerprint: string,
): string {
  return `${stepId}:${recipient.toLowerCase()}:${fingerprint}`;
}
