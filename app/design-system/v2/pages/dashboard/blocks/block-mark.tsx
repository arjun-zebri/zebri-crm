import type { Block } from './catalog';

/**
 * A block's mark on a white tile. Zebri's own tools draw in zebra-700;
 * integrations in their brand's own colour, as on the onboarding Plug
 * in step. Roadmap blocks fade: shown, because what is coming is part
 * of the pitch.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/block-mark
 */

/** `sm` sits in a bundle chip, `md` heads a row, `lg` heads the detail view. */
export type BlockMarkSize = 'sm' | 'md' | 'lg';

const SIZES: Record<BlockMarkSize, { tile: string; icon: string }> = {
  sm: { tile: 'size-7 rounded-check', icon: 'size-4' },
  md: { tile: 'size-11 rounded-button', icon: 'size-5' },
  lg: { tile: 'size-14 rounded-button', icon: 'size-7' },
};

/**
 * A mark tile. See {@link BlockMarkSize}. `bare` drops the tile and draws
 * the 14px glyph alone, for inside a soft chip where a bordered tile
 * would be a box in a box.
 */
export function BlockMark({ block, size = 'md', bare = false }: { block: Block; size?: BlockMarkSize; bare?: boolean }) {
  const s = SIZES[size];
  const Icon = block.icon;
  const brand = block.kind === 'integration' ? block.color : undefined;
  if (bare)
    return block.kind === 'tool' ? (
      <block.icon aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0 text-zebra-500" />
    ) : (
      <Icon aria-hidden {...(brand ? { color: brand } : {})} className={`size-3.5 shrink-0 ${brand ? '' : 'text-zebra-500'}`} />
    );
  return (
    <span className={`flex ${s.tile} shrink-0 items-center justify-center border border-zebra-200 bg-field${block.soon ? ' opacity-50' : ''}`}>
      {block.kind === 'tool' ? (
        <block.icon aria-hidden="true" strokeWidth={1.5} className={`${s.icon} text-zebra-700`} />
      ) : (
        // Brand colours are the brands' own, so they are the icon's
        // `color` prop rather than mapped to our tokens.
        <Icon aria-hidden {...(brand ? { color: brand } : {})} className={`${s.icon} ${brand ? '' : 'text-zebra-600'}`} />
      )}
    </span>
  );
}
