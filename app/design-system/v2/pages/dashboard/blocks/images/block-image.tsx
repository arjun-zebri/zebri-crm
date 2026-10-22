'use client';

import { useState, type ComponentType } from 'react';

import { Segmented } from '@/components/ui-v2/segmented';

import type { Block } from '../catalog';

import { BLOCK_IMAGES, isDrafts } from './registry';

/**
 * The product image on a block's detail view. Shows the block's image
 * from the registry; while `/new-block-image` has drafts out, shows the
 * picked draft with a switcher of draft letters above it; with nothing
 * registered yet, the striped placeholder.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/block-image
 */

/** A block's product image. */
export function BlockImage({ block }: { block: Block }) {
  const entry = BLOCK_IMAGES[block.id];
  if (!entry) return <Placeholder name={block.name} />;
  if (isDrafts(entry)) return <Drafts key={block.id} drafts={entry} />;
  const Scene = entry;
  return <Scene />;
}

/** Drafts in review, one at a time, switched by letter. */
function Drafts({ drafts }: { drafts: Readonly<Record<string, ComponentType>> }) {
  const letters = Object.keys(drafts);
  const [pick, setPick] = useState(letters[0] ?? '');
  const Scene = drafts[pick];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="type-label text-zebra-500">Draft</span>
        <Segmented label="Draft" options={letters} value={pick} onChange={setPick} />
      </div>
      {Scene ? <Scene /> : null}
    </div>
  );
}

/** Until a block has its image. */
function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex aspect-video items-center justify-center rounded-panel bg-zebra-50 bg-[repeating-linear-gradient(135deg,var(--color-zebra-100)_0_10px,transparent_10px_20px)]">
      <span className="type-body text-zebra-400">
        product image · {name.toLowerCase()}
      </span>
    </div>
  );
}
