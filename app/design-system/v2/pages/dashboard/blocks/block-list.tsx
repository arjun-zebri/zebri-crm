'use client';

import { useAutoAnimate } from '@formkit/auto-animate/react';

import { BlockRow } from './block-row';
import type { Block } from './catalog';
import type { BlocksState } from './use-blocks';

/**
 * One group of block rows. Rows that arrive or leave (switching role
 * brings in BDM lodgement; search filters as you type) fade and scale in
 * or out while the rest glide to their new places, instead of the list
 * snapping. auto-animate honours reduced motion on its own.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/block-list
 */

export interface BlockListProps {
  items: Block[];
  blocks: BlocksState;
  onOpen: (block: Block) => void;
}

/** A group's rows. See {@link BlockListProps}. */
export function BlockList({ items, blocks, onOpen }: BlockListProps) {
  // The same ease-out the rest of the dialog settles on.
  const [ref] = useAutoAnimate<HTMLUListElement>({ duration: 280, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
  return (
    <ul ref={ref}>
      {items.map((b) => (
        <BlockRow key={b.id} block={b} blocks={blocks} onOpen={() => onOpen(b)} onLocked={() => onOpen(b)} />
      ))}
    </ul>
  );
}
