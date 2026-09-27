/**
 * The MC's payment details: bank account and ABN.
 *
 * They live in `user_metadata`, where every reader (public invoice and
 * proposal RPCs, the branding blocks, account readiness) already looks.
 * What is special is the WRITE path. A `BEFORE UPDATE` trigger on
 * `auth.users` refuses any change to these keys that does not come from
 * the `set_my_payment_details` RPC, and that RPC refuses a password-only
 * session of an MC with two-factor on (migration
 * `20261022000000_lock_payment_details.sql`, Task 23c). Without it a stolen
 * password alone could point couples' payments at someone else's account
 * through `auth.updateUser({ data })`.
 *
 * So:
 * - change these keys only with {@link savePaymentDetails};
 * - strip them from every `auth.updateUser({ data })` payload with
 *   {@link withoutPaymentDetails}. Resending them unchanged is allowed,
 *   but a stale copy (an old session's metadata) would now fail the whole
 *   save instead of quietly reverting the MC's bank details.
 *
 * @module lib/branding/payment-details
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { logger } from '@/lib/alerts/logger'
import type { Database } from '@/types/database'

/** Every `user_metadata` key the database lock protects. */
export const PAYMENT_DETAIL_KEYS = [
  'bank_account_name',
  'bank_bsb',
  'bank_account_number',
  'abn',
] as const

/** One protected `user_metadata` key. */
export type PaymentDetailKey = (typeof PAYMENT_DETAIL_KEYS)[number]

/**
 * A partial update: only the keys present change. `null` or `''` clears a
 * key. A form sends only the keys it owns, so the Settings bank form never
 * touches the ABN and the Branding editor never touches the bank account.
 */
export type PaymentDetailsPatch = Partial<Record<PaymentDetailKey, string | null>>

/** All four values after a save (`null` = not set). */
export type PaymentDetails = Record<PaymentDetailKey, string | null>

/** Result of {@link savePaymentDetails}. */
export type SavePaymentDetailsResult =
  | { ok: true; values: PaymentDetails }
  | { ok: false; message: string }

/**
 * Remove the protected keys from a metadata object before it goes to
 * `auth.updateUser({ data })`. GoTrue merges `data` into the stored
 * metadata key by key, so leaving a key out keeps its stored value.
 *
 * @param metadata - Usually `user.user_metadata`, spread into a save.
 * @returns A shallow copy without the protected keys.
 */
export function withoutPaymentDetails(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(metadata ?? {}) }
  for (const key of PAYMENT_DETAIL_KEYS) delete out[key]
  return out
}

/**
 * The shape check for one value, mirroring the SQL in
 * `set_my_payment_details` (the database is the authority; this only lets
 * a form explain the problem before a round trip). Spaces and hyphens are
 * separators, as in the forms' placeholders ("062-000", "00 000 000 000").
 * An empty value is always fine: it clears the field.
 *
 * @param key - Which detail.
 * @param value - What the MC typed.
 * @returns A sentence to show the MC, or `null` when the value is fine.
 */
export function paymentDetailError(key: PaymentDetailKey, value: string): string | null {
  const text = value.trim()
  if (text === '') return null
  const digits = text.replace(/[\s-]/g, '')
  switch (key) {
    case 'bank_account_name':
      return text.length > 200 ? 'Account name must be 200 characters or fewer' : null
    case 'bank_bsb':
      return /^\d{6}$/.test(digits) ? null : 'BSB must be 6 digits'
    case 'bank_account_number':
      return /^\d{4,10}$/.test(digits) ? null : 'Account number must be 4 to 10 digits'
    case 'abn':
      return /^\d{11}$/.test(digits) ? null : 'ABN must be 11 digits'
  }
}

/**
 * Save payment details through the guarded RPC.
 *
 * After a save the browser's cached session still carries the old
 * metadata (GoTrue did not make the change, so supabase-js was not told).
 * A token refresh reloads the user, so later reads of `session.user` see
 * the new values. A refresh failure is ignored: the save itself landed.
 *
 * @param supabase - The signed-in user's client (RLS and the 2FA guard apply).
 * @param patch - Only the keys to change.
 * @returns The four stored values, or a message fit to show the MC.
 */
export async function savePaymentDetails(
  supabase: SupabaseClient<Database>,
  patch: PaymentDetailsPatch,
): Promise<SavePaymentDetailsResult> {
  for (const key of PAYMENT_DETAIL_KEYS) {
    const value = patch[key]
    const problem = typeof value === 'string' ? paymentDetailError(key, value) : null
    if (problem) return { ok: false, message: problem }
  }

  const { data, error } = await supabase.rpc('set_my_payment_details', { p_details: patch })
  if (error) {
    // 22023 carries the SQL's own sentence (the same ones as above).
    if (error.code === '22023') return { ok: false, message: error.message }
    if (error.code === '42501') {
      return { ok: false, message: 'Confirm your two-factor code, then try again.' }
    }
    // Unexpected (a network failure, a missing grant after a deploy, a
    // trigger bug): the MC only sees a toast, so leave a trace. Only the
    // error code and WHICH keys, never the values or the error text,
    // which could echo them.
    logger.error('payment details save failed', undefined, {
      code: error.code ?? null,
      keys: Object.keys(patch),
    })
    return { ok: false, message: 'Could not save your payment details.' }
  }

  await supabase.auth.refreshSession().catch(() => undefined)
  // The RPC always returns an object with exactly these four keys.
  return { ok: true, values: data as unknown as PaymentDetails }
}
