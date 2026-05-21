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

/** Inline form state passed back to the client component. */
export interface AuthActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** Default "no error yet" form state. */
export const emptyAuthState: AuthActionState = {};
