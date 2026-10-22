import { useState, type Ref } from 'react';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { ArrowLeftIcon } from '@/components/ui-v2/icons';
import { Swap } from '@/components/ui-v2/swap';

import type { SettingsTab } from '../settings/settings-store';

import { BlockDetailFooter } from './block-detail-footer';
import { BlockMark } from './block-mark';
import type { Block } from './catalog';
import { ConnectsTo } from './connects-to';
import { BlockImage } from './images/block-image';
import type { BlocksState } from './use-blocks';
import { WorksWith } from './works-with';

/**
 * One block up close, filling the content pane: a breadcrumb header
 * (back, the view it came from, the block), then the mark, name and a
 * meta line, the description with what it works with and the services
 * it connects to right under it, the block's product image
 * (`images/block-image.tsx`), and what you get as a plain list ticked
 * with `DrawnCheck`s. The footer (`block-detail-footer.tsx`) holds the actions.
 *
 * Header, body and footer share one left edge, and the back chevron is
 * pulled onto it, so the content lines up with the back button.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/block-detail
 */

export interface BlockDetailProps {
  block: Block;
  blocks: BlocksState;
  /** The view the MC came from, for the breadcrumb ("All", "Plan"). */
  crumb: string;
  onBack: () => void;
  /** Opens another block (from Works with). */
  onOpenBlock: (block: Block) => void;
  /** "Open <block>": leaves Blocks. */
  onLaunch: () => void;
  /** Leaves Blocks for the Settings tab a just-added block is set up on. */
  onSetUp: (tab: SettingsTab) => void;
  /** Focus target on mount, so the reader starts at the top. */
  bodyRef?: Ref<HTMLDivElement>;
}

/** Category and plan, e.g. "Win clients · Included in Pro". */
function meta(block: Block, locked: boolean) {
  const plan =
    block.tier === 'max' ? (locked ? 'Part of Max' : 'Included in Max') : 'Included in Pro';
  return [block.category, plan].join(' · ');
}

/** The detail view. See {@link BlockDetailProps}. */
export function BlockDetail({
  block,
  blocks,
  crumb,
  onBack,
  onOpenBlock,
  onLaunch,
  onSetUp,
  bodyRef,
}: BlockDetailProps) {
  const locked = blocks.locked(block);
  // Upgrading here swaps the price for a welcome in the same footer spot.
  const [offered] = useState(locked);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Right padding clears the dialog's close button over this corner. */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-hairline px-6 pr-14">
        {/* Pulled left so the chevron itself, not its 32px hit box, sits on
            the content's left edge below. */}
        <Button variant="ghost" square aria-label="Back" onClick={onBack} className="-ml-3">
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
        </Button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 type-body">
          <button
            type="button"
            onClick={onBack}
            className="rounded-check text-zebra-500 transition-colors duration-150 hover:text-zebra-950 focus-mark motion-reduce:transition-none"
          >
            {crumb}
          </button>
          <span aria-hidden="true" className="text-zebra-300">
            /
          </span>
          <span aria-current="page" className="truncate type-label text-zebra-950">
            {block.name}
          </span>
        </nav>
      </header>

      <div
        ref={bodyRef}
        tabIndex={-1}
        className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 outline-none"
      >
        <div className="flex items-center gap-4">
          <BlockMark block={block} size="lg" />
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 type-title text-zebra-950">
              {block.name}
              <Swap active={locked ? 'max' : 'none'} states={{ max: <Badge>Max</Badge>, none: null }} />
            </h3>
            <p className="type-body text-zebra-400">{meta(block, locked)}</p>
          </div>
        </div>

        <p className="max-w-xl type-lead text-zebra-700">{block.about}</p>
        <WorksWith block={block} blocks={blocks} onOpen={onOpenBlock} />
        <ConnectsTo block={block} />

        <BlockImage block={block} />

        {/* A plain ticked list, as on the onboarding plan cards: no rules between. */}
        <ul className="space-y-2">
          {block.bullets.map((b) => (
            <li key={b} className="flex items-center gap-3 type-body text-zebra-700">
              <DrawnCheck className="size-4 text-selected" />
              {b}
            </li>
          ))}
        </ul>
      </div>

      <BlockDetailFooter
        block={block}
        blocks={blocks}
        upgradedHere={offered && !locked}
        onOpen={onLaunch}
        onSetUp={onSetUp}
      />
    </div>
  );
}
