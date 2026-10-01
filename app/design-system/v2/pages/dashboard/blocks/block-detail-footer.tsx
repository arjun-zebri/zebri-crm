import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { Swap } from '@/components/ui-v2/swap';
import { Switch } from '@/components/ui-v2/switch';

import { MAX_PLAN, type Block } from './catalog';
import type { BlocksState } from './use-blocks';

/**
 * The detail view's fixed footer: what you can do with this block now.
 * Left, its standing (the Show in sidebar switch once a tool is added,
 * the Max price while locked); right, the one next step as the primary
 * button (Add, Connect, Upgrade to Max, Open) with Remove or Disconnect
 * beside it as a quiet ghost. Both sides hand over in place, so the bar
 * never changes size (clearing it for a pause first was rejected: it
 * collapsed the bar).
 *
 * @module app/design-system/v2/pages/dashboard/blocks/block-detail-footer
 */

export interface BlockDetailFooterProps {
  block: Block;
  blocks: BlocksState;
  /** The MC upgraded from this view: say so where the price was. */
  upgradedHere: boolean;
  /** "Open Proposals": leaves Blocks for the tool (the demo just closes). */
  onOpen: () => void;
}

type FooterState = 'soon' | 'locked' | 'add' | 'tool' | 'integration';

/** The detail footer. See {@link BlockDetailFooterProps}. */
export function BlockDetailFooter({ block, blocks, upgradedHere, onOpen }: BlockDetailFooterProps) {
  const tool = block.kind === 'tool';
  const state: FooterState = block.soon
    ? 'soon'
    : blocks.locked(block)
      ? 'locked'
      : !blocks.added.has(block.id)
        ? 'add'
        : tool
          ? 'tool'
          : 'integration';
  const left: Record<FooterState, ReactNode> = {
    soon: <span className="type-body text-zebra-500">On the roadmap. We&rsquo;ll let you know when it lands.</span>,
    locked: <span className="type-body text-zebra-500">Part of Max, ${MAX_PLAN.price} a month</span>,
    add: upgradedHere ? <span className="type-body text-grass-800">Welcome to Max. It&rsquo;s yours to add.</span> : null,
    tool: (
      <label className="flex items-center gap-3 type-body text-zebra-700">
        <Switch checked={!blocks.hidden.has(block.id)} onChange={(on) => blocks.setShown(block, on)} aria-label="Show in sidebar" />
        Show in sidebar
      </label>
    ),
    integration: (
      <span className="flex items-center gap-2 type-body text-grass-800">
        <DrawnCheck className="size-4" />
        Connected
      </span>
    ),
  };
  const right: Record<FooterState, ReactNode> = {
    soon: <Badge size="control">Coming soon</Badge>,
    locked: (
      <Button loading={blocks.busy === 'upgrade'} onClick={blocks.upgrade}>
        Upgrade to Max
      </Button>
    ),
    add: (
      <Button loading={blocks.busy === block.id} onClick={() => blocks.add(block)}>
        {tool ? 'Add' : 'Connect'} {block.name}
      </Button>
    ),
    tool: (
      <span className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => blocks.remove(block)}>Remove</Button>
        <Button onClick={onOpen}>
          Open {block.name}
          <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
      </span>
    ),
    integration: <Button variant="ghost" onClick={() => blocks.remove(block)}>Disconnect</Button>,
  };
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-zebra-950/5 px-6 py-3">
      {/* Both sides hand over in place as the block changes state. */}
      <Swap active={state} states={left} className="min-w-0 items-center" />
      <Swap active={state} states={right} className="justify-items-end" />
    </footer>
  );
}
