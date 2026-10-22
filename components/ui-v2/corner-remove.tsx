'use client';

import { CloseIcon } from '@/components/ui-v2/icons';

import { TooltipLabel } from './tooltip';

/**
 * v2 corner remove: a small round × pinned to the top right of a tile
 * (a colour in a palette, a photo in the brand kit), for taking one item
 * out of a set. Hidden until the tile is hovered or the × is focused, so
 * a grid of tiles stays calm; always shown on touch screens, which have
 * no hover. Put it inside a `group relative` tile. Named by a Tooltip,
 * never a native `title`.
 *
 * @example
 * <li className="group relative">
 *   <ColorField bare label="Sage" value={hex} onChange={setHex} />
 *   <CornerRemove label="Remove Sage" onClick={remove} />
 * </li>
 *
 * @module components/ui-v2/corner-remove
 */

export interface CornerRemoveProps {
  /** What it removes, for screen readers: "Remove Sage". */
  label: string;
  onClick: () => void;
}

/** v2 corner remove. See {@link CornerRemoveProps}. */
export function CornerRemove({ label, onClick }: CornerRemoveProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="group/tip-in absolute -right-1.5 -top-1.5 z-10 flex size-5 items-center justify-center rounded-pill bg-field text-zebra-600 opacity-0 shadow-sm ring-1 ring-hairline transition-[opacity,color] duration-150 hover:text-zebra-950 focus-key:opacity-100 focus-mark group-hover:opacity-100 pointer-coarse:opacity-100 motion-reduce:transition-none"
    >
      <CloseIcon aria-hidden="true" className="size-3" />
      <TooltipLabel label={label} />
    </button>
  );
}
