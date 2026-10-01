import { Check, ChevronLeft } from 'lucide-react';
import { useState, type Ref } from 'react';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';

import { BlockDetailFooter } from './block-detail-footer';
import { BlockMark } from './block-mark';
import type { Block } from './catalog';
import type { BlocksState } from './use-blocks';
import { WorksWith } from './works-with';

/**
 * One block up close, filling the content pane: a breadcrumb header
 * (back, the view it came from, the block), then the mark, name and a
 * meta line, the description with what it works with right under it, a
 * media placeholder (a product animation will go here), and what you
 * get as a plain ticked list. The footer (`block-detail-footer.tsx`) holds the actions.
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
  /** Focus target on mount, so the reader starts at the top. */
  bodyRef?: Ref<HTMLDivElement>;
}

/** Category, plan and audience, e.g. "Sell · Included in Pro · For everyone". */
function meta(block: Block, locked: boolean) {
  const plan = block.tier === 'max' ? (locked ? 'Part of Max' : 'Included in Max') : 'Included in Pro';
  const who = block.for ? `For ${block.for.map((r) => `${r.toLowerCase()}s`).join(' and ')}` : 'For everyone';
  return [block.category, plan, who].join(' · ');
}

/** The detail view. See {@link BlockDetailProps}. */
export function BlockDetail({ block, blocks, crumb, onBack, onOpenBlock, onLaunch, bodyRef }: BlockDetailProps) {
  const locked = blocks.locked(block);
  // Upgrading here swaps the price for a welcome in the same footer spot.
  const [offered] = useState(locked);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Right padding clears the dialog's close button over this corner. */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zebra-950/5 px-6 pr-14">
        {/* Pulled left so the chevron itself, not its 32px hit box, sits on
            the content's left edge below. */}
        <Button variant="ghost" square aria-label="Back" onClick={onBack} className="-ml-3">
          <ChevronLeft aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 type-body">
          <button type="button" onClick={onBack} className="rounded-check text-zebra-500 hover:text-zebra-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500">
            {crumb}
          </button>
          <span aria-hidden="true" className="text-zebra-300">/</span>
          <span aria-current="page" className="truncate type-label text-zebra-950">{block.name}</span>
        </nav>
      </header>

      <div ref={bodyRef} tabIndex={-1} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 outline-none">
        <div className="flex items-center gap-4">
          <BlockMark block={block} size="lg" />
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 type-title text-zebra-950">
              {block.name}
              {locked ? <Badge>Max</Badge> : null}
            </h3>
            <p className="type-body text-zebra-400">{meta(block, locked)}</p>
          </div>
        </div>

        <p className="max-w-xl type-lead text-zebra-700">{block.about}</p>
        <WorksWith block={block} blocks={blocks} onOpen={onOpenBlock} />

        {/* Placeholder until each block has its product animation. */}
        <div className="flex aspect-video items-center justify-center rounded-panel bg-zebra-50 bg-[repeating-linear-gradient(135deg,var(--color-zebra-100)_0_10px,transparent_10px_20px)]">
          <span className="font-mono type-body text-zebra-400">product animation · {block.name.toLowerCase()}</span>
        </div>

        {/* A plain ticked list, as on the onboarding plan cards: no rules between. */}
        <ul className="space-y-2">
          {block.bullets.map((b) => (
            <li key={b} className="flex items-center gap-3 type-body text-zebra-700">
              <Check aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0 text-grass-700" />
              {b}
            </li>
          ))}
        </ul>
      </div>

      <BlockDetailFooter block={block} blocks={blocks} upgradedHere={offered && !locked} onOpen={onLaunch} />
    </div>
  );
}
