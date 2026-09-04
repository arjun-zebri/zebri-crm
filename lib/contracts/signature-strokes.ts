/**
 * Pure geometry for the signature pad.
 *
 * The pad itself is a canvas, which jsdom cannot render, so every decision that
 * can be made without a drawing context lives here where it can be tested:
 * whether a gesture counts as a signature, and how strokes map onto the backing
 * store.
 *
 * @module lib/contracts/signature-strokes
 */

/** One point in a stroke, in CSS pixels relative to the pad. */
export interface StrokePoint {
  x: number
  y: number
}

/** A stroke is one continuous pointer-down to pointer-up gesture. */
export type Stroke = StrokePoint[]

/**
 * Minimum total travel, in CSS pixels, before a gesture counts as a signature.
 *
 * A single tap or an accidental brush against a phone screen produces a stroke
 * with almost no length. Accepting one would let a signer "sign" a contract
 * with a dot, so the pad treats anything under this as empty and keeps the Sign
 * button disabled.
 */
export const MIN_SIGNATURE_TRAVEL_PX = 24

/** Total distance travelled across every stroke. */
export function totalTravel(strokes: readonly Stroke[]): number {
  let total = 0
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i += 1) {
      const a = stroke[i - 1]!
      const b = stroke[i]!
      total += Math.hypot(b.x - a.x, b.y - a.y)
    }
  }
  return total
}

/**
 * True when the pad holds nothing worth calling a signature.
 *
 * @param strokes - Every stroke drawn so far.
 */
export function isEmptyStroke(strokes: readonly Stroke[]): boolean {
  return totalTravel(strokes) < MIN_SIGNATURE_TRAVEL_PX
}

/**
 * The device-pixel-ratio to render the pad's backing store at.
 *
 * Capped at 2 because the export size scales with the square of this value and
 * the image has a hard 128KB budget: a 3x phone would triple the pixel count
 * for no visible gain in a signature.
 *
 * @param devicePixelRatio - The window's ratio; missing or absurd values fall
 *   back to 1.
 */
export function padPixelRatio(devicePixelRatio: number | undefined): number {
  if (!devicePixelRatio || !Number.isFinite(devicePixelRatio) || devicePixelRatio < 1) return 1
  return Math.min(devicePixelRatio, 2)
}
