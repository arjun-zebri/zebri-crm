import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { Checkbox } from '@/components/ui-v2/checkbox';
import { ROW } from '@/components/ui-v2/control-styles';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { StretchedButton } from '@/components/ui-v2/stretched-button';
import { Swap } from '@/components/ui-v2/swap';

import { CoupleAvatars } from '../payments/invoice-row';
import { coupleName } from '../payments/payments-data';

import type { QueueItem } from './up-next-data';

/**
 * The rows of Journeys' Up next that wait on the MC, and the layout
 * every Up next row shares so the columns line up across sections: who
 * and what (the couple, then which journey), Zebri's why, when, then the
 * row's one control. A held send opens to read first (nothing goes from
 * the row, because nobody sends a money reminder they have not seen)
 * and hands over to a Sent tick in place. A to-do is a box to tick, late
 * in red, with Undo once ticked. The to-do's box sits in the same 3.5rem
 * slot a couple's avatars fill, so every title starts on one edge.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/up-next-rows
 */

/** The row's shape: the Payments row's, with less padding. */
const QUEUE_SHAPE = 'relative grid gap-x-8 gap-y-1 rounded-button px-3 py-3';

/** A row that opens something: the shape with the house ROW recipe (hover fill, focus mark, 150ms). */
export const QUEUE_ROW = `${QUEUE_SHAPE} ${ROW}`;

/** A row that only holds its own control (a to-do's box): the shape, no hover, as nothing opens. */
export const QUEUE_STILL = QUEUE_SHAPE;

/** Phones: title and action on one line, the rest under. Desktop: four columns. */
export const QUEUE_GRID =
  'grid-cols-[minmax(0,1fr)_auto] items-center lg:grid-cols-[minmax(14rem,1fr)_minmax(0,2fr)_8rem_7rem] lg:gap-x-6';

/** A line under the title on phones, indented to the title's edge; its own column on desktop. */
export const UNDER = 'col-span-full pl-17 lg:col-span-1 lg:row-start-auto lg:pl-0';

interface RowProps {
  item: QueueItem;
  /** The journey's name, under the couple. */
  journey: string;
}

/** A send waiting for the MC's OK. */
export function ApproveRow({
  item,
  journey,
  sending,
  onOpen,
}: RowProps & { sending: boolean; onOpen: () => void }) {
  const who = coupleName(item.names);
  return (
    <li>
      <div className={`${QUEUE_ROW} ${QUEUE_GRID}`}>
        <div className="flex min-w-0 items-center gap-3">
          <CoupleAvatars names={item.names} />
          <StretchedButton label={`Read ${item.label} for ${who}`} onClick={onOpen}>
            <span className="block truncate type-label text-zebra-950">{item.label}</span>
            <span className="block truncate type-body text-zebra-500">
              {who} · {journey}
            </span>
          </StretchedButton>
        </div>
        <p className={`row-start-2 type-body text-zebra-500 ${UNDER}`}>{item.why}</p>
        <span className={`row-start-3 type-body text-zebra-500 ${UNDER}`}>{item.when}</span>
        <div className="relative z-10 col-start-2 row-start-1 flex justify-end lg:col-start-4">
          <Swap
            active={item.outcome ? 'sent' : 'ready'}
            className="justify-items-end"
            states={{
              ready: (
                <Button
                  variant="secondary"
                  loading={sending}
                  onClick={onOpen}
                  aria-label={`Send ${item.label} to ${who}`}
                >
                  Send
                </Button>
              ),
              sent: (
                <Badge size="control" tone="brand">
                  <DrawnCheck className="size-3.5" />
                  Sent
                </Badge>
              ),
            }}
          />
        </div>
      </div>
    </li>
  );
}

/** One of the MC's own to-dos. */
export function TodoRow({
  item,
  journey,
  onTick,
  onUndo,
}: RowProps & { onTick: () => void; onUndo: () => void }) {
  const done = Boolean(item.outcome);
  const late = item.late && !done;
  return (
    <li>
      <div className={`${QUEUE_STILL} ${QUEUE_GRID}`}>
        {/* pl-5 centres the 1rem box in the 3.5rem slot; gap-8 lands the text on the avatar rows' title edge. */}
        <Checkbox
          checked={done}
          onChange={() => (done ? onUndo() : onTick())}
          className="min-w-0 gap-8 pl-5"
          label={
            <span className="min-w-0">
              <span
                className={`block truncate type-label ${done ? 'text-zebra-500 line-through' : 'text-zebra-950'}`}
              >
                {item.label}
              </span>
              <span className="block truncate type-body text-zebra-500">
                {coupleName(item.names)} · {journey}
              </span>
            </span>
          }
        />
        <p className={`row-start-2 type-body text-zebra-500 ${UNDER}`}>
          {done ? item.outcome : item.why}
        </p>
        <span
          className={`row-start-3 type-body ${UNDER} ${late ? 'text-danger' : 'text-zebra-500'}`}
        >
          {item.when}
        </span>
        <div className="col-start-2 row-start-1 flex justify-end lg:col-start-4">
          {done ? (
            <Button variant="plain" onClick={onUndo}>
              Undo
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
