/**
 * Email suppression check: prevent sends to suppressed addresses
 * and couples opted out.
 *
 * The Australian Spam Act lets a recipient unsubscribe, and that
 * preference is the core customer promise: "click Unsubscribe and
 * you stop getting emails." This module enforces that at send time
 * for automated sends.
 *
 * **Three outcomes, not two.** Every check here can come back
 * `blocked`, `clear`, or `unknown`, and the third is why this module
 * returns a tagged result rather than a boolean. A boolean forces a
 * database error to be reported as one of the other two, and both
 * choices are wrong: `false` sends to someone who unsubscribed, and
 * `true` records a permanent, never-retried skip for a couple nobody
 * opted out. `unknown` is neither, and every caller must turn it into a
 * retryable failure so the executor defers the step onto its backoff.
 *
 * Why a tagged union rather than a thrown error: a throw would land in
 * `executeStep`'s catch-all, which produces an error result with
 * `recoverable` undefined. That happens to retry today, but only by
 * accident, and it is lost the moment a caller wraps the send in a
 * try/catch of its own. The union makes the compiler ask both call
 * sites what they intend to do about it.
 *
 * @module lib/email/suppression
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

/**
 * The answer to "may this tenant email this recipient right now".
 *
 * - `blocked`: a definite no. The recipient unsubscribed, bounced,
 *   complained, or the couple is flagged do_not_email. A retry can
 *   never change this, so the caller records a deliberate skip.
 * - `clear`: a definite yes, as far as opt-out is concerned.
 * - `unknown`: the check could not be completed (a database error). The
 *   caller must NOT send and must NOT record a permanent skip: it
 *   reports a retryable failure so the send is attempted again later.
 */
export type SendGateResult =
  | { status: 'blocked' }
  | { status: 'clear' }
  | { status: 'unknown'; reason: string }

/** Turn an unknown thrown value into the `unknown` arm's reason string. */
function unknownFrom(err: unknown): SendGateResult {
  return { status: 'unknown', reason: err instanceof Error ? err.message : String(err) }
}

/**
 * Whether an address is suppressed for a given tenant.
 *
 * Case-insensitive, and it has to be done in the database. The
 * `email_suppression.email` column stores the address exactly as the
 * provider or the unsubscribe click reported it, so either side of the
 * comparison can carry mixed case and lower-casing the search term in
 * TypeScript fixes nothing. PostgREST cannot express
 * `lower(email) = lower($1)` as a filter, so this calls the
 * `is_email_suppressed` function (migration
 * `20261006000000_is_email_suppressed_function.sql`), whose predicate
 * matches the `(user_id, lower(email), reason)` unique index and stays
 * an index lookup.
 *
 * Matches on ANY reason: if the address is in the table at all
 * (unsubscribed, bounced, complained), it is suppressed.
 *
 * Never throws. A failed lookup comes back as `unknown`.
 *
 * @param supabase The Supabase client. The send path passes the admin
 *   client; the function is security invoker, so an authenticated
 *   caller stays scoped to their own rows by RLS.
 * @param userId The tenant (workflow owner).
 * @param email The recipient address, compared case-insensitively.
 */
export async function isEmailSuppressed(
  supabase: SupabaseClient<Database>,
  userId: string,
  email: string,
): Promise<SendGateResult> {
  try {
    const { data, error } = await supabase.rpc('is_email_suppressed', {
      p_user_id: userId,
      p_email: email,
    })

    if (error) {
      return { status: 'unknown', reason: error.message }
    }
    // A null return would mean the function answered nothing, which its
    // `exists(...)` body cannot do. Treating it as `unknown` rather than
    // coercing it to false keeps the fail-open out of the one place it
    // would be silent.
    if (data === null || data === undefined) {
      return { status: 'unknown', reason: 'is_email_suppressed returned no value' }
    }

    return data ? { status: 'blocked' } : { status: 'clear' }
  } catch (err) {
    return unknownFrom(err)
  }
}

/**
 * Whether a couple is opted out of all email.
 *
 * The `do_not_email` flag on the couple row is a boolean denormalisation
 * of the suppression table for the couple's primary email. When set,
 * no automated send should go to that couple regardless of suppression
 * state.
 *
 * Never throws. A failed lookup comes back as `unknown`.
 *
 * @param supabase The Supabase client.
 * @param userId The tenant.
 * @param coupleId The couple to check.
 */
export async function isCoupleOptedOut(
  supabase: SupabaseClient<Database>,
  userId: string,
  coupleId: string,
): Promise<SendGateResult> {
  try {
    const { data, error } = await supabase
      .from('couples')
      .select('do_not_email')
      .eq('id', coupleId)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (error) {
      return { status: 'unknown', reason: error.message }
    }
    // No row is a definite answer, not a failed lookup: the send path
    // runs as the service role, so RLS is not hiding anything, and a
    // couple that does not exist for this owner has no opt-out flag to
    // honour. Reporting `unknown` here would defer the step three times
    // and bury it over a row that is never coming back.
    if (!data) return { status: 'clear' }

    return data.do_not_email ? { status: 'blocked' } : { status: 'clear' }
  } catch (err) {
    return unknownFrom(err)
  }
}
