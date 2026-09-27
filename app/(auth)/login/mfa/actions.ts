/**
 * Recovery-code redemption for the second-factor screen (Phase 4, Task 23).
 *
 * An MC who has lost their authenticator app signs in with their
 * password (an aal1 session) and types one of the recovery codes they
 * saved when they turned 2FA on. This action:
 *
 *   1. Validates the input with {@link recoveryCodeSchema}.
 *   2. Requires an aal1-or-better session and uses ITS user id. The code
 *      is only ever checked against the signed-in user's own codes, so a
 *      code cannot unlock a different account.
 *   3. Rate-limits per user ({@link AUTH_RATE_LIMITS}.redeemRecoveryCode).
 *   4. Spends the code (`spendRecoveryCode`: one winner per batch, even
 *      for two concurrent redemptions with different codes).
 *   5. Removes the TOTP factor through the admin API. If that fails the
 *      code is handed back, so the MC can retry with the same code.
 *   6. Deletes the other unused codes, sends `mfa_recovery_code_used` to
 *      Slack and emails the MC: whoever did this held the password, so the
 *      account owner must hear about it too.
 *   7. Signs the browser out and sends it to /login. Supabase ends every
 *      session of a user whose verified factor is deleted, so the next
 *      step is a fresh password sign-in, which now needs no code.
 *
 * @module app/(auth)/login/mfa/actions
 */
'use server';

import { redirect } from 'next/navigation';

import { logger } from '@/lib/alerts/logger';
import { sendAlert } from '@/lib/alerts/send-alert';
import { AUTH_RATE_LIMITS, inMemoryLimiter } from '@/lib/api/rate-limit';
import { parseFormData } from '@/lib/api/validate';
import {
  deleteUnusedRecoveryCodes,
  releaseRecoveryCode,
  removeTotpFactors,
  spendRecoveryCode,
} from '@/lib/auth/recovery-codes';
import { recoveryCodeSchema } from '@/lib/auth/schemas';
import { sendTwoFactorRemovedEmail } from '@/lib/email/account-security';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import type { AuthActionState } from '../../action-state';

const redeemLimiter = inMemoryLimiter(AUTH_RATE_LIMITS.redeemRecoveryCode);

// One message for "no such code", "already used" and "not yours": which
// of those it was is exactly what a guesser would like to learn.
const WRONG_CODE = 'That recovery code did not work. Check it and try again.';

/**
 * Redeem a recovery code for the signed-in user. On success the user is
 * signed out and redirected to `/login?recovered=1`; otherwise an inline
 * error comes back.
 */
export async function redeemRecoveryCodeAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = parseFormData(formData, recoveryCodeSchema);
  if (!parsed.ok) return { error: parsed.error, fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Your sign-in has expired. Sign in with your password again.' };

  const limit = await redeemLimiter.check(`redeemRecoveryCode:${user.id}`);
  if (!limit.allowed) {
    void sendAlert({
      type: 'auth_rate_limit_hit',
      severity: 'warn',
      action: 'redeemRecoveryCode',
      ip: 'session', // keyed per user, not per IP
      userId: user.id,
    });
    return { error: 'Too many attempts. Wait fifteen minutes and try again.' };
  }

  const admin = createAdminClient();
  let factorsRemoved: number;
  try {
    const spend = await spendRecoveryCode(admin, user.id, parsed.data.code);
    if (!spend.spent) return { fieldErrors: { code: WRONG_CODE }, error: WRONG_CODE };
    try {
      factorsRemoved = await removeTotpFactors(admin, user.id);
    } catch (err) {
      // Nothing changed for the MC yet: give the code back so a retry
      // with the same code works instead of every code being refused.
      await releaseRecoveryCode(admin, user.id, spend.codeId);
      throw err;
    }
    await deleteUnusedRecoveryCodes(admin, user.id);
  } catch (err) {
    logger.error('mfa.recovery_redeem_failed', err, { userId: user.id });
    return { error: 'Something went wrong on our side. Please try again.' };
  }

  await sendAlert({
    type: 'mfa_recovery_code_used',
    severity: 'warn',
    userId: user.id,
    factorsRemoved,
  });
  if (user.email) {
    // Best effort: 2FA is already off, and a mail outage must not strand
    // the MC on this screen. A failure is logged, not shown.
    try {
      const sent = await sendTwoFactorRemovedEmail({ to: user.email });
      if (!sent.ok) logger.error('mfa.recovery_notice_failed', sent.error, { userId: user.id });
    } catch (err) {
      logger.error('mfa.recovery_notice_failed', err, { userId: user.id });
    }
  }

  // The server already ended the session; this clears the cookies too.
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/login?recovered=1');
}
