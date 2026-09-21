/**
 * Pure drag maths shared by every resize handle in the editors (section
 * height and width, image, columns, spacer, the Branding hero). Nothing
 * here touches the DOM except `zoomFactor`, so the numbers are
 * unit-testable without rendering anything.
 *
 * @module components/editor/resize-math
 */

/** A value a drag can lock onto, with an optional label for its readout. */
export interface Snap {
  /** The value this snap pulls a drag towards. */
  value: number
  /** Shown in the readout pill instead of the formatted value when snapped. */
  label?: string
}

/**
 * Screen px per layout px for a CSS `zoom`-scaled root, or 1 when it can't
 * be measured. The canvas is zoomed with CSS `zoom` to fit the viewport,
 * so a screen pixel of mouse movement is not a layout pixel of the value
 * being dragged; comparing an element's unzoomed layout height to its
 * zoomed screen height recovers the factor without the caller needing to
 * know the canvas's zoom level. jsdom has no layout engine, so both
 * measurements come back 0 there and this falls back to 1.
 */
export function zoomFactor(el: HTMLElement | null): number {
  if (!el) return 1
  const layout = el.offsetHeight
  const screen = el.getBoundingClientRect().height
  return layout > 0 && screen > 0 ? screen / layout : 1
}

/** Confines `value` to `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Rounds `value` to the nearest multiple of `step`, or returns it unchanged when `step` is 0. */
export function stepRound(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value
}

/** The nearest snap wins when it is within `tolerance` units of `value`; otherwise `value` passes through. */
export function applySnaps(value: number, snaps: readonly Snap[], tolerance: number): number {
  let best: Snap | null = null
  for (const s of snaps) {
    const d = Math.abs(s.value - value)
    if (d <= tolerance && (!best || d < Math.abs(best.value - value))) best = s
  }
  return best ? best.value : value
}

/**
 * Drag maths without the DOM: a start value plus a delta in screen px
 * becomes the next value, after converting through zoom and scale,
 * clamping to bounds, rounding to a step and, last, snapping. Snapping
 * runs after clamping (not before) so a snap target that sits at a bound
 * is reached the same way a bounded drag reaches it.
 */
export function dragValue(o: {
  start: number
  deltaScreenPx: number
  zoom: number
  /** Layout px per unit of the value being dragged (1 for px values). */
  scale?: number
  min: number
  max: number
  step?: number
  snaps?: readonly Snap[]
  tolerance?: number
}): number {
  const layoutPx = o.deltaScreenPx / (o.zoom || 1)
  const units = layoutPx / (o.scale ?? 1)
  let next = clamp(Math.round(o.start + units), o.min, o.max)
  if (o.step) next = clamp(stepRound(next, o.step), o.min, o.max)
  if (o.snaps) next = applySnaps(next, o.snaps, o.tolerance ?? 0)
  return next
}
