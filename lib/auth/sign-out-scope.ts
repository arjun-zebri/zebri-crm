/**
 * Which Supabase sign-out scope a browser sign-out button should use.
 *
 * `global` (Supabase's default) revokes every session the account has on
 * every device. That is right for an MC signing themselves out, and wrong
 * for Zebri support inside a shadow session: it would sign the MC out of
 * their own phone and laptop (Phase 4 review, I1). While shadowing, a
 * sign-out ends this browser's session only.
 *
 * Reads the browser-readable `zebri_is_shadowing` flag. That flag dies
 * with the 8 hour grant, but after that middleware ends the shadow
 * session on the next request (see `middleware.ts`, shadow expiry), and
 * a global sign-out sent with an already revoked session is refused by
 * Auth, so the gap cannot reach the MC's other devices. No React.
 *
 * @module lib/auth/sign-out-scope
 */

// The same name as SHADOW_FLAG_COOKIE in lib/auth/shadow-grant. Not
// imported: that module reads the service-role env var, and this one runs
// in client components (the sidebar), which must never pull it in.
const SHADOW_FLAG_COOKIE = 'zebri_is_shadowing';

/**
 * `'local'` while this browser is shadowing, otherwise `'global'`.
 *
 * @param cookieHeader - `document.cookie`, injectable for tests.
 */
export function signOutScope(cookieHeader: string): 'local' | 'global' {
  return cookieHeader.split('; ').some((c) => c === `${SHADOW_FLAG_COOKIE}=1`) ? 'local' : 'global';
}
