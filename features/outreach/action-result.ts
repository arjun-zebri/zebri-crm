/**
 * The tagged result every Outreach server action returns.
 *
 * Server actions can't throw meaningful errors to the client (Next
 * replaces the message in production), so failures come back as data:
 * `error` is safe to show in a toast.
 *
 * @module features/outreach/action-result
 */

/** Success with data, or a user-facing error message. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Unwrap a result for react-query: data, or throw the user-facing message. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
