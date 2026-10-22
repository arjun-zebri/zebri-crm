import { Badge } from '@/components/ui-v2/badge';
import { CheckIcon } from '@/components/ui-v2/icons';

import type { Block } from '../dashboard/blocks/catalog';

import { BlockPicture } from './block-picture';

/**
 * One block on the all-blocks page: its real product image, its name
 * (with Max on the blocks that need that plan, Coming soon on roadmap
 * ones), the outcome in a line, and the catalogue's bullets. The same
 * white card as the home page's outcome cards, so the two pages read
 * as one site.
 *
 * @module app/design-system/v2/pages/website/block-card
 */

/** A block card. */
export function BlockCard({ block }: { block: Block }) {
  return (
    <li className="flex flex-col overflow-hidden rounded-panel bg-field shadow-xl ring-1 ring-zebra-950/10">
      <div className="p-2">
        <BlockPicture id={block.id} />
      </div>
      <div className="flex flex-1 flex-col px-5 pb-6 pt-3">
        <h3 className="flex items-center gap-2 type-heading text-zebra-950">
          {block.name}
          {block.soon ? <Badge>Coming soon</Badge> : block.tier === 'max' ? <Badge>Max</Badge> : null}
        </h3>
        <p className="mt-1.5 text-pretty type-body text-zebra-600">{block.pitch}</p>
        <ul className="mt-4 space-y-1.5 border-t border-hairline pt-4">
          {block.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 type-body text-zebra-500">
              <CheckIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-grass-700" />
              {b}
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
