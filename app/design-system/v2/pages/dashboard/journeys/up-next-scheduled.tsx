'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { MoreIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { StretchedButton } from '@/components/ui-v2/stretched-button';

import { CoupleAvatars } from '../payments/invoice-row';
import { coupleName } from '../payments/payments-data';

import type { QueueItem } from './up-next-data';
import { QUEUE_GRID, QUEUE_ROW, QUEUE_STILL, UNDER } from './up-next-rows';

/**
 * Something Zebri will send by itself, or something already done. Quiet
 * on purpose: no buttons, because nothing here needs the MC, and the
 * section heading already says Zebri sends it. Clicking the row reads
 * the message; the rarer moves (send it now, which opens the message
 * first; skip this one; pause this client; open the step on its journey)
 * live in a ⋯ menu. A done row says what happened instead.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/up-next-scheduled
 */

export type ScheduledMove = 'send' | 'skip' | 'pause' | 'read' | 'step';

const MOVES: { move: ScheduledMove; label: string }[] = [
  { move: 'send', label: 'Send it now' },
  { move: 'skip', label: 'Skip this one' },
  { move: 'pause', label: 'Pause for this client' },
  { move: 'step', label: 'Open the step' },
];

export interface ScheduledRowProps {
  item: QueueItem;
  /** The journey's name, under the couple. */
  journey: string;
  onMove: (move: ScheduledMove) => void;
}

/** A scheduled or done row. See {@link ScheduledRowProps}. */
export function ScheduledRow({ item, journey, onMove }: ScheduledRowProps) {
  const [menu, setMenu] = useState(false);
  const quiet = item.section === 'done' || Boolean(item.outcome);
  const who = coupleName(item.names);
  const title = (
    <>
      <span className={`block truncate type-label ${quiet ? 'text-zebra-500' : 'text-zebra-950'}`}>
        {item.label}
      </span>
      <span className="block truncate type-body text-zebra-500">
        {who} · {journey}
      </span>
    </>
  );
  return (
    <li>
      <div className={`${quiet ? QUEUE_STILL : QUEUE_ROW} ${QUEUE_GRID}`}>
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
        <p
          className={`row-start-2 type-body text-zebra-500 ${UNDER}`}
        >
          {item.outcome ?? item.why}
        </p>
        <span className={`row-start-3 type-body text-zebra-500 ${UNDER}`}>{item.when}</span>
        <div className="relative z-10 col-start-2 row-start-1 flex justify-end lg:col-start-4">
          {quiet ? null : (
            <Popover open={menu} onOpenChange={setMenu}>
              <PopoverTrigger asChild>
                <Button variant="ghost" square aria-label={`More for ${item.label}, ${who}`}>
                  <MoreIcon aria-hidden="true" className="size-4" />
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
