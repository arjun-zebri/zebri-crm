import { BlockMark } from '../dashboard/blocks/block-mark';
import { blockById } from '../dashboard/blocks/catalog';

import { BlockPicture } from './block-picture';
import type { Outcome } from './blocks-outcomes';

/**
 * One outcome on the Blocks row: the block's real product image (the
 * one the in-app Blocks catalogue shows), then what the visitor gets and
 * how, with the block's mark and name underneath as the quiet source.
 * The image is proof; the words are the pitch.
 *
 * @module app/design-system/v2/pages/website/outcome-card
 */

/** An outcome card. */
export function OutcomeCard({
  outcome,
  className,
}: {
  outcome: Outcome;
  /** Extra classes on the card, e.g. hiding it on phones. */
  className?: string | undefined;
}) {
  const block = blockById(outcome.block);
  return (
    <li
      className={`flex flex-col overflow-hidden rounded-panel bg-field shadow-lg ring-1 ring-zebra-950/10${className ? ` ${className}` : ''}`}
    >
      <div className="p-2">{block ? <BlockPicture id={block.id} /> : null}</div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
        <h3 className="text-balance type-heading text-zebra-950">{outcome.title}</h3>
        <p className="mt-1.5 flex-1 text-pretty type-body text-zebra-500">{outcome.how}</p>
        {block ? (
          <p className="mt-5 flex items-center gap-2 border-t border-hairline pt-4 type-label text-zebra-600">
            <BlockMark block={block} size="sm" />
            {block.name}
          </p>
        ) : null}
      </div>
    </li>
  );
}
