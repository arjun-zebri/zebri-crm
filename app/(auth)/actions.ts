/**
 * Auth server actions (Phase 1).
 *
 * Single module owning every server-side branch of the four
 * authentication flows: login, signup, request-password-reset, and
 * complete-password-update via the magic link. Each action follows
 * the same pipeline:
 *
 *   1. Parse the FormData via Zod ({@link parseFormData}).
 *   2. Apply the per-action rate limit ({@link AUTH_RATE_LIMITS},
 *      via a process-local {@link inMemoryLimiter}). Hits fire a
 *      `sendAlert({ type: 'auth_rate_limit_hit', … })`.
 *   3. Call Supabase server-side via {@link createClient}.
 *   4. On error, return `{ error, fieldErrors }` for inline rendering.
 *   5. On success, fire any business alert (`signup_completed` etc.)
 *      and `redirect(...)` to the next page.
 *
 * The signup path writes entitlement fields (`subscription_status`,
 * `trial_end`, `is_subscribed`, `account_type`) directly to
 * `app_metadata` via `updateEntitlements` — no longer relying on the
 * `sync_signup_app_metadata_on_insert` trigger, though the trigger
 * stays as defence in depth for any future OAuth / magic-link
 * signup paths that don't pass through this action.
 *
 * `next` parameter for `loginAction` is restricted by
 * {@link loginSchema} to same-origin relative paths (`/^\/[^/]/`),
 * blocking open redirects like `?next=//evil.com`.
 *
 * @module app/(auth)/actions
 */
'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { sendAlert } from '@/lib/alerts/send-alert';
import {
  AUTH_RATE_LIMITS,
  inMemoryLimiter,
  ipOfHeaders,
  type AuthRateLimitKey,
} from '@/lib/api/rate-limit';
import { parseFormData } from '@/lib/api/validate';
import { updateEntitlements } from '@/lib/auth/entitlements';
import {
  loginSchema,
  resetPasswordRequestSchema,
  signupSchema,
  updatePasswordSchema,
} from '@/lib/auth/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** Inline form state passed back to the client component. */
export interface AuthActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** Default "no error yet" form state. */
export const emptyAuthState: AuthActionState = {};

// One limiter per action, process-local. Keys are scoped per-action
// so e.g. a login burst doesn't consume the signup budget.
const limiters = {
  login: inMemoryLimiter(AUTH_RATE_LIMITS.login),
  signup: inMemoryLimiter(AUTH_RATE_LIMITS.signup),
  resetPassword: inMemoryLimiter(AUTH_RATE_LIMITS.resetPassword),
  updatePassword: inMemoryLimiter(AUTH_RATE_LIMITS.updatePassword),
} as const;

/**
 * Apply the rate limit for `action` to the given IP/user. Returns a
 * failure state when blocked; `null` when allowed. Hits emit a
 * Slack alert via {@link sendAlert}.
 */
async function applyAuthRateLimit(
  action: AuthRateLimitKey,
  ip: string,
  userId?: string,
): Promise<AuthActionState | null> {
  const limiter = limiters[action as keyof typeof limiters];
  if (!limiter) return null;
  const result = await limiter.check(`${action}:${ip}`);
  if (result.allowed) return null;
  // Fire and forget — alert errors must not break auth.
  void sendAlert({
    type: 'auth_rate_limit_hit',
    severity: 'warn',
    action,
    ip,
    ...(userId ? { userId } : {}),
  });
  return { error: 'Too many attempts. Please wait a moment and try again.' };
}

/**
 * Authenticate a user via email + password. Redirects to `next`
 * (validated to be a same-origin relative path) on success.
 */
export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = parseFormData(formData, loginSchema);
  if (!parsed.ok) return { error: parsed.error, fieldErrors: parsed.fieldErrors };

  const ip = ipOfHeaders(await headers());
  const blocked = await applyAuthRateLimit('login', ip);
  if (blocked) return blocked;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Supabase returns the same "Invalid login credentials" for wrong
    // password and unknown email — preserving that to avoid leaking
    // which accounts exist.
    return { error: error.message };
  }

  if (!data.user) return { error: 'Login failed. Please try again.' };

  redirect(parsed.data.next ?? '/');
}

/**
 * Create a new vendor account. New signups land on the **Starter
 * (free)** tier — no 14-day trial. The 5-couple cap acts as the
 * organic free-tier limit; users upgrade to Pro/Max via the
 * Settings → Plans & Billing tab when they need more.
 *
 * Writes `account_type: 'vendor'` to `app_metadata` via
 * {@link updateEntitlements} (server-side admin client). The
 * `sync_signup_app_metadata_on_insert` trigger stays as defence
 * in depth for future OAuth signups but no longer needs to copy
 * trial fields. Fires a `signup_completed` alert. Redirects to `/`.
 */
export async function signupAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = parseFormData(formData, signupSchema);
  if (!parsed.ok) return { error: parsed.error, fieldErrors: parsed.fieldErrors };

  const ip = ipOfHeaders(await headers());
  const blocked = await applyAuthRateLimit('signup', ip);
  if (blocked) return blocked;

  const supabase = await createClient();
  // Only display + business name go into user_metadata (user-owned).
  // account_type goes through updateEntitlements below.
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
        business_name: parsed.data.businessName,
      },
    },
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: 'Signup failed. Please try again.' };

  const admin = createAdminClient();
  await updateEntitlements(admin.auth.admin, data.user.id, {
    account_type: 'vendor',
  });

  void sendAlert({
    type: 'signup_completed',
    severity: 'info',
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    businessName: parsed.data.businessName,
  });

  redirect('/');
}

/**
 * Request a password-reset email. The Supabase magic link includes
 * a one-time recovery token; the user lands on `/update-password`
 * with an established session and {@link updatePasswordAction}
 * completes the change.
 *
 * Always returns success even on unknown email so we don't leak
 * which accounts exist; the rate limit prevents enumeration.
 */
export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = parseFormData(formData, resetPasswordRequestSchema);
  if (!parsed.ok) return { error: parsed.error, fieldErrors: parsed.fieldErrors };

  const ip = ipOfHeaders(await headers());
  const blocked = await applyAuthRateLimit('resetPassword', ip);
  if (blocked) return blocked;

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/update-password`,
  });
  // Always-success surface — see TSDoc above.
  return {};
}

/**
 * Set a new password for the authenticated session (post-magic-link).
 * Requires a live session — the magic link establishes one before
 * the user reaches the form.
 */
export async function updatePasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = parseFormData(formData, updatePasswordSchema);
  if (!parsed.ok) return { error: parsed.error, fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expired. Please request a new reset link.' };

  const ip = ipOfHeaders(await headers());
  const blocked = await applyAuthRateLimit('updatePassword', ip, user.id);
  if (blocked) return blocked;

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  redirect('/login');
}
