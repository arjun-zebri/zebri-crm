/**
 * The canvas's arithmetic: moving and resizing a box, and snapping it to
 * the page and to the other elements the way Canva does, with the guide
 * lines to draw while it snaps. Pure: page pixels in, page pixels out.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/geometry
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A resize handle: an edge or a corner. */
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** A guide line to draw: vertical at `x`, or horizontal at `y`. */
export type Guide = { axis: 'x' | 'y'; at: number };

/** The smallest an element can be resized to. */
const MIN = 12;

/** A box resized by dragging `handle` by (dx, dy); `keepRatio` holds its shape (pictures, from a corner). */
export function resize(r: Rect, handle: Handle, dx: number, dy: number, keepRatio: boolean): Rect {
  let { x, y, w, h } = r;
  if (handle.includes('e')) w = Math.max(MIN, r.w + dx);
  if (handle.includes('s')) h = Math.max(MIN, r.h + dy);
  if (handle.includes('w')) {
    w = Math.max(MIN, r.w - dx);
    x = r.x + r.w - w;
  }
  if (handle.includes('n')) {
    h = Math.max(MIN, r.h - dy);
    y = r.y + r.h - h;
  }
  if (keepRatio && handle.length === 2) {
    // From a corner the wider change leads and the other follows the original shape.
    const ratio = r.w / r.h;
    if (w / ratio > h) h = w / ratio;
    else w = h * ratio;
    if (handle.includes('w')) x = r.x + r.w - w;
    if (handle.includes('n')) y = r.y + r.h - h;
  }
  return { x, y, w, h };
}

/** The three lines of a box on one axis: start, middle, end. */
const lines = (r: Rect, axis: 'x' | 'y') => (axis === 'x' ? [r.x, r.x + r.w / 2, r.x + r.w] : [r.y, r.y + r.h / 2, r.y + r.h]);

/**
 * A moved box snapped to the nearest page edge, page centre or other
 * element's edge or centre within `tolerance`, on each axis, with the
 * guides that it snapped to.
 */
export function snap(r: Rect, others: Rect[], page: { width: number; height: number }, tolerance: number): { rect: Rect; guides: Guide[] } {
  const out = { ...r };
  const guides: Guide[] = [];
  for (const axis of ['x', 'y'] as const) {
    const targets = [0, (axis === 'x' ? page.width : page.height) / 2, axis === 'x' ? page.width : page.height, ...others.flatMap((o) => lines(o, axis))];
    let best: { delta: number; at: number } | null = null;
    for (const mine of lines(r, axis)) {
      for (const t of targets) {
        const delta = t - mine;
        if (Math.abs(delta) <= tolerance && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: t };
      }
    }
    if (best) {
      out[axis] += best.delta;
      guides.push({ axis, at: best.at });
    }
  }
  return { rect: out, guides };
}

/** The box around several boxes. */
export function bounds(rs: Rect[]): Rect {
  // Nothing picked: an empty box, not Infinity (Math.min of nothing).
  if (!rs.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
}
