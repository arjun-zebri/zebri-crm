/**
 * Text-case transforms for branded document text.
 *
 * CSS `text-transform` covers uppercase, lowercase, and capitalize (every
 * word), but has no value for sentence case (capitalise the first letter
 * only), and CSS `::first-letter` only works on block containers — not the
 * inline `<span>`s most document labels render as. So sentence case is done as
 * a string rewrite ({@link applyCase}) instead: robust for any element, inline
 * or block, and unit-testable. The CSS-native cases still flow through
 * {@link cssTextTransform}; the two never overlap (sentence emits no CSS
 * transform, and applyCase is a no-op for every other case).
 *
 * @module lib/branding/text-case
 */

/** The five case options a global or per-block text style can request. */
export type TextCase = 'none' | 'uppercase' | 'lowercase' | 'capitalize' | 'sentence'

/**
 * The `text-transform` CSS value for a case, or `'none'` when the case has no
 * CSS equivalent (only sentence case does — it is handled by {@link applyCase}).
 *
 * @param transform - The requested case (undefined behaves as `'none'`).
 * @returns A valid `text-transform` value.
 */
export function cssTextTransform(
  transform: TextCase | undefined,
): 'none' | 'uppercase' | 'lowercase' | 'capitalize' {
  if (transform === 'sentence' || transform == null) return 'none'
  return transform
}

/**
 * Apply the string half of a case transform. Only sentence case rewrites the
 * string — the whole value is lowercased and its first letter uppercased, so
 * "INVOICE No 4" becomes "Invoice no 4" and "Account name" stays "Account
 * name". This deliberately flattens acronyms (BSB → Bsb): sentence case can't
 * know which runs were meant to stay capitalised, and the picker offers
 * "As typed" for text that must keep them. Every CSS-native case is returned
 * unchanged (CSS handles it), so this is safe to call on all rendered text.
 *
 * @param text - The source string.
 * @param transform - The requested case (undefined behaves as `'none'`).
 * @returns The transformed string, or `text` unchanged for non-sentence cases.
 */
export function applyCase(text: string, transform: TextCase | undefined): string {
  if (transform !== 'sentence') return text
  const lower = text.toLocaleLowerCase()
  // Capitalise the very first character only (as a real sentence does). If it
  // is a digit or symbol it is left unchanged and the rest stays lowercase, so
  // "4 weeks" stays "4 weeks" rather than becoming "4 Weeks".
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1)
}
