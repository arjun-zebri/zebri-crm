/**
 * Shadow-session records (Phase 4, Task 25).
 *
 * Every shadow session gets a row in `public.admin_shadow_sessions`
 * (migration 20261015000000), keyed by the Supabase JWT `session_id`
 * claim of the session `enterShadow` minted for the target. A database
 * trigger on every owned table reads that row to attribute each write
 * made through the session to the admin. The record is internal: the MC
 * is never shown it (owner ruling 2026-09-27, which removed the Settings
 * card and the `my_support_access()` read behind it).
 *
 * The service-role client is passed in, so this module stays free of
 * Next.js imports and is unit testable. No React.
 *
 * @module lib/admin/shadow-sessions
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { decodeJwtPayload } from '@/lib/auth/mfa';
import { SHADOW_GRANT_TTL_MS, verifyShadowMarker } from '@/lib/auth/shadow-grant';
import type { Database } from '@/types/database';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The `session_id` claim of a Supabase access token, or null when the
 * token is missing, malformed, or carries no uuid session id.
 *
 * Does not check the signature. Only pass a token the Auth server just
 * issued or accepted (the session `verifyOtp` returned, or the one
 * `getUser()` validated), never a value from the request body.
 */
export function jwtSessionId(accessToken: string | null | undefined): string | null {
  const sid = decodeJwtPayload(accessToken)?.session_id;
  return typeof sid === 'string' && UUID.test(sid) ? sid : null;
}

/** What {@link startShadowSession} records. */
export interface StartShadowSessionInput {
  /** JWT `session_id` of the target session enterShadow minted. */
  sessionId: string;
  adminId: string;
  targetUserId: string;
  /** Injectable clock for tests. */
  now?: Date;
}

/**
 * Record a new shadow session. Its expiry matches the shadow grant
 * (8 hours), so an admin who never presses Exit stops being attributed
 * at the same moment their grant dies.
 *
 * @returns null on success, or the database error message.
 */
export async function startShadowSession(
  svc: SupabaseClient<Database>,
  input: StartShadowSessionInput,
): Promise<string | null> {
  const now = input.now ?? new Date();
  const { error } = await svc.from('admin_shadow_sessions').insert({
    session_id: input.sessionId,
    admin_id: input.adminId,
    target_user_id: input.targetUserId,
    started_at: now.toISOString(),
    expires_at: new Date(now.getTime() + SHADOW_GRANT_TTL_MS).toISOString(),
  });
  return error ? error.message : null;
}

/** What {@link endShadowSession} closes. */
export interface EndShadowSessionInput {
  /** JWT `session_id` of the target session, when it could be read. */
  sessionId: string | null;
  adminId: string;
  targetUserId: string;
  now?: Date;
}

/**
 * Stamp `ended_at` on the admin's open shadow session of this target.
 *
 * Matches the exact session when its id is known. When it is not (a
 * cookie without a readable token), it closes every open session this
 * admin holds on this target: ending too many is harmless, while leaving
 * one open would show the MC a visit that never ends.
 *
 * @returns null when at least one row was closed; otherwise the database
 *   error message, or a note that nothing matched (so the caller alerts
 *   instead of assuming the record is closed).
 */
export async function endShadowSession(
  svc: SupabaseClient<Database>,
  input: EndShadowSessionInput,
): Promise<string | null> {
  let query = svc
    .from('admin_shadow_sessions')
    .update({ ended_at: (input.now ?? new Date()).toISOString() })
    .eq('admin_id', input.adminId)
    .eq('target_user_id', input.targetUserId)
    .is('ended_at', null);
  if (input.sessionId) query = query.eq('session_id', input.sessionId);
  const { data, error } = await query.select('id');
  if (error) return error.message;
  return data && data.length > 0 ? null : 'no open shadow session matched';
}

/**
 * Longest middleware lets the shadow request log hold up the admin's
 * request. A hung database must not stall every POST; past this the
 * request goes ahead and the insert finishes (or fails) in the background.
 */
export const SHADOW_REQUEST_LOG_TIMEOUT_MS = 1500;

/** One request made by the shadowing admin's browser. */
export interface ShadowRequestInput {
  adminId: string;
  targetUserId: string;
  method: string;
  /** Pathname only: a query string can carry names or emails. */
  path: string;
  /** The `Next-Action` header of a server-action POST (an opaque id). */
  nextAction: string | null;
  /** JWT `session_id` of the shadow session, when readable. */
  sessionId: string | null;
}

/**
 * Record a `shadow_request` row. Server actions and API routes that
 * write with the service role are invisible to the database's shadow
 * trigger (their JWT has no session), so middleware logs every non-GET
 * request the shadow browser makes instead. Ids and the path only.
 *
 * @returns null on success, or the database error message.
 */
export async function logShadowRequest(
  svc: SupabaseClient<Database>,
  input: ShadowRequestInput,
): Promise<string | null> {
  const { error } = await svc.from('admin_audit_log').insert({
    actor_id: input.adminId,
    target_user_id: input.targetUserId,
    action: 'shadow_request',
    details: {
      method: input.method,
      path: input.path,
      next_action: input.nextAction,
      shadow_session_id: input.sessionId,
    },
  });
  return error ? error.message : null;
}

// ---------------------------------------------------------------------
// Session binding and revocation (Phase 4 fix wave, review I1 and M1)
// ---------------------------------------------------------------------

/**
 * httpOnly cookie holding the JWT `session_id` of the target session
 * `enterShadow` minted. It is how middleware recognises that shadow
 * session after the grant has gone: the grant, admin-id and banner
 * cookies all expire at 8 hours, but the target session itself lives on
 * until Auth's timebox, so without this marker the browser would carry
 * on as the MC with no banner and no trail.
 */
export const SHADOW_SESSION_COOKIE = 'zebri_shadow_session';

/**
 * Lifetime of {@link SHADOW_SESSION_COOKIE}, in seconds: the 168 hour
 * Auth session timebox (supabase/config.toml). The marker has to outlive
 * the 8 hour grant by as long as the target session can live, or an
 * admin who returns on day three would be back in the bannerless state.
 */
export const SHADOW_SESSION_COOKIE_MAX_AGE_S = 168 * 60 * 60;

/**
 * How the marker cookie relates to the session this request carries:
 * `absent` (no marker), `match` (a validly signed marker naming this
 * request's session and user: the shadow session enterShadow minted) or
 * `mismatch` (anything else, including a forged, tampered or stale
 * marker). Only `match` means "this browser is inside that shadow
 * session".
 */
export type ShadowMarkerMatch = 'absent' | 'match' | 'mismatch';

/**
 * Check the marker cookie against the current session (review N1): the
 * signature must verify, the signed session id must equal the JWT
 * `session_id`, and the signed target must be the session's user. Any
 * failure is `mismatch`, never `absent`, so a forged marker cannot pass
 * for no marker either.
 */
export async function shadowMarkerMatch(input: {
  /** The {@link SHADOW_SESSION_COOKIE} value, if any. */
  marker: string | null | undefined;
  /** From {@link jwtSessionId} on the validated session. */
  sessionId: string | null | undefined;
  /** The signed-in user, from `getUser()`. */
  sessionUserId: string | null | undefined;
  secret: string | null;
}): Promise<ShadowMarkerMatch> {
  if (!input.marker) return 'absent';
  const claims = await verifyShadowMarker(input.marker, input.secret);
  if (!claims || !input.sessionId || !input.sessionUserId) return 'mismatch';
  return claims.sessionId === input.sessionId && claims.targetUserId === input.sessionUserId
    ? 'match'
    : 'mismatch';
}

/**
 * Revoke one target session with the service role, scope `local`: that
 * session and its refresh tokens only, never the MC's sessions on other
 * devices. Used by `exitShadow` so a copied shadow token stops working
 * the moment support leaves (review I1 and I2).
 *
 * @param svc - The service-role client.
 * @param accessToken - The shadow session's access token, which names
 *   the session to revoke.
 * @returns null once revoked, otherwise why not (for the caller's alert).
 */
export async function revokeShadowTargetSession(
  svc: SupabaseClient<Database>,
  accessToken: string | null | undefined,
): Promise<string | null> {
  if (!accessToken) return 'no target access token';
  try {
    const { error } = await svc.auth.admin.signOut(accessToken, 'local');
    return error ? error.message : null;
  } catch (err) {
    return err instanceof Error ? err.message : 'revoke failed';
  }
}

/**
 * Revoke every finished shadow session's target auth session, server
 * side (Phase 4 fix-2, review N2). Middleware only revokes on the shadow
 * browser's next request, so a closed or idle browser would otherwise
 * keep the session live for days, and the MC's own account edits would
 * be attributed to the admin. Calls `revoke_expired_shadow_sessions()`
 * (migration 20261021000000), which is idempotent and sweeps each
 * ended or expired row once. Run by the workflow tick.
 *
 * @param svc - The service-role client.
 * @returns How many auth sessions it deleted.
 * @throws When the RPC fails, so the tick's guard alerts.
 */
export async function revokeExpiredShadowSessions(svc: SupabaseClient<Database>): Promise<number> {
  const { data, error } = await svc.rpc('revoke_expired_shadow_sessions');
  if (error) throw new Error(`revoke_expired_shadow_sessions failed: ${error.message}`);
  return typeof data === 'number' ? data : 0;
}
