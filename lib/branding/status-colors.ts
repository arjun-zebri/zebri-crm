/**
 * Status colours for public surfaces.
 *
 * These are deliberately NOT part of the brand model. Red has to mean
 * error and green has to mean success no matter what an MC picks, and a
 * brand-tinted validation message is a worse experience, not a more
 * cohesive one. Public surfaces import these instead of reaching for
 * Zebri's app-chrome tokens, which are not in scope on a couple's document.
 *
 * @module lib/branding/status-colors
 */

/** Fixed, non-brandable status colours. */
export const STATUS_COLORS = {
  /** Validation failures and destructive outcomes. */
  error: '#DC2626',
  /** Confirmations: accepted, paid, signed. */
  success: '#16A34A',
  /** Time-sensitive states: expiring, overdue. */
  warning: '#D97706',
} as const
