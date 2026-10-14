/**
 * Parse a typed "share of people" value. An empty or non-numeric field
 * returns null, so the caller keeps the field's text instead of writing 0.
 * Writing 0 on an empty field is what made a cleared share snap back to 0.
 *
 * @module features/outreach/views/campaigns/share-input
 */

/** Whole number 0 to 100, or null while the field is blank or not a number. */
export function parseShare(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}
