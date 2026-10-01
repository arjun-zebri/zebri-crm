'use client';

import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { StretchedButton } from '@/components/ui-v2/stretched-button';

import { CoupleAvatars } from '../../payments/invoice-row';
import { coupleName } from '../../payments/payments-data';
import type { QueueItem } from '../queue-data';

import { QUEUE_GRID, QUEUE_ROW, UNDER } from './queue-row';

/**
 * Something Zebri will send by itself, or something already done. Quiet
 * on purpose: no buttons, because nothing here needs the MC (buttons are
 * for the MC's own to-dos). It carries the same why and when as the rows
 * above it, and the section heading already says Zebri sends it, so the
 * row does not repeat that. Clicking the row reads the message; the rarer
 * moves (send it now, which opens the message first, skip this one,
 * pause this client, open the workflow) live in a More menu. A done
 * row says what happened instead.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/needs-you/scheduled-row
 */

export type ScheduledMove = 'send' | 'skip' | 'pause' | 'read' | 'workflow';

const MOVES: { move: ScheduledMove; label: string }[] = [
  { move: 'send', label: 'Send it now' },
  { move: 'skip', label: 'Skip this one' },
  { move: 'pause', label: 'Pause for this client' },
  { move: 'workflow', label: 'Open the workflow' },
];

export interface ScheduledRowProps {
  item: QueueItem;
  workflow: string;
  onMove: (move: ScheduledMove) => void;
}

/** A scheduled or done row. See {@link ScheduledRowProps}. */
export function ScheduledRow({ item, workflow, onMove }: ScheduledRowProps) {
  const [menu, setMenu] = useState(false);
  const quiet = item.section === 'done' || Boolean(item.outcome);
  const who = coupleName(item.names);
  const title = (
    <>
      <span className={`block truncate type-label ${quiet ? 'text-zebra-500' : 'text-zebra-950'}`}>{item.label}</span>
      <span className="block truncate type-body text-zebra-600">
        {who} · {workflow}
      </span>
    </>
  );
  return (
    <li>
      <div className={`${QUEUE_ROW} ${quiet ? 'cursor-default' : ''} ${QUEUE_GRID}`}>
        <div className="flex min-w-0 items-center gap-3">
          <CoupleAvatars names={item.names} />
          {quiet ? (
            <div className="min-w-0">{title}</div>
          ) : (
            <StretchedButton label={`Read ${item.label} for ${who}`} onClick={() => onMove('read')}>
              {title}
            </StretchedButton>
          )}
        </div>
        <p className={`row-start-2 type-body ${UNDER} ${quiet ? 'text-zebra-600' : 'text-zebra-700'}`}>{item.outcome ?? item.why}</p>
        <span className={`row-start-3 type-body text-zebra-600 ${UNDER}`}>{item.when}</span>
        <div className="relative z-10 col-start-2 row-start-1 flex justify-end lg:col-start-4">
          {quiet ? null : (
            <Popover open={menu} onOpenChange={setMenu}>
              <PopoverTrigger asChild>
                <Button variant="ghost" square aria-label={`More for ${item.label}, ${who}`}>
                  <MoreHorizontal aria-hidden="true" strokeWidth={1.5} className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent size="menu" align="end" role="menu" aria-label="More">
                {MOVES.map((m) => (
                  <MenuOption
                    key={m.move}
                    onSelect={() => {
                      setMenu(false);
                      onMove(m.move);
                    }}
                  >
                    {m.label}
                  </MenuOption>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </li>
  );
}
