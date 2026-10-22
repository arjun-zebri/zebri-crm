'use client';

import { useState, type PointerEvent } from 'react';

/**
 * The day's scale and a block's look and handles: how many pixels a
 * minute is, a block's colour and tint, and the pull of a block's
 * top or bottom edge (`useEdgePull`), kept apart from the block so each
 * file reads on its own.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-edges
 */

/** Pixels per minute down the day: a 10 minute moment is one line high. */
export const PX = 2.4;

/** Minutes a drag of `y` pixels moves a moment, in steps of five. */
export const draggedBy = (y: number) => Math.round(y / PX / 5) * 5;

/** A block's colour before the MC picks one: a quiet grey (zebra-300). */
export const BLOCK_DEFAULT = '#cbcbc5';

/** The picker's quick picks: grey, then the soft greens, blues, golds, pinks and lilacs of a wedding night. */
export const BLOCK_SWATCHES = [
  '#cbcbc5',
  '#a3d97a',
  '#92cdf7',
  '#e0c68a',
  '#f2a7b8',
  '#c3b1ec',
] as const;

/**
 * A block's fill: its colour (set as `--block` on the element) mixed
 * just under half into the page white, a step stronger on hover, so any colour
 * the MC picks reads as a soft tint with dark text on it.
 */
export const BLOCK_TINT =
  'bg-[color-mix(in_oklab,var(--block)_45%,var(--color-field))] group-hover/block:bg-[color-mix(in_oklab,var(--block)_60%,var(--color-field))]';

/** A block's edge being pulled. */
export type Edge = 'top' | 'bottom';

/**
 * Pulling a block's edges. While a pull is on, `shift` is how far the
 * start has moved (the top edge) and `minutes` the length it would have,
 * so the block can draw itself live; on release `onResize` gets the
 * change (top: minutes the start moved, its end staying put; bottom:
 * minutes added to its length). Never shorter than five minutes.
 */
export function useEdgePull(length: number, onResize: (edge: Edge, by: number) => void) {
  const [pull, setPull] = useState<{ edge: Edge; from: number; y: number } | null>(null);
  const by = pull ? draggedBy(pull.y) : 0;
  const shift = pull?.edge === 'top' ? Math.min(by, length - 5) : 0;
  const minutes = pull?.edge === 'bottom' ? Math.max(5, length + by) : length - shift;
  const grab = (edge: Edge) => ({
    onPointerDown: (e: PointerEvent<HTMLSpanElement>) => {
      // The edge's own pull, not a move of the whole block.
      e.stopPropagation();
      // Keeps the moves coming when the pointer runs off the small dot.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // No live pointer to capture (a synthetic event): the pull still works over the dot.
      }
      setPull({ edge, from: e.clientY, y: 0 });
    },
    onPointerMove: (e: PointerEvent<HTMLSpanElement>) => {
      if (pull) setPull({ ...pull, y: e.clientY - pull.from });
    },
    onPointerUp: () => {
      const change = pull?.edge === 'top' ? shift : minutes - length;
      if (pull && change) onResize(pull.edge, change);
      setPull(null);
    },
  });
  return { pulling: pull?.edge ?? null, shift, minutes, grab };
}
