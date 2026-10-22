import type { ReactNode } from 'react';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { ArrowRightIcon } from '@/components/ui-v2/icons';
import { Swap } from '@/components/ui-v2/swap';
import { Switch } from '@/components/ui-v2/switch';

import type { SettingsTab } from '../settings/settings-store';

import { MAX_PLAN, type Block } from './catalog';
import type { BlocksState } from './use-blocks';

/**
 * The detail view's fixed footer: what you can do with this block now.
 * Left, its standing (the Show in sidebar switch once a tool is added,
 * or where it lives for one with no page, on clients or top right, the Max price while locked); right, the one next step as the primary
 * button (Add, Upgrade to Max, Open) with Remove beside it as a quiet
 * ghost. Both sides hand over in place, so the bar
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
  /** "Open Proposals" (or Show me, for a block with no page): leaves Blocks for the tool. */
  onOpen: () => void;
  /** Leaves Blocks for the Settings tab a block is set up on, right after it is added. */
  onSetUp: (tab: SettingsTab) => void;
}

type FooterState = 'soon' | 'locked' | 'add' | 'added';

/** The detail footer. See {@link BlockDetailFooterProps}. */
export function BlockDetailFooter({ block, blocks, upgradedHere, onOpen, onSetUp }: BlockDetailFooterProps) {
  const state: FooterState = block.soon
    ? 'soon'
    : blocks.locked(block)
      ? 'locked'
      : blocks.added.has(block.id)
        ? 'added'
        : 'add';
  const left: Record<FooterState, ReactNode> = {
    soon: (
      <span className="type-body text-zebra-500">
        On the roadmap. We&rsquo;ll let you know when it lands.
      </span>
    ),
    locked: (
      <span className="type-body text-zebra-500">Part of Max, ${MAX_PLAN.price} a month</span>
    ),
    add: upgradedHere ? (
      <span className="type-body text-grass-800">Welcome to Max. It&rsquo;s yours to add.</span>
    ) : null,
    added: block.onClients || block.topRight ? (
      <span className="type-body text-zebra-500">{block.onClients ?? block.topRight}</span>
    ) : (
      <label className="flex items-center gap-3 type-body text-zebra-700">
        <Switch
          checked={!blocks.hidden.has(block.id)}
          onChange={(on) => blocks.setShown(block, on)}
          aria-label="Show in sidebar"
        />
        Show in sidebar
      </label>
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
      <Button
        onClick={() => {
          blocks.add(block);
          if (block.setup) onSetUp(block.setup);
        }}
      >
        Add {block.name}
      </Button>
    ),
    added: (
      <span className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => blocks.remove(block)}>
          Remove
        </Button>
        <Button onClick={onOpen}>
          {block.onClients ? 'Show me' : `Open ${block.name}`}
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Button>
      </span>
    ),
  };
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-hairline px-6 py-3">
      {/* Both sides hand over in place as the block changes state. */}
      <Swap active={state} states={left} className="min-w-0 items-center" />
      <Swap active={state} states={right} className="justify-items-end" />
    </footer>
  );
}
