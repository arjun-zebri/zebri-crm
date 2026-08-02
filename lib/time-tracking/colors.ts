/**
 * The default colour rotation for time categories.
 *
 * Categories carry a user-chosen hex, the same model as branding, but a
 * new one has to start somewhere: an all-grey breakdown bar teaches
 * nobody anything, and asking an MC to open six pickers before their
 * first chart is readable is a poor trade.
 *
 * The order is not arbitrary and must not be re-sorted. It is the
 * validated categorical order from the dataviz palette: adjacent pairs
 * clear colour-blind separation (worst adjacent ΔE 9.1 protan) and the
 * normal-vision floor (worst 19.6) against this app's white surface.
 * Re-ordering puts blue next to violet, which fails both.
 *
 * Three slots (aqua, yellow, magenta) sit under 3:1 contrast on white,
 * so anything drawn in these colours ships visible labels beside it —
 * never colour alone. The breakdown bar's legend satisfies that.
 *
 * Kept in sync with the backfill array in
 * `supabase/migrations/20260730140000_time_category_colors.sql`.
 *
 * @module lib/time-tracking/colors
 */

/** Fixed categorical order. Assigned by slot, never cycled out of order. */
export const DEFAULT_CATEGORY_COLORS = [
  '#2A78D6', // blue
  '#EB6834', // orange
  '#1BAF7A', // aqua
  '#EDA100', // yellow
  '#E87BA4', // magenta
  '#008300', // green
  '#4A3AA7', // violet
  '#E34948', // red
] as const;

/**
 * Colour for a segment with no category of its own — uncategorised
 * time, and any category saved before colours existed.
 *
 * Deliberately a neutral from the border ramp rather than a ninth hue:
 * uncategorised is a gap to fill in, not a category, and giving it a
 * colour of its own would let it compete with real ones in the bar.
 */
export const UNCATEGORISED_COLOR = '#D1D5DB';

/**
 * The colour a newly created category should take.
 *
 * Picks the first slot not already in use so a user adding their fourth
 * category gets a fourth hue rather than a repeat of slot 1. Past eight
 * it wraps, which is the documented ceiling: a ninth category is never
 * a generated hue.
 */
export function nextCategoryColor(usedColors: readonly (string | null)[]): string {
  const taken = new Set(
    usedColors.filter((c): c is string => typeof c === 'string').map((c) => c.toUpperCase()),
  );
  const free = DEFAULT_CATEGORY_COLORS.find((c) => !taken.has(c));
  if (free) return free;
  // Every slot is in use; wrap by how many exist so two categories
  // created back to back still differ.
  return DEFAULT_CATEGORY_COLORS[taken.size % DEFAULT_CATEGORY_COLORS.length] ?? DEFAULT_CATEGORY_COLORS[0];
}

/** Whether a string is the uppercase `#RRGGBB` the column's CHECK accepts. */
export function isCategoryColor(value: string): boolean {
  return /^#[0-9A-F]{6}$/.test(value);
}

/** Coerce any picker output into the stored shape, or null if unusable. */
export function normalizeCategoryColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const hex = value.trim().toUpperCase();
  const expanded =
    /^#[0-9A-F]{3}$/.test(hex)
      ? `#${hex.slice(1).split('').map((c) => c + c).join('')}`
      : hex;
  return isCategoryColor(expanded) ? expanded : null;
}
