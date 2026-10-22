import type { Unplaced } from './presets';

/**
 * The element being dragged from the rail onto a page. Drag and drop
 * carries only strings, and an element is built fresh (a new id) for each
 * drag, so the rail leaves it here on drag start and the page takes it on
 * drop; the drag itself carries only a marker type.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/rail/drag
 */

let dragged: Unplaced | null = null;

/** Leaves `el` for the page to take (null when the drag ends). */
export const setDragged = (el: Unplaced | null) => {
  dragged = el;
};

/** Takes what is being dragged, once. */
export function takeDragged(): Unplaced | null {
  const el = dragged;
  dragged = null;
  return el;
}
