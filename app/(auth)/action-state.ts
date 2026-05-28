/**
 * Shared types + constants for the auth server actions.
 *
 * Lives in its own non-`'use server'` module because Next.js
 * restricts `'use server'` files to async-function exports only —
 * you can't export interfaces or constants from a server-actions
 * file.
 *
 * @module app/(auth)/action-state
 */

/**
 * Inline form state passed back to the client component.
 *
 * `values` carries the previously submitted non-secret inputs so the
 * form can re-render with them as `defaultValue` after an error,
 * sparing the user from re-typing their email or name. Passwords are
 * **never** echoed back — they always reset on error and the user
 * retypes.
 */
export interface AuthActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

/** Default "no error yet" form state. */
export const emptyAuthState: AuthActionState = {};
