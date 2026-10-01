import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { Swap } from '@/components/ui-v2/swap';

import { BlockMark } from './block-mark';
import { blockById, type Block } from './catalog';
import type { BlocksState } from './use-blocks';

/**
 * "Works with", under a block's description: one chip per related block
 * with its mark, name, whether it is Required or Recommended, and its
 * state (Added, or an Add / Connect button right there), so an MC can
 * add what a block needs without leaving it. The name opens that block.
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
      <h4 id="works-with" className="type-body text-zebra-400">Works with</h4>
      <ul className="flex flex-wrap gap-2">
        {links.map(({ other, required }) => (
          // Same soft 6px chip as the recommendation's, a step taller to hold a button.
          <li key={other.id} className="flex h-10 items-center gap-1.5 rounded-button bg-zebra-100 pl-3 pr-3">
            <BlockMark block={other} bare />
            <button
              type="button"
              onClick={() => onOpen(other)}
              className="ml-0.5 rounded-check type-label text-zebra-950 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500"
            >
              {other.name}
            </button>
            <span className="type-body text-zebra-400">{required ? 'Required' : 'Recommended'}</span>
            <State other={other} blocks={blocks} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Added, Soon or Max as quiet text; otherwise the button that adds it. Swaps in place. */
function State({ other, blocks }: { other: Block; blocks: BlocksState }) {
  const tool = other.kind === 'tool';
  const state = blocks.added.has(other.id) ? 'added' : other.soon ? 'soon' : blocks.locked(other) ? 'max' : 'add';
  return (
    <Swap
      active={state}
      className="ml-1.5 items-center"
      states={{
        added: (
          <span className="flex items-center gap-1 type-label text-grass-800">
            <DrawnCheck className="size-3.5" />
            {tool ? 'Added' : 'Connected'}
          </span>
        ),
        soon: <span className="type-body text-zebra-400">Soon</span>,
        max: <span className="type-body text-zebra-400">Max</span>,
        add: (
          // Pulled into the chip's right padding so it sits 4px in from the edge.
          <Button
            variant="secondary"
            className="-mr-2"
            loading={blocks.busy === other.id}
            onClick={() => blocks.add(other)}
            aria-label={`${tool ? 'Add' : 'Connect'} ${other.name}`}
          >
            {tool ? 'Add' : 'Connect'}
          </Button>
        ),
      }}
    />
  );
}
