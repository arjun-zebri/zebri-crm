import { Button } from '@/components/ui-v2/button';
import { Checkbox } from '@/components/ui-v2/checkbox';

import { coupleName } from '../../payments/payments-data';
import type { QueueItem } from '../queue-data';

import { QUEUE_GRID, QUEUE_ROW, UNDER } from './queue-row';

/**
 * One of the MC's own to-dos: a box to tick, what it is, who it is for
 * and which workflow put it there, Zebri's why, and when it is due (late
 * in red, and then it leads the page in the Late section). Ticking it is
 * the whole job; everything the workflow holds behind it then moves on.
 * A ticked row says so in place, with Undo, before it folds into Done.
 *
 * The box sits centred in the same 3.5rem slot a couple's avatars fill
 * on the other rows, so every title starts on one edge.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/needs-you/todo-row
 */

export interface TodoRowProps {
  item: QueueItem;
  workflow: string;
  onTick: () => void;
  onUndo: () => void;
}

/** A to-do row. See {@link TodoRowProps}. */
export function TodoRow({ item, workflow, onTick, onUndo }: TodoRowProps) {
  const done = Boolean(item.outcome);
  const late = item.late && !done;
  return (
    <li>
      <div className={`${QUEUE_ROW} cursor-default ${QUEUE_GRID}`}>
        {/* pl-5 centres the 1rem box in the 3.5rem slot; gap-8 lands the
            text on the avatar rows' title edge (3.5rem + 0.75rem). */}
        <Checkbox
          checked={done}
          onChange={() => (done ? onUndo() : onTick())}
          className="min-w-0 gap-8 pl-5"
          label={
            <span className="min-w-0">
              <span className={`block truncate type-label ${done ? 'text-zebra-500 line-through' : 'text-zebra-950'}`}>{item.label}</span>
              <span className="block truncate type-body text-zebra-600">
                {coupleName(item.names)} · {workflow}
              </span>
            </span>
          }
        />
        <p className={`row-start-2 type-body text-zebra-700 ${UNDER}`}>{done ? item.outcome : item.why}</p>
        <span className={`row-start-3 type-body ${UNDER} ${late ? 'text-danger' : 'text-zebra-600'}`}>{item.when}</span>
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
