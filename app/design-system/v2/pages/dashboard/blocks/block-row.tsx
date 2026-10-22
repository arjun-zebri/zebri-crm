import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { Swap } from '@/components/ui-v2/swap';

import { BlockMark } from './block-mark';
import type { Block } from './catalog';
import type { BlocksState } from './use-blocks';

/**
 * One block in the list (founder's mockup, 2026-10-09): its white mark
 * tile, a name with a `Max` badge only when locked, one line of pitch,
 * the whole row opening the block's page, and on the right where it
 * stands: Add as the quiet secondary button, Added in the selected grass
 * with a tick, or Coming soon. Added, Max and Coming soon are `Badge`s,
 * the one look they have everywhere in Blocks. A Max block on a Pro plan
 * opens its page from Add, where the upgrade is explained.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/block-row
 */

/**
 * The row's right side, in a fixed 112px slot so the pitch beside it
 * never rewraps as the block changes state. Each state hands over to the
 * next in place (Swap), the tick drawing itself on Added.
 */
function BlockState({ block, blocks, onOpen }: { block: Block; blocks: BlocksState; onOpen: () => void }) {
  const state = block.soon ? 'soon' : blocks.added.has(block.id) ? 'added' : 'none';
  return (
    // Above the row's stretched open button, so Add is its own target.
    <span className="relative z-10 flex w-28 shrink-0 justify-end">
      <Swap
        active={state}
        className="justify-items-end"
        states={{
          soon: <Badge size="control">Coming soon</Badge>,
          added: (
            <Badge size="control" tone="grass">
              <DrawnCheck className="size-3.5" />
              Added
            </Badge>
          ),
          none: (
            <Button variant="secondary" aria-label={`Add ${block.name}`} onClick={() => (blocks.locked(block) ? onOpen() : blocks.add(block))}>
              Add
            </Button>
          ),
        }}
      />
    </span>
  );
}

export interface BlockRowProps {
  block: Block;
  blocks: BlocksState;
  /** Opens the block's page. */
  onOpen: () => void;
}

/** A block row. See {@link BlockRowProps}. */
export function BlockRow({ block, blocks, onOpen }: BlockRowProps) {
  return (
    <li className="group relative flex items-center gap-4 py-3">
      <BlockMark block={block} />
      <div className="min-w-0 flex-1">
        <h4 className="flex items-center gap-2 type-body text-zebra-950">
          {/* Stretched over the row, so a click anywhere opens the detail; the focus mark is drawn on the stretched area, as StretchedButton draws it. */}
          <button
            type="button"
            data-open={block.id}
            onClick={onOpen}
            className="truncate text-left underline-offset-2 group-hover:underline after:absolute after:-inset-1 after:rounded-panel focus-visible:outline-none focus-key:after:outline-2 focus-key:after:outline-offset-2 focus-key:after:outline-grass-500"
          >
            {block.name}
          </button>
          {/* Only the exception is marked: blocks in the MC's plan carry no tier. */}
          <Swap active={blocks.locked(block) ? 'max' : 'none'} states={{ max: <Badge>Max</Badge>, none: null }} />
        </h4>
        <p className="line-clamp-2 type-body text-zebra-500 sm:truncate">{block.pitch}</p>
      </div>
      <BlockState block={block} blocks={blocks} onOpen={onOpen} />
    </li>
  );
}
