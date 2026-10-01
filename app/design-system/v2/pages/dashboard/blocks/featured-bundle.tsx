import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { Panel } from '@/components/ui-v2/panel';
import { Swap } from '@/components/ui-v2/swap';

import { BUNDLES } from './bundles';
import { ROLES, blockById, type Block, type Role } from './catalog';
import type { BlocksState } from './use-blocks';

/**
 * The recommendation at the top of All, on the highlight panel (white
 * with the grass-to-sky gradient hairline): an eyebrow "Recommended for
 * [MC]" whose role is an inline `Dropdown` (so the picker and the
 * recommendation are one thing), one line of why, then the blocks as
 * soft 6px tags (ticked once added) with the button that adds what is
 * still missing ("Add all 3", "Add the other 2") right after them,
 * fading away once everything is in (an "All added" badge was rejected). Add all lands the
 * blocks one at a time, so each tag ticks and each sidebar row arrives
 * in turn.
 *
 * The panel sits on the list's edges rather than bleeding past them.
 * Rejected: a title per role ("Run the day"), bordered chips holding
 * boxed icons, pill-shaped tags, and no container at all.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/featured-bundle
 */

export interface FeaturedBundleProps {
  role: Role;
  onRole: (role: Role) => void;
  blocks: BlocksState;
  onOpen: (block: Block) => void;
}

/** The recommendation. See {@link FeaturedBundleProps}. */
export function FeaturedBundle({ role, onRole, blocks, onOpen }: FeaturedBundleProps) {
  const bundle = BUNDLES[role];
  // Bundles are Zebri tools (they add to the sidebar), so each has a Lucide icon.
  const members = bundle.ids.flatMap((id) => {
    const b = blockById(id);
    return b?.kind === 'tool' ? [b] : [];
  });
  const missing = members.filter((b) => !blocks.added.has(b.id));
  const label =
    missing.length === members.length
      ? `Add all ${members.length}`
      : `Add the other ${missing.length}`;
  // The button fades away on the click itself, while the blocks are still
  // landing one by one (a spinner until the last one was rejected).
  const done = missing.length === 0 || blocks.busy === 'bundle';
  return (
    <Panel tone="highlight" as="section" aria-label="Recommended blocks" className="space-y-3 p-4">
      <div>
        <p className="-ml-1.5 flex items-center gap-0.5 type-label text-grass-800">
          <span className="pl-1.5">Recommended for</span>
          <Dropdown
            inline
            label="Recommended for"
            value={role}
            onChange={(v) => onRole(ROLES.find((r) => r === v) ?? role)}
            options={ROLES.map((r) => ({ value: r, label: r }))}
          />
        </p>
      </div>
      {/* Keyed by role, so switching roles eases the new set in rather
          than snapping (a 4px rise and fade). */}
      <div
        key={role}
        className="space-y-3 motion-safe:animate-[rise-in_320ms_cubic-bezier(0.2,0.7,0.2,1)_both]"
      >
        <p className="-mt-3 type-body text-zebra-500">{bundle.pitch}</p>
        {/* The blocks, then the one button that adds them, on one line. */}
        <ul className="flex flex-wrap items-center gap-2">
          {members.map((b) => {
            const Icon = b.icon;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onOpen(b)}
                  className="flex h-9 items-center gap-1.5 rounded-panel bg-zebra-100 px-3 type-label text-zebra-800 transition-colors duration-150 hover:bg-zebra-200 hover:text-zebra-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none"
                >
                  <Swap
                    active={blocks.added.has(b.id) ? 'added' : 'icon'}
                    states={{
                      added: <DrawnCheck className="size-3.5 text-grass-700" />,
                      icon: (
                        <Icon
                          aria-hidden="true"
                          strokeWidth={1.5}
                          className="size-3.5 text-zebra-500"
                        />
                      ),
                    }}
                  />
                  {blocks.added.has(b.id) ? <span className="sr-only">, added</span> : null}
                  {b.name}
                </button>
              </li>
            );
          })}
          <li>
            <Swap
              active={done ? 'done' : 'add'}
              states={{
                done: null,
                add: <Button onClick={() => blocks.addAll(missing)}>{label}</Button>,
              }}
            />
          </li>
        </ul>
      </div>
    </Panel>
  );
}
