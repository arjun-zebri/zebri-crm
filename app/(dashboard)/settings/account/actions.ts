/**
 * Logged-in change-password server action.
 *
 * Distinct from the post-magic-link `/update-password` flow because
 * it requires re-authentication with the current password before
 * setting the new one, protecting against session hijack /
 * shoulder-surfing scenarios where an attacker briefly has access to
 * an authenticated browser.
 *
 * Pipeline mirrors the auth actions:
 *   1. Parse FormData via {@link changePasswordSchema}.
 *   2. Re-authenticate with the current password
 *      (`signInWithPassword`).
 *   3. Rate-limit per session (per user-id, not per IP): protects
 *      against scripted password-guessing inside a hijacked session.
 *   4. Update the password (`auth.updateUser({ password })`).
 *
 * @module app/(dashboard)/settings/account/actions
 */
'use server';

import { sendAlert } from '@/lib/alerts/send-alert';
import {
  AUTH_RATE_LIMITS,
  inMemoryLimiter,
} from '@/lib/api/rate-limit';
import { parseFormData } from '@/lib/api/validate';
import { changePasswordSchema } from '@/lib/auth/schemas';
import { createClient } from '@/lib/supabase/server';

import type { ChangePasswordResult } from './action-state';

const changePasswordLimiter = inMemoryLimiter(AUTH_RATE_LIMITS.changePassword);

/**
 * Update the signed-in user's password. Requires the current
 * password as a re-auth challenge before applying the change.
 *
 * Returns `{ ok: true, message }` for the form to render a toast on
 * success. Errors come back as inline {@link ChangePasswordResult}.
 */
export async function changePasswordAction(
  _prev: ChangePasswordResult,
  formData: FormData,
): Promise<ChangePasswordResult> {
  const parsed = parseFormData(formData, changePasswordSchema);
  if (!parsed.ok) return { error: parsed.error, fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expired. Please log in again.' };
  if (!user.email) return { error: 'Account has no email; cannot re-authenticate.' };

  const limit = await changePasswordLimiter.check(`changePassword:${user.id}`);
  if (!limit.allowed) {
    void sendAlert({
      type: 'auth_rate_limit_hit',
      severity: 'warn',
      action: 'changePassword',
      ip: 'session', // per-session limiter, IP not the key
      userId: user.id,
    });
    return { error: 'Too many attempts. Please wait a moment and try again.' };
  }

  // Re-authenticate. signInWithPassword refreshes the session, fine.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (reauthError) {
    return { fieldErrors: { currentPassword: 'Current password is incorrect.' }, error: 'Current password is incorrect.' };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  return { ok: true, message: 'Password changed.' };
}
