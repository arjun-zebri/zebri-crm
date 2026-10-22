'use client';

import type { DragEvent, ReactNode } from 'react';

import { DISABLED, HOVER_ON_WHITE } from './control-styles';
import { TooltipLabel } from './tooltip';

/**
 * v2 add tile: a tile in an editor's tool panel that adds what it shows,
 * as Canva's Elements and Text panels work: a click drops it in the
 * middle of the page in view, a drag places it where it is let go. The
 * preview is the thing itself (a shape in the brand colour, a heading in
 * the heading face), so the tile needs no caption; `label` names it for
 * screen readers and in a Tooltip on hover or keyboard focus. Hover is
 * the house `hover` tint, nothing moves.
 *
 * @example
 * <AddTile label="Add a circle" onAdd={add} onDragStart={drag}>
 *   <span className="size-12 rounded-pill bg-grass-700" />
 * </AddTile>
 *
 * @module components/ui-v2/add-tile
 */

export interface AddTileProps {
  label: string;
  onAdd: () => void;
  /** Starts a drag onto a page: set what is dragged. */
  onDragStart?: ((e: DragEvent<HTMLButtonElement>) => void) | undefined;
  onDragEnd?: (() => void) | undefined;
  /** `square` for a grid of shapes and pictures, `row` for a full-width line (a text style). */
  shape?: 'square' | 'row' | undefined;
  /** Greys the tile out; it cannot be added or dragged. */
  disabled?: boolean | undefined;
  children: ReactNode;
}

/** v2 add tile. See {@link AddTileProps}. */
export function AddTile({ label, onAdd, onDragStart, onDragEnd, shape = 'square', disabled = false, children }: AddTileProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      draggable={!!onDragStart && !disabled}
      onClick={onAdd}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      // The clip is on the inner span, so the tooltip can hang outside the tile.
      className={`group/tip-in relative flex rounded-button bg-zebra-50 text-left transition-colors duration-150 ${HOVER_ON_WHITE} focus-mark ${DISABLED} motion-reduce:transition-none ${
        shape === 'square' ? 'aspect-square' : 'w-full'
      }`}
    >
      <span className={`flex min-w-0 flex-1 items-center overflow-hidden rounded-button ${shape === 'square' ? 'justify-center' : 'px-3 py-3'}`}>
        {children}
      </span>
      <TooltipLabel label={label} />
    </button>
  );
}
