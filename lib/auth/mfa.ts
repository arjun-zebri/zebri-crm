/**
 * Two-factor (TOTP) assurance checks.
 *
 * Supabase marks a session `aal1` after a password sign-in and `aal2`
 * after a verified TOTP code. An MC who has turned on two-factor sign-in
 * has a verified factor, so their "next" level is `aal2`, and until the
 * session reaches it the dashboard must stay shut (Phase 4, Task 23).
 *
 * Why not `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` with no
 * argument: that reads the factor list from `session.user` in the auth
 * cookie, which is plain JSON the browser can edit. Deleting the factors
 * from that copy would make `nextLevel` fall to `aal1` and open the
 * dashboard on a password alone. Here the factor list comes from the
 * user object the Auth server returned for `getUser()`, and the current
 * level comes from the signed access token that same call validated.
 *
 * Pure and runtime-neutral (no Node APIs), so middleware can import it.
 *
 * @module lib/auth/mfa
 */

/**
 * The page a session that still owes its second factor is sent to.
 * Under `/login`, so middleware treats it as a public route and never
 * redirects it to itself.
 */
export const SECOND_FACTOR_PATH = '/login/mfa';

/**
 * How many recovery codes an MC gets each time codes are issued. Lives
 * here, not in the Node-only recovery-codes module, so the Settings card
 * can show "7 of 10 left" without importing `node:crypto`.
 */
export const RECOVERY_CODE_COUNT = 10;

/** An Auth assurance level. `aal1` = password, `aal2` = password plus a second factor. */
export type AssuranceLevel = 'aal1' | 'aal2';

/** The minimal slice of a Supabase user this module reads. */
export interface FactorSource {
  factors?: ReadonlyArray<{ status: string; factor_type?: string }> | null;
}

/**
 * Decode the payload of a JWT without checking its signature.
 *
 * Only call this on a token the Auth server has already accepted (the
 * one `getUser()` just validated). Returns null for anything that is
 * not a three-part token with a JSON object payload.
 */
export function decodeJwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(padded));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** True when the user has at least one verified second factor. */
export function hasVerifiedFactor(user: FactorSource | null | undefined): boolean {
  return (user?.factors ?? []).some((f) => f.status === 'verified');
}

/**
 * The level the session is at now, read from the access token's `aal`
 * claim. Null when the token is missing or carries no recognised level.
 */
export function currentAssuranceLevel(accessToken: string | null | undefined): AssuranceLevel | null {
  const aal = decodeJwtPayload(accessToken)?.aal;
  return aal === 'aal1' || aal === 'aal2' ? aal : null;
}

/**
 * True when this session still owes its second factor: the user has a
 * verified factor and the session has not reached `aal2`.
 *
 * A missing or unreadable token counts as owing it. Failing closed here
 * costs a trip to the code screen; failing open would skip the factor.
 *
 * @param user The user returned by `supabase.auth.getUser()` (server-validated).
 * @param accessToken The access token of the same session.
 */
export function needsSecondFactor(
  user: FactorSource | null | undefined,
  accessToken: string | null | undefined,
): boolean {
  if (!hasVerifiedFactor(user)) return false;
  return currentAssuranceLevel(accessToken) !== 'aal2';
}
