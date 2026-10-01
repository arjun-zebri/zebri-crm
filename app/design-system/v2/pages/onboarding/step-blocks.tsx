'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { Swap } from '@/components/ui-v2/swap';

import { BUNDLES } from '../dashboard/blocks/bundles';
import { CATALOG, ROLES, type Block, type Role, type ToolBlock } from '../dashboard/blocks/catalog';
import { FeaturedBundle } from '../dashboard/blocks/featured-bundle';
import { useBlocks, type BlocksState } from '../dashboard/blocks/use-blocks';

/**
 * The "Zebri tools" half of step 2, Build your Zebri: the same recommendation the Blocks dialog
 * leads with (one click adds what MCs, Celebrants or DJs start with),
 * then every other Zebri tool in two columns, each with Add. What is
 * added here is the sidebar the MC lands on after setup.
 *
 * Only Zebri's own tools that can be added today are listed:
 * integrations are the step's other tab (Your apps), and roadmap blocks wait for
 * the Blocks dialog, so the step fits a laptop screen. The recommended
 * ones are left out of the list below them, never shown twice. Max
 * blocks carry a Max badge but are never locked, because the plan is
 * the next step; adding one preselects Max there.
 *
 * @module app/design-system/v2/pages/onboarding/step-blocks
 */

export interface StepBlocksProps {
  /** Added ids, as saved in the onboarding state. */
  value: string[];
  onChange: (ids: string[]) => void;
  /** Roles picked on step 1; the first one the recommendation knows leads. */
  roles: string[];
}

const TOOLS = CATALOG.filter((b): b is ToolBlock => b.kind === 'tool' && !b.soon);

/** The Blocks step. See {@link StepBlocksProps}. */
export function StepBlocks({ value, onChange, roles }: StepBlocksProps) {
  // Starts on Max so nothing reads as locked before a plan is picked.
  const blocks = useBlocks({ initial: value, plan: 'max', onChange });
  const [role, setRole] = useState<Role>(() => ROLES.find((r) => roles.includes(r)) ?? 'MC');
  const toggle = (b: Block) => (blocks.added.has(b.id) ? blocks.remove(b) : blocks.add(b));
  return (
    <div className="space-y-6">
      <FeaturedBundle role={role} onRole={setRole} blocks={blocks} onOpen={toggle} />
      <ul aria-label="More blocks" className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        {TOOLS.filter((b) => !BUNDLES[role].ids.includes(b.id) && (!b.for || b.for.includes(role))).map((b) => (
          <Row key={b.id} block={b} blocks={blocks} />
        ))}
      </ul>
    </div>
  );
}

function Row({ block, blocks }: { block: ToolBlock; blocks: BlocksState }) {
  const on = blocks.added.has(block.id);
  const Icon = block.icon;
  return (
    <li className="flex items-center gap-3 py-2">
      {/* A plain glyph, not a bordered tile: no box beside the button's box. */}
      <Icon aria-hidden="true" strokeWidth={1.5} className="size-5 shrink-0 self-start text-zebra-700 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 type-label text-zebra-950">
          <span className="truncate">{block.name}</span>
          {block.tier === 'max' ? <Badge>Max</Badge> : null}
        </p>
        <p className="line-clamp-2 type-body text-zebra-500">{block.pitch}</p>
      </div>
      {/* One fixed slot every state fills, so the text never rewraps. */}
      <span className="flex w-24 shrink-0 justify-end">
        <Swap
          active={on ? 'added' : 'add'}
          className="justify-items-end"
          states={{
            // Added is itself the way back out: a second click removes.
            added: (
              <Button
                variant="ghost"
                active
                aria-label={`Remove ${block.name}`}
                onClick={() => blocks.remove(block)}
              >
                <DrawnCheck className="size-3.5 text-grass-700" />
                Added
              </Button>
            ),
            add: (
              <Button variant="secondary" aria-label={`Add ${block.name}`} onClick={() => blocks.add(block)}>
                Add
              </Button>
            ),
          }}
        />
      </span>
    </li>
  );
}
