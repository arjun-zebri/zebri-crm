/**
 * The arithmetic behind dragging a section's background image
 * (`background-reposition.tsx`): how far a pointer moved on screen maps
 * to a change in `SectionBackground.position` (`object-position`
 * percentages) for an `object-fit: cover` image. Pure, so the drag can be
 * tested without layout.
 *
 * @module features/proposals/editor/background-reposition-math
 */

/** A focal point as `object-position` percentages, 0-100 each. */
export interface FocalPoint { x: number; y: number }
/** Width and height in CSS pixels. */
export interface Size { w: number; h: number }

/** Clamped to the 0-100 range and rounded to a tenth: finer than any screen can show, and keeps the stored layout tidy. */
const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10

/**
 * Moves `start` by a pointer drag of `delta` pixels over a `box` showing
 * `natural`-sized image under `object-fit: cover`.
 *
 * Cover scales the image until it fills the box on both axes, so it
 * overflows on at most one axis (or neither, at an exact aspect match);
 * `object-position`'s percentage maps the overflow linearly, `0%` showing
 * the image's leading edge and `100%` its trailing edge. Dragging the
 * image to the right therefore reveals more of its left side - the
 * percentage *decreases* - hence the subtraction. An axis with no
 * overflow has nothing to reveal and is left alone.
 */
export function dragFocalPoint(start: FocalPoint, delta: { dx: number; dy: number }, box: Size, natural: Size): FocalPoint {
  if (box.w <= 0 || box.h <= 0 || natural.w <= 0 || natural.h <= 0) return start
  const scale = Math.max(box.w / natural.w, box.h / natural.h)
  const overflowX = natural.w * scale - box.w
  const overflowY = natural.h * scale - box.h
  return {
    x: overflowX > 0.5 ? clamp(start.x - (delta.dx / overflowX) * 100) : start.x,
    y: overflowY > 0.5 ? clamp(start.y - (delta.dy / overflowY) * 100) : start.y,
  }
}
