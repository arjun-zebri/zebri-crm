/**
 * Signed proof that an admin started the current shadow session.
 *
 * Why this exists: shadow mode used to trust the bare
 * `zebri_shadow_admin_id` cookie. That cookie is just a user id, so
 * anyone could set it by hand. `exitShadow` then minted a session for
 * whatever id it named (an account takeover), and middleware skipped the
 * past_due paywall whenever it was present.
 *
 * The grant is an HMAC-SHA256 over the admin id, the target user id and
 * an expiry. Only `enterShadow` mints one, and only after
 * `assertAdmin()`. The key is derived from the service-role key, which
 * never reaches the browser, so no new secret has to be provisioned.
 * With no key the helpers fail closed.
 *
 * Uses Web Crypto only, so it runs in middleware as well as in Node.
 * No React.
 *
 * @module lib/auth/shadow-grant
 */

/** Cookie holding the signed grant. httpOnly; set beside `zebri_shadow_admin_id`. */
export const SHADOW_GRANT_COOKIE = 'zebri_shadow_grant';

/** Cookie holding the shadowing admin's id. Not trusted on its own. */
export const SHADOW_ADMIN_COOKIE = 'zebri_shadow_admin_id';

/** Browser-readable flag the shadow banner uses. Presentation only. */
export const SHADOW_FLAG_COOKIE = 'zebri_is_shadowing';

/** How long a grant stays valid after `enterShadow`: 8 hours. */
export const SHADOW_GRANT_TTL_MS = 8 * 60 * 60 * 1000;

/** What a grant vouches for. */
export interface ShadowGrantClaims {
  /** The admin who entered shadow mode. */
  adminId: string;
  /** The user being shadowed; the session's user while shadowing. */
  targetUserId: string;
  /** Epoch ms after which the grant is void. */
  expiresAt: number;
}

// Domain label so this HMAC key can never collide with any other use of
// the service-role key as key material.
const KEY_LABEL = 'zebri-shadow-grant-v1';

// Supabase user ids are UUIDs. Restricting the id alphabet also means the
// `.` separator can never appear inside a field.
const GRANT_PATTERN = /^v1\.([0-9a-f-]{36})\.([0-9a-f-]{36})\.(\d{1,16})\.([0-9a-f]{64})$/;

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  // Derive a purpose-bound key first: HMAC(secret, label). The raw
  // service-role key is then never the MAC key itself.
  const root = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const derived = await crypto.subtle.sign('HMAC', root, encoder.encode(KEY_LABEL));
  return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

function message(claims: ShadowGrantClaims): Uint8Array<ArrayBuffer> {
  return encoder.encode(`v1|${claims.adminId}|${claims.targetUserId}|${claims.expiresAt}`);
}

/**
 * Mint a grant cookie value: `v1.<adminId>.<targetUserId>.<expiresAt>.<hex hmac>`.
 *
 * @param claims - The admin, the target and the expiry to bind.
 * @param secret - Key material from {@link shadowGrantSecret}.
 * @returns The value to store in {@link SHADOW_GRANT_COOKIE}.
 */
export async function signShadowGrant(claims: ShadowGrantClaims, secret: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), message(claims));
  return `v1.${claims.adminId}.${claims.targetUserId}.${claims.expiresAt}.${toHex(sig)}`;
}

/**
 * Verify a grant cookie value and return its claims.
 *
 * The MAC check is Web Crypto `verify`, which compares in constant time.
 * Callers still have to compare the returned ids against the session user
 * and the admin cookie: a valid grant only proves what it was minted for.
 *
 * @param value - The raw cookie value, if any.
 * @param secret - Key material; `null` (no key configured) always fails.
 * @param now - Current epoch ms, injectable for tests.
 * @returns The claims, or `null` when the value is missing, malformed,
 *   expired, or not signed with this key.
 */
export async function verifyShadowGrant(
  value: string | null | undefined,
  secret: string | null,
  now: number = Date.now(),
): Promise<ShadowGrantClaims | null> {
  if (!value || !secret) return null;
  const match = GRANT_PATTERN.exec(value);
  if (!match || !match[1] || !match[2] || !match[3] || !match[4]) return null;
  const claims: ShadowGrantClaims = {
    adminId: match[1],
    targetUserId: match[2],
    expiresAt: Number(match[3]),
  };
  if (!Number.isFinite(claims.expiresAt) || claims.expiresAt <= now) return null;
  const sigBytes = Uint8Array.from(match[4].match(/../g) ?? [], (h) => parseInt(h, 16));
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), sigBytes, message(claims));
  return ok ? claims : null;
}

/**
 * The key material, or `null` when the server has no service-role key.
 * Every caller treats `null` as "no valid grant", so a misconfigured
 * deploy fails closed.
 */
export function shadowGrantSecret(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

// ---------------------------------------------------------------------
// Two-factor waiver (Phase 4, Task 23). Everything above this line is the
// production hotfix (fix/exit-shadow-takeover) verbatim; keep it so, so
// the two branches merge cleanly. Additions go below.
// ---------------------------------------------------------------------

/**
 * Why a shadow grant was not accepted. The same closed list the
 * `admin_shadow_exit_refused` alert carries, so both readers of a grant
 * report refusals in one vocabulary.
 */
export type ShadowGrantRefusal = Extract<
  import('@/lib/alerts/events').AlertEvent,
  { type: 'admin_shadow_exit_refused' }
>['reason'];

/** Whether an admin id still belongs to an admin, as the caller looked it up. */
export type ShadowAdminStatus = 'admin' | 'not_admin' | 'lookup_failed';

/**
 * Decide whether this request's shadow cookies prove a genuine shadow
 * session of `sessionUserId`. Same checks, in the same order, as
 * `exitShadow`: a signed-in user; a grant that verifies (signed with the
 * server key, in date); the grant names this user as the target; the
 * grant's admin is the admin-id cookie; that admin is still an admin.
 *
 * The admin lookup is injected (`adminStatus`) so middleware can use the
 * service-role client and tests can stub it, and it runs last, so a
 * forged cookie never costs an Auth call.
 *
 * @returns `{ ok: true, adminId }`, or the first check that failed.
 */
export async function evaluateShadowGrant(input: {
  /** The `zebri_shadow_admin_id` cookie, possibly forged. */
  claimedAdminId: string | null | undefined;
  /** The `zebri_shadow_grant` cookie value. */
  grant: string | null | undefined;
  /** The signed-in user, from `getUser()`. */
  sessionUserId: string | null | undefined;
  now: number;
  secret: string | null;
  adminStatus: (adminId: string) => Promise<ShadowAdminStatus>;
}): Promise<{ ok: true; adminId: string } | { ok: false; reason: ShadowGrantRefusal }> {
  if (!input.sessionUserId) return { ok: false, reason: 'no_session' };
  const claims = await verifyShadowGrant(input.grant, input.secret, input.now);
  // An admin cannot shadow themselves (enterShadow refuses), so a grant
  // naming one user as both could only be forged.
  if (!claims || claims.adminId === claims.targetUserId) return { ok: false, reason: 'invalid_grant' };
  if (claims.targetUserId !== input.sessionUserId) return { ok: false, reason: 'target_mismatch' };
  if (claims.adminId !== input.claimedAdminId) return { ok: false, reason: 'admin_cookie_mismatch' };
  const status = await input.adminStatus(claims.adminId);
  if (status === 'lookup_failed') return { ok: false, reason: 'admin_lookup_failed' };
  if (status === 'not_admin') return { ok: false, reason: 'not_admin' };
  return { ok: true, adminId: claims.adminId };
}

/**
 * Whether this request's shadow cookies waive the second factor for the
 * signed-in user. See {@link evaluateShadowGrant}. Deliberately stricter
 * than the past-due paywall skip in middleware (which, as in the hotfix,
 * checks only the grant and its target): waiving a second factor also
 * needs the admin cookie to match and the admin to still be an admin.
 */
export async function shadowWaiverApplies(
  input: Parameters<typeof evaluateShadowGrant>[0],
): Promise<boolean> {
  return (await evaluateShadowGrant(input)).ok;
}

// ---------------------------------------------------------------------
// Signed shadow-session marker (Phase 4 fix-2, review N1)
// ---------------------------------------------------------------------

/**
 * What a shadow-session marker vouches for: the JWT `session_id` of the
 * target session `enterShadow` minted, and that session's user.
 */
export interface ShadowMarkerClaims {
  sessionId: string;
  targetUserId: string;
}

// A different label from the grant key's, so a grant MAC can never be
// passed off as a marker MAC or the other way round.
const MARKER_KEY_LABEL = 'zebri-shadow-session-marker-v1';

const MARKER_PATTERN = /^v1\.([0-9a-f-]{36})\.([0-9a-f-]{36})\.([0-9a-f]{64})$/;

async function markerKey(secret: string): Promise<CryptoKey> {
  const root = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const derived = await crypto.subtle.sign('HMAC', root, encoder.encode(MARKER_KEY_LABEL));
  return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

function markerMessage(claims: ShadowMarkerClaims): Uint8Array<ArrayBuffer> {
  return encoder.encode(`v1|${claims.sessionId}|${claims.targetUserId}`);
}

/**
 * Mint the `zebri_shadow_session` cookie value:
 * `v1.<sessionId>.<targetUserId>.<hex hmac>`.
 *
 * Why signed: the session id is readable by whoever holds the session
 * (it is a claim in their own access token), so a bare id proves
 * nothing. Only the server can produce this MAC, and only `enterShadow`
 * does, for the session it just minted.
 *
 * @param claims - The minted session id and its user.
 * @param secret - Key material from {@link shadowGrantSecret}.
 */
export async function signShadowMarker(claims: ShadowMarkerClaims, secret: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await markerKey(secret), markerMessage(claims));
  return `v1.${claims.sessionId}.${claims.targetUserId}.${toHex(sig)}`;
}

/**
 * Verify a marker cookie value (Web Crypto `verify`, constant time).
 *
 * @param value - The raw cookie value, if any.
 * @param secret - Key material; `null` always fails.
 * @returns The claims, or `null` when missing, malformed or not signed
 *   with this key. Callers still compare them with the request's session.
 */
export async function verifyShadowMarker(
  value: string | null | undefined,
  secret: string | null,
): Promise<ShadowMarkerClaims | null> {
  if (!value || !secret) return null;
  const match = MARKER_PATTERN.exec(value);
  if (!match || !match[1] || !match[2] || !match[3]) return null;
  const claims: ShadowMarkerClaims = { sessionId: match[1], targetUserId: match[2] };
  const sigBytes = Uint8Array.from(match[3].match(/../g) ?? [], (h) => parseInt(h, 16));
  const ok = await crypto.subtle.verify('HMAC', await markerKey(secret), sigBytes, markerMessage(claims));
  return ok ? claims : null;
}
