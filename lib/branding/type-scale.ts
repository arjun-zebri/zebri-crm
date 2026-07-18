/**
 * Derives a pixel size for every document text role from the two global
 * typography numbers the user controls (heading size and body size).
 *
 * Documents need more sizes than two, but exposing a control per role
 * would be a worse product. Instead each role is a fixed ratio of one of
 * the two numbers, so moving a single slider rescales the document
 * proportionally and it can never land in a broken state.
 *
 * @module lib/branding/type-scale
 */

/** The text roles a rendered document can ask for. */
export type TypeRole =
  | 'docTitle'
  | 'sectionHeading'
  | 'total'
  | 'subtitle'
  | 'body'
  | 'finePrint'
  | 'sectionLabel'

/** Smallest size any role may render at, so fine print stays legible. */
export const MIN_FONT_PX = 9

/** Which global number a role scales from, and by how much. */
const SCALE: Record<TypeRole, { base: 'heading' | 'body'; ratio: number }> = {
  docTitle: { base: 'heading', ratio: 1 },
  sectionHeading: { base: 'heading', ratio: 0.625 },
  total: { base: 'heading', ratio: 0.5625 },
  subtitle: { base: 'body', ratio: 1 },
  body: { base: 'body', ratio: 1 },
  finePrint: { base: 'body', ratio: 0.8 },
  sectionLabel: { base: 'body', ratio: 0.73 },
}

/**
 * Resolve a role to a whole-pixel size.
 *
 * @param role - The document text role.
 * @param headingSize - The global heading size in px.
 * @param bodySize - The global body size in px.
 * @returns The size in px, never below {@link MIN_FONT_PX}.
 */
export function roleSizePx(role: TypeRole, headingSize: number, bodySize: number): number {
  const { base, ratio } = SCALE[role]
  const source = base === 'heading' ? headingSize : bodySize
  return Math.max(MIN_FONT_PX, Math.round(source * ratio))
}
