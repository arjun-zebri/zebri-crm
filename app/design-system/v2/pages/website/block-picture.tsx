'use client';

import { createElement } from 'react';

import { CheckIcon } from '@/components/ui-v2/icons';

import { AccountContext } from '../dashboard/account';
import { BlockMark } from '../dashboard/blocks/block-mark';
import { blockById } from '../dashboard/blocks/catalog';
import { BLOCK_IMAGES, isDrafts } from '../dashboard/blocks/images/registry';

import { SITE_ACCOUNT } from './site-account';

/**
 * A block's picture on the marketing site: its real product image, the
 * one the in-app Blocks catalogue shows (the first draft while one is
 * still being chosen). A block with no image yet gets its mark and
 * catalogue bullets on a quiet 16:9 card instead, the same shape, so a
 * row of pictures never has a hole in it. Make the real one with
 * `/new-block-image <id>`. A picture: inert and hidden from screen readers.
 * The images read the account for the MC's name, so they get the site's
 * sample one (`site-account.ts`), never the founder's.
 * A client module: the images are client components (some read React
 * context), and the cards and pages around it are server components.
 *
 * @module app/design-system/v2/pages/website/block-picture
 */

/**
 * A block's picture, by id: server cards hand over the id, not the block,
 * whose icon is a function and cannot cross into a client component.
 */
export function BlockPicture({ id }: { id: string }) {
  const block = blockById(id);
  if (!block) return null;
  const entry = BLOCK_IMAGES[block.id];
  const Scene = entry && (isDrafts(entry) ? Object.values(entry)[0] : entry);
  return (
    <div aria-hidden="true" inert>
      {Scene ? (
        <AccountContext.Provider value={SITE_ACCOUNT}>{createElement(Scene)}</AccountContext.Provider>
      ) : (
        <div className="flex aspect-video flex-col justify-center gap-3 rounded-panel bg-zebra-50 px-6">
          <BlockMark block={block} />
          <ul className="space-y-1.5">
            {block.bullets.slice(0, 3).map((b) => (
              <li key={b} className="flex items-center gap-2 type-body text-zebra-600">
                <CheckIcon aria-hidden="true" className="size-3.5 shrink-0 text-grass-700" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
