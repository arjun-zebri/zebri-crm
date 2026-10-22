'use client';

import { CATALOG } from './pages/dashboard/blocks/catalog';
import { BLOCK_IMAGES, isDrafts } from './pages/dashboard/blocks/images/registry';
import { Group, Spec } from './showroom-v2';

/**
 * v2 block images: every finished product image from the Blocks
 * catalogue, in catalogue order, as the detail view shows them. Drafts
 * still being chosen between stay in the Blocks dialog until picked.
 *
 * @module app/design-system/v2/components-block-images
 */
export function ComponentsBlockImagesV2() {
  const done = CATALOG.flatMap((block) => {
    const entry = BLOCK_IMAGES[block.id];
    return entry && !isDrafts(entry) ? [{ block, Scene: entry }] : [];
  });
  return (
    <Group id="block-images" title="Block images">
      <Spec
        name="Block image"
        file="app/design-system/v2/pages/dashboard/blocks/images/block-image-frame.tsx"
        description="One still per block on its detail view: the real v2 UI zoomed in like a Stripe product shot: real components at about real size, the surface where the block lives plus what is on it, cards bleeding off the foot, nearly flat. Laid out at 480 by 270 on a muted canvas and scaled as one picture, so it never reflows. Made one block at a time with /new-block-image."
      >
        {done.length === 0 ? (
          <p className="type-body text-zebra-500">No block images yet.</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            {done.map(({ block, Scene }) => (
              <figure key={block.id} className="space-y-2">
                <Scene />
                <figcaption className="type-label text-zebra-700">{block.name}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </Spec>
    </Group>
  );
}
