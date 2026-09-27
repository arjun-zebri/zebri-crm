/**
 * The one write behind an email opt-out, and the one read that asks
 * whether an address has already opted out.
 *
 * Two routes record an unsubscribe: the confirm form on the public page
 * (`POST /api/unsubscribe`) and the RFC 8058 one-click POST a mailbox
 * provider sends to the `List-Unsubscribe` URL
 * (`POST /api/unsubscribe/[token]`). They must write exactly the same
 * thing, so both call {@link recordUnsubscribe} rather than each keeping
 * a copy that could drift.
 *
 * ADDRESS MATCHING. Every comparison here is "the same address, ignoring
 * case and surrounding whitespace", never a pattern. PostgREST's `ilike`
 * is the only case-insensitive filter it offers, and ILIKE treats `_` and
 * `%` as wildcards: matched as a pattern, `john_smith@x.com` also matches
 * `johnXsmith@x.com`, so one person's click flipped a stranger's opt-out
 * flag. So `ilike` is only used to narrow the candidate rows (with the
 * wildcards escaped), and the decision is made in TypeScript by
 * {@link sameAddress} on the rows that come back.
 *
 * @module lib/email/record-unsubscribe
 */
import { sendAlert } from '@/lib/alerts'
import { logger } from '@/lib/alerts/logger'
import { createAdminClient } from '@/lib/supabase/admin'

import type { UnsubscribeTokenPayload } from './unsubscribe-token'

/** Postgres unique-violation code: a repeat unsubscribe hitting the
 *  `(user_id, lower(email), reason)` index is success, not an error. */
const UNIQUE_VIOLATION = '23505'

/**
 * Whether two stored or typed addresses are the same mailbox, ignoring
 * case and surrounding whitespace. The same folding `is_email_suppressed`
 * applies in the database.
 */
export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Escape the ILIKE wildcards (`%`, `_`) and the escape character itself
 * (`\`), so a value can sit inside an ILIKE pattern as literal text.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * The ILIKE pattern that narrows candidates for {@link sameAddress}: the
 * trimmed address, escaped, with `%` either side so a stored value that
 * carries stray whitespace is still a candidate. It over-matches on
 * purpose; the exact decision is always made afterwards in TypeScript.
 */
function candidatePattern(email: string): string {
  return `%${escapeLikePattern(email.trim())}%`
}

/** What {@link recordUnsubscribe} reports to the route that called it. */
export type RecordUnsubscribeResult = { ok: true } | { ok: false }

/**
 * Record a verified opt-out.
 *
 * Writes the `email_suppression` row, which is the source of truth the
 * send path checks, then flips `couples.do_not_email` on every couple of
 * this owner whose stored address is this address (not only the couple
 * named in the token: suppression is a property of the address).
 *
 * A failed suppression write is the failure of a legal opt-out, so it is
 * alerted, not only logged, and comes back `{ ok: false }` so the route
 * can tell the person it did not work. The couple flag is a
 * denormalisation, so a failure there is logged and the opt-out still
 * counts as recorded.
 *
 * @param payload - The verified token payload.
 * @param via - Which route recorded it, for the log and the alert.
 */
export async function recordUnsubscribe(
  payload: UnsubscribeTokenPayload,
  via: 'form' | 'one_click',
): Promise<RecordUnsubscribeResult> {
  const admin = createAdminClient()

  const { error: suppressError } = await admin
    .from('email_suppression')
    .insert({ user_id: payload.uid, email: payload.email, reason: 'unsubscribed' })
  if (suppressError && suppressError.code !== UNIQUE_VIOLATION) {
    // Never the raw token: it is a bearer capability. The decoded payload
    // is not secret.
    logger.error('[unsubscribe] failed to record suppression', suppressError, {
      userId: payload.uid,
      coupleId: payload.cid,
      via,
    })
    await sendAlert({
      type: 'app_error',
      severity: 'error',
      source: 'unsubscribe',
      message: `An unsubscribe (${via}) for tenant ${payload.uid} could not be recorded: ${suppressError.message}`,
    })
    return { ok: false }
  }

  const { data: candidates, error: readError } = await admin
    .from('couples')
    .select('id, email')
    .eq('user_id', payload.uid)
    .ilike('email', candidatePattern(payload.email))
  const ids = (candidates ?? []).filter((c) => sameAddress(c.email, payload.email)).map((c) => c.id)

  if (readError) {
    logger.error('[unsubscribe] failed to read couples for do_not_email', readError, {
      userId: payload.uid,
      coupleId: payload.cid,
    })
  } else if (ids.length > 0) {
    const { error: coupleError } = await admin
      .from('couples')
      .update({ do_not_email: true, do_not_email_at: new Date().toISOString() })
      .eq('user_id', payload.uid)
      .in('id', ids)
    if (coupleError) {
      logger.error('[unsubscribe] failed to flip couples.do_not_email', coupleError, {
        userId: payload.uid,
        coupleId: payload.cid,
      })
    }
  }

  return { ok: true }
}

/**
 * Whether this token's address is already unsubscribed from this owner.
 *
 * @returns `true` or `false`, or `null` when the lookup failed (the page
 *   then shows the form again rather than claiming either state).
 */
export async function isAlreadyUnsubscribed(payload: UnsubscribeTokenPayload): Promise<boolean | null> {
  const { data, error } = await createAdminClient()
    .from('email_suppression')
    .select('email')
    .eq('user_id', payload.uid)
    .eq('reason', 'unsubscribed')
    .ilike('email', candidatePattern(payload.email))
  if (error) return null
  return (data ?? []).some((row) => sameAddress(row.email, payload.email))
}
