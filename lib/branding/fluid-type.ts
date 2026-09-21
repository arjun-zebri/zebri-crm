/**
 * The one rule every proposal text size passes through on its way to
 * CSS, so a size an author sets on a desktop canvas reads on a phone.
 *
 * The author's number is the desktop size and the ceiling; on a narrow
 * doc container it shrinks in proportion to the width, never below a
 * floor. Body-range text (at or below {@link FLUID_FLOOR_PX}) only
 * shrinks a little ({@link BODY_MIN_SHARE}): unlike a headline, it is
 * already sized for reading, so a phone gets a gentle softening rather
 * than the full headline-style scale-down (2026-09-19 feedback: table
 * cells and paragraph text read too large/cramped on a narrow doc,
 * overriding the earlier "body text never shrinks" rule this module
 * started with). This is still the same model Qwilr-style page builders
 * use - headline type scales down more aggressively than body type - and
 * generalises the `clamp()` Heading 1 alone used to get.
 *
 * Width-relative via `cqw`, not `vw`, because every host wraps a document
 * in `@container/doc` (public pages, the proposal editor canvas, its
 * Preview, the template thumbnail):
 * the editor's mobile canvas and the mobile Preview are a ~390px column
 * inside a desktop window, so a viewport unit would never shrink there
 * and the author would see something the couple's phone does not.
 *
 * @module lib/branding/fluid-type
 */

/**
 * The boundary between the two shrink rates: at or below this, a size
 * uses the gentle {@link BODY_MIN_SHARE}; above it, the steeper
 * {@link HEADLINE_MIN_SHARE}. 32px is a common phone headline size and
 * the default Heading 1 (Branding's 32px title).
 */
export const FLUID_FLOOR_PX = 32

/**
 * Container width in px at which a fluid size reaches its full value.
 * Below it (phones; a 390px column gives ~70%) the size tracks the
 * width; at or above it (tablets, desktop, the 1200px thumbnail render)
 * the author's number applies as set.
 */
const FULL_SIZE_AT_PX = 560

/** Smallest share of the set size a body-range (<= {@link FLUID_FLOOR_PX}) size may fall to: a little smaller on the narrowest phone, not a headline-style scale-down. */
const BODY_MIN_SHARE = 0.85
/** Smallest share of the set size a size past the floor may fall to, so a very large headline still shrinks meaningfully but keeps its scale relative to smaller text. */
const HEADLINE_MIN_SHARE = 0.6

const PX = /^(\d+(?:\.\d+)?)px$/

/**
 * A font size as CSS: `clamp(floor, <width share>cqw, <n>px)`, floor set
 * by {@link BODY_MIN_SHARE} or {@link HEADLINE_MIN_SHARE} depending on
 * which side of {@link FLUID_FLOOR_PX} the size falls. Accepts the
 * number of px or the `'<n>px'` string a `textStyle` mark stores; any
 * other string (a pasted `rem`, an already-fluid value) is returned
 * untouched.
 */
export function fluidFontSize(size: number | string): string {
  let px: number
  if (typeof size === 'number') {
    px = size
  } else {
    const m = PX.exec(size.trim())
    if (!m) return size
    px = Number(m[1])
  }
  const headline = px > FLUID_FLOOR_PX
  const floor = headline ? Math.max(FLUID_FLOOR_PX, Math.round(px * HEADLINE_MIN_SHARE)) : Math.round(px * BODY_MIN_SHARE)
  // `n / FULL_SIZE_AT_PX * 100` cqw equals exactly n px when the container is
  // FULL_SIZE_AT_PX wide; the ceiling stops it growing past that.
  const share = Math.round((px / FULL_SIZE_AT_PX) * 10000) / 100
  return `clamp(${floor}px, ${share}cqw, ${px}px)`
}
