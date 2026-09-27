/**
 * One-time recovery codes for two-factor sign-in.
 *
 * Supabase Auth has no recovery codes, so an MC who loses the phone with
 * their authenticator app would be locked out for good. When they turn
 * 2FA on we issue {@link RECOVERY_CODE_COUNT} codes, show them once, and
 * keep only a salted scrypt hash of each in `mfa_recovery_codes`, a table
 * no client role can read or write (Phase 4, Task 23).
 *
 * Every function that touches the table takes a service-role client:
 * the table has no RLS policies, so a user client would see nothing.
 *
 * Server only. Uses `node:crypto`.
 *
 * @module lib/auth/recovery-codes
 */
import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { RECOVERY_CODE_COUNT } from '@/lib/auth/mfa';
import type { Database } from '@/types/database';

// No 0/o, 1/l/i: a code copied onto paper has to survive being read back.
// 31 symbols over 10 characters is about 49.5 bits per code, far beyond
// reach behind a rate limit of a handful of guesses per quarter hour.
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const CODE_LENGTH = 10;
const SCRYPT_KEYLEN = 32;

type AdminClient = SupabaseClient<Database>;

/** One stored code, as read back for matching. */
export interface StoredRecoveryCode {
  id: string;
  salt: string;
  code_hash: string;
}

/** Draw one code, formatted `xxxxx-xxxxx` for reading. */
function drawCode(): string {
  let raw = '';
  // randomInt is uniform over the range, so no modulo bias.
  for (let i = 0; i < CODE_LENGTH; i += 1) raw += ALPHABET[randomInt(ALPHABET.length)];
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Draw `count` distinct codes. */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(drawCode());
  return [...codes];
}

/**
 * Canonical form used for hashing: lower case with spaces and hyphens
 * removed, so `ABCDE-FGHJK`, `abcde fghjk` and `abcdefghjk` all match.
 */
export function normaliseRecoveryCode(input: string): string {
  return input.toLowerCase().replace(/[\s-]/g, '');
}

function scryptHex(code: string, saltHex: string): Promise<string> {
  return new Promise((resolve, reject) => {
    scrypt(normaliseRecoveryCode(code), Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString('hex'));
    });
  });
}

/** Hash a code with a fresh 16-byte salt. */
export async function hashRecoveryCode(code: string): Promise<{ salt: string; codeHash: string }> {
  const salt = randomBytes(16).toString('hex');
  return { salt, codeHash: await scryptHex(code, salt) };
}

/**
 * Find the stored code that `input` matches, or null.
 *
 * Hashes against every row rather than stopping at the first hit, so
 * how long a guess takes does not say how far down the list it matched.
 */
export async function matchRecoveryCode(
  input: string,
  rows: ReadonlyArray<StoredRecoveryCode>,
): Promise<string | null> {
  const normalised = normaliseRecoveryCode(input);
  if (normalised.length !== CODE_LENGTH) return null;
  let found: string | null = null;
  for (const row of rows) {
    const candidate = Buffer.from(await scryptHex(normalised, row.salt), 'hex');
    const stored = Buffer.from(row.code_hash, 'hex');
    if (candidate.length === stored.length && timingSafeEqual(candidate, stored) && !found) {
      found = row.id;
    }
  }
  return found;
}

/**
 * Replace every code the user has with a fresh set, returning the plain
 * codes for the one-time display. Old codes, used or not, stop working.
 *
 * The swap is one transaction (`replace_mfa_recovery_codes`) under a
 * per-user lock, so a failure leaves the old codes in place rather than
 * none, and two concurrent calls cannot leave twenty valid codes.
 */
export async function issueRecoveryCodes(admin: AdminClient, userId: string): Promise<string[]> {
  const codes = generateRecoveryCodes();
  const rows = await Promise.all(
    codes.map(async (code) => {
      const { salt, codeHash } = await hashRecoveryCode(code);
      return { salt, code_hash: codeHash };
    }),
  );
  const { data, error } = await admin.rpc('replace_mfa_recovery_codes', {
    p_user_id: userId,
    p_codes: rows,
  });
  if (error) throw new Error(`Could not store recovery codes: ${error.message}`);
  if (data !== codes.length) throw new Error(`Stored ${String(data)} recovery codes, expected ${codes.length}`);
  return codes;
}

/** How many unused codes the user has left. */
export async function countUnusedRecoveryCodes(admin: AdminClient, userId: string): Promise<number> {
  const { count, error } = await admin
    .from('mfa_recovery_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('used_at', null);
  if (error) throw new Error(`Could not count recovery codes: ${error.message}`);
  return count ?? 0;
}

/** The outcome of {@link spendRecoveryCode}. */
export type SpendResult = { spent: true; codeId: string } | { spent: false };

/**
 * Spend one code. Succeeds only when `input` matches an unused code of
 * this user AND no code of their current batch has been used yet.
 *
 * The claim is `spend_mfa_recovery_code`, under a per-user lock: of two
 * concurrent redemptions, even with two different codes, exactly one
 * wins. The caller must either finish (remove the factor, then
 * {@link deleteUnusedRecoveryCodes}) or hand the code back with
 * {@link releaseRecoveryCode}, or the batch stays locked.
 */
export async function spendRecoveryCode(
  admin: AdminClient,
  userId: string,
  input: string,
): Promise<SpendResult> {
  const { data, error } = await admin
    .from('mfa_recovery_codes')
    .select('id, salt, code_hash')
    .eq('user_id', userId)
    .is('used_at', null);
  if (error) throw new Error(`Could not read recovery codes: ${error.message}`);
  const id = await matchRecoveryCode(input, data ?? []);
  if (!id) return { spent: false };
  const { data: won, error: claimError } = await admin.rpc('spend_mfa_recovery_code', {
    p_user_id: userId,
    p_code_id: id,
  });
  if (claimError) throw new Error(`Could not mark recovery code used: ${claimError.message}`);
  return won === true ? { spent: true, codeId: id } : { spent: false };
}

/**
 * Hand a spent code back (clear its `used_at`) when the redemption could
 * not finish, so the MC can try again with the same code instead of being
 * locked out with every code of the batch refused.
 */
export async function releaseRecoveryCode(
  admin: AdminClient,
  userId: string,
  codeId: string,
): Promise<void> {
  const { error } = await admin
    .from('mfa_recovery_codes')
    .update({ used_at: null })
    .eq('id', codeId)
    .eq('user_id', userId);
  if (error) throw new Error(`Could not release recovery code: ${error.message}`);
}

/** Delete the user's unused codes (after 2FA is switched off, they guard nothing). */
export async function deleteUnusedRecoveryCodes(admin: AdminClient, userId: string): Promise<void> {
  const { error } = await admin
    .from('mfa_recovery_codes')
    .delete()
    .eq('user_id', userId)
    .is('used_at', null);
  if (error) throw new Error(`Could not delete recovery codes: ${error.message}`);
}

/**
 * Remove every TOTP factor on the user through the admin API. Supabase
 * signs the user out of all sessions when a verified factor is deleted.
 * Returns how many factors were removed.
 */
export async function removeTotpFactors(admin: AdminClient, userId: string): Promise<number> {
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) throw new Error(`Could not list factors: ${error.message}`);
  const totp = data.factors.filter((f) => f.factor_type === 'totp');
  for (const factor of totp) {
    const { error: delError } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
    if (delError) throw new Error(`Could not remove factor: ${delError.message}`);
  }
  return totp.length;
}
