import { Badge } from '@/components/ui-v2/badge';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { Swap } from '@/components/ui-v2/swap';

import { BlockMark } from './block-mark';
import { blockById, type Block } from './catalog';
import type { BlocksState } from './use-blocks';

/**
 * "Works with", under a block's description: one chip per related block
 * with its mark, name, whether it is Required or Recommended, and its
 * state (Added, Coming soon or Max). The name opens that block's page, which is
 * where it is added: blocks are only added from their own page, after
 * reading what they do.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/works-with
 */

export interface WorksWithProps {
  block: Block;
  blocks: BlocksState;
  onOpen: (block: Block) => void;
}

/** The Works with chips. See {@link WorksWithProps}. */
export function WorksWith({ block, blocks, onOpen }: WorksWithProps) {
  const links = block.worksWith.flatMap((w) => {
    const other = blockById(w.id);
    return other ? [{ other, required: w.required === true }] : [];
  });
  if (links.length === 0) return null;
  return (
    <section aria-labelledby="works-with" className="space-y-2">
      <GroupLabel as="h4" id="works-with">
        Works with
      </GroupLabel>
      <ul className="flex flex-wrap gap-2">
        {links.map(({ other, required }) => (
          // Same soft 6px chip as the recommendation's.
          <li
            key={other.id}
            className="flex h-8 items-center gap-1.5 rounded-button bg-zebra-100 px-3"
          >
            <BlockMark block={other} bare />
            <button
              type="button"
              onClick={() => onOpen(other)}
              className="ml-0.5 rounded-check type-label text-zebra-950 underline-offset-2 hover:underline focus-mark"
            >
              {other.name}
            </button>
            <span className="type-body text-zebra-400">
              {required ? 'Required' : 'Recommended'}
            </span>
            <State other={other} blocks={blocks} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Added, Coming soon or Max as the same badges the rows use; nothing for one not added yet. Swaps in place. */
function State({ other, blocks }: { other: Block; blocks: BlocksState }) {
  const state = blocks.added.has(other.id)
    ? 'added'
    : other.soon
      ? 'soon'
      : blocks.locked(other)
        ? 'max'
        : 'none';
  return (
    <Swap
      active={state}
      className="ml-1.5 items-center"
      states={{
        added: (
          <Badge tone="grass">
            <DrawnCheck className="size-3.5" />
            Added
          </Badge>
        ),
        soon: <Badge>Coming soon</Badge>,
        max: <Badge>Max</Badge>,
        none: null,
      }}
    />
  );
}
