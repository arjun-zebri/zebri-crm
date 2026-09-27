/**
 * Result types for the two-factor server actions. Kept out of the
 * `'use server'` file, which may export async functions only.
 *
 * @module app/(dashboard)/settings/account/two-factor-state
 */

/** A failed two-factor action, with copy fit to show the MC. */
export interface TwoFactorFailure {
  ok: false;
  error: string;
}

/** Fresh recovery codes, returned once for display and never again. */
export type IssueRecoveryCodesResult = { ok: true; codes: string[] } | TwoFactorFailure;

/** How many unused recovery codes remain. */
export type RecoveryCodesLeftResult = { ok: true; remaining: number } | TwoFactorFailure;

/** Two-factor sign-in switched off. */
export type TurnOffTwoFactorResult = { ok: true } | TwoFactorFailure;
