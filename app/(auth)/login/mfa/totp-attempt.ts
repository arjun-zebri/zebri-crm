/**
 * Rate limit for 6-digit authenticator code checks (Task 23 review).
 *
 * The code is verified in the browser, straight against Supabase Auth,
 * because that call is what raises the session to aal2 and it must carry
 * the MC's own IP (Supabase's limits are per IP; verifying from the server
 * would pool every MC behind Vercel's few egress addresses). So the app's
 * own limit runs just before: the code screen and the enrolment modal
 * call {@link beginTotpAttemptAction} and only verify when it allows.
 *
 * Two keys, both must pass: the user (a guesser spread across many IPs)
 * and the IP (one IP hammering many accounts).
 *
 * Scope: someone holding the password can still call Supabase's verify
 * endpoint directly and meet only Supabase's per-IP limit. Task 23b's
 * database enforcement does not change that: the endpoint is GoTrue's,
 * not a table or RPC (see authentication.md, "Database-level enforcement").
 *
 * @module app/(auth)/login/mfa/totp-attempt
 */
'use server';

import { headers } from 'next/headers';

import { sendAlert } from '@/lib/alerts/send-alert';
import { AUTH_RATE_LIMITS, inMemoryLimiter, ipOfHeaders } from '@/lib/api/rate-limit';
import { createClient } from '@/lib/supabase/server';

const perUser = inMemoryLimiter(AUTH_RATE_LIMITS.verifyTotpUser);
const perIp = inMemoryLimiter(AUTH_RATE_LIMITS.verifyTotpIp);

/**
 * Record one code attempt for the signed-in user. Returns `{ ok: true }`
 * when the browser may go on to verify, or an error to show instead.
 */
export async function beginTotpAttemptAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your sign-in has expired. Sign in with your password again.' };

  const ip = ipOfHeaders(await headers());
  // Both counters advance on every attempt, so neither key can be used to
  // probe the other's remaining budget.
  const [userCheck, ipCheck] = await Promise.all([
    perUser.check(`verifyTotp:user:${user.id}`),
    perIp.check(`verifyTotp:ip:${ip}`),
  ]);
  if (userCheck.allowed && ipCheck.allowed) return { ok: true };

  void sendAlert({
    type: 'auth_rate_limit_hit',
    severity: 'warn',
    // Which key tripped: the user (distributed guessing on one account)
    // or the IP (one source trying many).
    action: userCheck.allowed ? 'verifyTotpIp' : 'verifyTotpUser',
    ip,
    userId: user.id,
  });
  return { ok: false, error: 'Too many attempts. Wait fifteen minutes and try again.' };
}
