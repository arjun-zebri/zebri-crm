import type { Block } from './catalog';

/**
 * A block's mark on a white tile with a hairline edge, drawn in zebra-700. Roadmap blocks
 * fade: shown, because what is coming is part of the pitch.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/block-mark
 */

/** `sm` sits in a bundle chip, `md` heads a row, `lg` heads the detail view. */
export type BlockMarkSize = 'sm' | 'md' | 'lg';

const SIZES: Record<BlockMarkSize, { tile: string; icon: string }> = {
  sm: { tile: 'size-7 rounded-check', icon: 'size-4' },
  // A tile like IconCircle's large one, so the glyph takes its size-5 (the one place it is allowed).
  md: { tile: 'size-11 rounded-button', icon: 'size-5' },
  lg: { tile: 'size-14 rounded-button', icon: 'size-5' },
};

/**
 * A mark tile. See {@link BlockMarkSize}. `bare` drops the tile and draws
 * the 14px glyph alone, for inside a soft chip where a bordered tile
 * would be a box in a box.
 */
export function BlockMark({
  block,
  size = 'md',
  bare = false,
}: {
  block: Block;
  size?: BlockMarkSize;
  bare?: boolean;
}) {
  const s = SIZES[size];
  const Icon = block.icon;
  if (bare)
    return (
      <Icon aria-hidden="true" className="size-3.5 shrink-0 text-zebra-500" />
    );
  return (
    <span
      className={`flex ${s.tile} shrink-0 items-center justify-center border border-hairline bg-field${block.soon ? ' opacity-50' : ''}`}
    >
      <Icon aria-hidden="true" className={`${s.icon} text-zebra-700`} />
    </span>
  );
}
