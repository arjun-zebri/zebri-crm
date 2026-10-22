'use client';

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { BlocksIcon } from '@/components/ui-v2/icons';
import { Swap } from '@/components/ui-v2/swap';

import { BlockMark } from '../blocks/block-mark';
import { blockById, type Role } from '../blocks/catalog';
import type { BlocksState } from '../blocks/use-blocks';

import { STARTING_BLOCKS } from './handoff';

// The first thing a new MC watches Zebri do, so it is paced to be seen:
// a beat after the click, then one block at a time, each Added badge and
// its drawn tick (about 550ms) finished before the next row starts.
const PACE = { lead: 250, gap: 650 };

// Done waits for the last row's Added badge and tick to finish (about
// 600ms) before it replaces Add all, so it follows the rows rather than
// arriving with the last one.
const DONE_AFTER_MS = 750;

/**
 * Build your Zebri, the first to-do on a new account's Home: the
 * recommended starting blocks, the three every booking runs on
 * (Proposals, Contracts, and Payments, where invoices live). The rest of
 * the catalogue waits in Blocks, named in the footnote.
 *
 * The rows have no Add buttons of their own: the test client's run goes
 * through all three, so the one action is Add all (then Done), and each
 * row ticks Added as its block lands. There is no Not now; closing the
 * dialog leaves the to-do.
 *
 * A celebrant is also pointed at Lodge with BDM, the one block made for
 * them. It is on Max and not part of the practice run, so it is named
 * under the three rather than added with them.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/build-your-zebri
 */

export interface BuildYourZebriProps {
  open: boolean;
  blocks: BlocksState;
  /** What the account does, from setup: a celebrant is pointed at Lodge with BDM. */
  role?: Role | undefined;
  /** Closed, to-do left as it is. */
  onClose: () => void;
  /** All three are in: the to-do is done. */
  onDone: () => void;
}

/** The dialog. See {@link BuildYourZebriProps}. */
export function BuildYourZebri({ open, blocks, role, onClose, onDone }: BuildYourZebriProps) {
  const bdm = role === 'Celebrant' ? blockById('bdm') : undefined;
  const members = STARTING_BLOCKS.flatMap((id) => {
    const b = blockById(id);
    return b ? [b] : [];
  });
  const missing = members.filter((b) => !blocks.added.has(b.id));
  const landing = blocks.busy === 'bundle';
  const allIn = missing.length === 0 && !landing;
  const [settled, setSettled] = useState(allIn);
  useEffect(() => {
    if (!allIn || settled) return;
    const t = window.setTimeout(() => setSettled(true), DONE_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [allIn, settled]);
  const ready = allIn && settled;
  return (
    <Dialog open={open} onClose={onClose} size="form" aria-labelledby="build-title">
      <DialogHeader id="build-title" icon={BlocksIcon} title="Recommended starting blocks" />
      <DialogBody>
        <div className="space-y-4">
          <p className="type-lead text-zebra-500">
            Win the client with a proposal, lock in the date with a contract, then get paid.
          </p>
          <ul>
            {members.map((b) => (
              <li key={b.id} className="flex items-center gap-4 py-2.5">
                <BlockMark block={b} />
                <div className="min-w-0 flex-1">
                  <p className="type-label text-zebra-950">{b.name}</p>
                  <p className="type-body text-zebra-500">{b.pitch}</p>
                </div>
                {/* A tick as each block lands; nothing before, since Add all is the only action. */}
                <Swap
                  active={blocks.added.has(b.id) ? 'added' : 'none'}
                  className="justify-items-end"
                  states={{
                    added: (
                      <Badge size="control" tone="brand">
                        <DrawnCheck className="size-3.5" />
                        Added
                      </Badge>
                    ),
                    none: null,
                  }}
                />
              </li>
            ))}
          </ul>
          {bdm && !blocks.added.has(bdm.id) ? (
            <div className="flex items-center gap-4 border-t border-hairline pt-4">
              <BlockMark block={bdm} />
              <div className="min-w-0 flex-1">
                <p className="type-label text-zebra-950">{bdm.name}, for celebrants</p>
                <p className="type-body text-zebra-500">Lodge every marriage with NSW BDM from Zebri. On Max: add it from Blocks when you are ready.</p>
              </div>
            </div>
          ) : null}
          <p className="type-body text-zebra-400">Everything else, and your apps, live in Blocks at the foot of the sidebar.</p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Swap
          active={ready ? 'done' : 'add'}
          className="justify-items-end"
          states={{
            add: (
              <Button loading={landing || allIn} onClick={() => blocks.addAll(missing, PACE)}>
                {/* The label holds while the blocks land, so it never counts down under the spinner. */}
                {landing || allIn || missing.length === members.length ? `Add all ${members.length}` : `Add the other ${missing.length}`}
              </Button>
            ),
            done: (
              <Button onClick={onDone} data-autofocus>
                Done
              </Button>
            ),
          }}
        />
      </DialogFooter>
    </Dialog>
  );
}
