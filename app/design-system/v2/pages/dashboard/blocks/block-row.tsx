import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { Swap } from '@/components/ui-v2/swap';

import { BlockMark } from './block-mark';
import type { Block } from './catalog';
import type { BlocksState } from './use-blocks';

/**
 * One block in the list, and the action it shares with the detail view.
 * The row opens the detail (a stretched button on the name) while its
 * action adds in place. Kept to a mark, a name and one line of pitch:
 * anything more belongs in the detail view.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/block-row
 */

export interface BlockActionProps {
  block: Block;
  blocks: BlocksState;
  /** Where Upgrade leads: the detail view, which explains Max. */
  onLocked: () => void;
}

/**
 * Add is the quiet white button (a list of them should not shout);
 * Upgrade is the one primary, because it is the only one that costs.
 * A fixed-width slot, right-aligned, that every state fills (Add, Added,
 * Upgrade, Coming soon), so the text beside it never rewraps as the
 * block changes state. Connecting keeps the Connect label and adds the
 * spinner, so the button keeps its size.
 */
export function BlockAction({ block, blocks, onLocked }: BlockActionProps) {
  const tool = block.kind === 'tool';
  const state = block.soon ? 'soon' : blocks.added.has(block.id) ? 'added' : blocks.locked(block) ? 'locked' : 'add';
  return (
    <span className="flex w-28 shrink-0 justify-end">
      {/* Each state hands over to the next in place (Swap), the tick drawing itself on Added. */}
      <Swap
        active={state}
        className="justify-items-end"
        states={{
          soon: <Badge size="control">Coming soon</Badge>,
          added: (
            <Badge size="control" tone="brand">
              <DrawnCheck className="size-3.5" />
              {tool ? 'Added' : 'Connected'}
            </Badge>
          ),
          locked: <Button onClick={onLocked}>Upgrade</Button>,
          add: (
            <Button
              variant="secondary"
              loading={blocks.busy === block.id}
              onClick={() => blocks.add(block)}
              aria-label={`${tool ? 'Add' : 'Connect'} ${block.name}`}
            >
              {tool ? 'Add' : 'Connect'}
            </Button>
          ),
        }}
      />
    </span>
  );
}

export interface BlockRowProps extends BlockActionProps {
  onOpen: () => void;
}

/** A block row. See {@link BlockRowProps}. */
export function BlockRow({ block, blocks, onOpen, onLocked }: BlockRowProps) {
  return (
    <li className="group relative flex items-center gap-4 py-2.5">
      <BlockMark block={block} />
      <div className="min-w-0 flex-1">
        <h4 className="flex items-center gap-2 type-label text-zebra-950">
          {/* Stretched over the row, so a click anywhere opens the detail. */}
          <button
            type="button"
            data-open={block.id}
            onClick={onOpen}
            className="truncate text-left underline-offset-2 group-hover:underline after:absolute after:-inset-1 after:rounded-panel focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-grass-500"
          >
            {block.name}
          </button>
          {/* Only the exception is marked: blocks in the MC's plan carry no tier. */}
          <Swap active={blocks.locked(block) ? 'max' : 'none'} states={{ max: <Badge>Max</Badge>, none: null }} />
        </h4>
        <p className="truncate type-body text-zebra-500">{block.pitch}</p>
      </div>
      {/* Above the stretched button, so it takes its own clicks. */}
      <div className="relative z-10">
        <BlockAction block={block} blocks={blocks} onLocked={onLocked} />
      </div>
    </li>
  );
}
