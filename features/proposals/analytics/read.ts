/**
 * Defensive readers for `proposal_events` payload fields, shared by the
 * summary, session and report modules.
 *
 * @module features/proposals/analytics/read
 */

// Why: rows are self-reported by an anonymous browser, so every payload
// field is read defensively rather than trusted as typed.

/** A finite, non-negative number, else 0 (negative or non-numeric seconds count nothing). */
export const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)

/** A non-empty string, else null. */
export const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)

/** A plain object view of a payload; anything else (null, string, array) reads as empty. */
export const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
