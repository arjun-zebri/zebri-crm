/**
 * Settings, Account: server side of two-factor sign-in (Phase 4, Task 23).
 *
 * Enrolment and the code check happen in the browser through Supabase's
 * MFA API, which is what raises a session to aal2. What the browser must
 * not do is anything touching `mfa_recovery_codes` (service role only),
 * so issuing, counting and clearing recovery codes lives here.
 *
 * Issuing codes and turning 2FA off both require an aal2 session: the
 * MC proved the second factor in this session. Otherwise a password-only
 * session (for example an admin in shadow mode, or a thief with the
 * password who somehow got past the gate) could mint codes it knows or
 * strip the factor.
 *
 * @module app/(dashboard)/settings/account/two-factor-actions
 */
'use server';

import { logger } from '@/lib/alerts/logger';
import { sendAlert } from '@/lib/alerts/send-alert';
import { AUTH_RATE_LIMITS, inMemoryLimiter } from '@/lib/api/rate-limit';
import { currentAssuranceLevel, hasVerifiedFactor } from '@/lib/auth/mfa';
import {
  countUnusedRecoveryCodes,
  deleteUnusedRecoveryCodes,
  issueRecoveryCodes,
} from '@/lib/auth/recovery-codes';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import type {
  IssueRecoveryCodesResult,
  RecoveryCodesLeftResult,
  TurnOffTwoFactorResult,
} from './two-factor-state';

const issueLimiter = inMemoryLimiter(AUTH_RATE_LIMITS.issueRecoveryCodes);

const SIGNED_OUT = { ok: false, error: 'Your session has expired. Sign in again.' } as const;
const NEEDS_AAL2 = {
  ok: false,
  error: 'Confirm a code from your authenticator app in this session first.',
} as const;

/** The signed-in user and whether this session has passed the second factor. */
async function sessionState() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { supabase, user, aal2: currentAssuranceLevel(session?.access_token) === 'aal2' };
}

/**
 * Replace the MC's recovery codes with ten new ones and return them for
 * a one-time display. Called straight after enrolment and from "New
 * recovery codes". Requires a verified factor and an aal2 session.
 */
export async function issueRecoveryCodesAction(): Promise<IssueRecoveryCodesResult> {
  const state = await sessionState();
  if (!state) return SIGNED_OUT;
  if (!hasVerifiedFactor(state.user)) {
    return { ok: false, error: 'Turn on two-factor sign-in first.' };
  }
  if (!state.aal2) return NEEDS_AAL2;

  const limit = await issueLimiter.check(`issueRecoveryCodes:${state.user.id}`);
  if (!limit.allowed) {
    void sendAlert({
      type: 'auth_rate_limit_hit',
      severity: 'warn',
      action: 'issueRecoveryCodes',
      ip: 'session',
      userId: state.user.id,
    });
    return { ok: false, error: 'Too many attempts. Please wait a moment and try again.' };
  }

  try {
    const codes = await issueRecoveryCodes(createAdminClient(), state.user.id);
    return { ok: true, codes };
  } catch (err) {
    logger.error('mfa.issue_recovery_codes_failed', err, { userId: state.user.id });
    return { ok: false, error: 'We could not create your recovery codes. Please try again.' };
  }
}

/** How many unused recovery codes the signed-in MC has left. */
export async function recoveryCodesLeftAction(): Promise<RecoveryCodesLeftResult> {
  const state = await sessionState();
  if (!state) return SIGNED_OUT;
  try {
    return { ok: true, remaining: await countUnusedRecoveryCodes(createAdminClient(), state.user.id) };
  } catch (err) {
    logger.error('mfa.count_recovery_codes_failed', err, { userId: state.user.id });
    return { ok: false, error: 'We could not check your recovery codes.' };
  }
}

/**
 * Switch two-factor sign-in off: unenrol every verified TOTP factor as
 * the user (Supabase itself refuses this below aal2) and delete the
 * unused recovery codes, which no longer guard anything.
 */
export async function turnOffTwoFactorAction(): Promise<TurnOffTwoFactorResult> {
  const state = await sessionState();
  if (!state) return SIGNED_OUT;
  if (!state.aal2) return NEEDS_AAL2;

  const { data, error } = await state.supabase.auth.mfa.listFactors();
  if (error) return { ok: false, error: 'We could not load your two-factor settings.' };
  for (const factor of data.totp) {
    const { error: unenrollError } = await state.supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (unenrollError) {
      logger.error('mfa.unenroll_failed', unenrollError, { userId: state.user.id });
      return { ok: false, error: 'We could not turn off two-factor sign-in. Please try again.' };
    }
  }
  try {
    await deleteUnusedRecoveryCodes(createAdminClient(), state.user.id);
  } catch (err) {
    // The factor is already gone, so 2FA is off either way; leftover
    // codes are harmless without a factor and are replaced on re-enrol.
    logger.error('mfa.delete_recovery_codes_failed', err, { userId: state.user.id });
  }
  return { ok: true };
}
