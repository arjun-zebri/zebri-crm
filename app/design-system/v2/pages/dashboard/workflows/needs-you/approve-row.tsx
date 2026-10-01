import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { StretchedButton } from '@/components/ui-v2/stretched-button';
import { Swap } from '@/components/ui-v2/swap';

import { CoupleAvatars } from '../../payments/invoice-row';
import { coupleName } from '../../payments/payments-data';
import type { QueueItem } from '../queue-data';

import { QUEUE_GRID, QUEUE_ROW, UNDER } from './queue-row';

/**
 * A send waiting for the MC's OK: who it is for, what it is and which
 * workflow sent it, then Zebri's one line of why it is going now and
 * when it was planned to go (it holds until sent). The message is
 * already written for this client. Send (or the row) opens it to read
 * and change first; nothing goes from the row itself, because nobody
 * sends money reminders they have not seen. Once sent from the dialog
 * the button hands over to a Sent tick in place, so the row never jumps
 * under the pointer before it moves to Done.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/needs-you/approve-row
 */

export interface ApproveRowProps {
  item: QueueItem;
  workflow: string;
  sending: boolean;
  /** Opens the message to read and send. */
  onOpen: () => void;
}

/** An approval row. See {@link ApproveRowProps}. */
export function ApproveRow({ item, workflow, sending, onOpen }: ApproveRowProps) {
  const who = coupleName(item.names);
  return (
    <li>
      <div className={`${QUEUE_ROW} ${QUEUE_GRID}`}>
        <div className="flex min-w-0 items-center gap-3">
          <CoupleAvatars names={item.names} />
          <StretchedButton label={`Read ${item.label} for ${who}`} onClick={onOpen}>
            <span className="block truncate type-label text-zebra-950">{item.label}</span>
            <span className="block truncate type-body text-zebra-600">
              {who} · {workflow}
            </span>
          </StretchedButton>
        </div>
        <p className={`row-start-2 type-body text-zebra-700 ${UNDER}`}>{item.why}</p>
        <span className={`row-start-3 type-body text-zebra-600 ${UNDER}`}>{item.when}</span>
        <div className="relative z-10 col-start-2 row-start-1 flex justify-end lg:col-start-4">
          <Swap
            active={item.outcome ? 'sent' : 'ready'}
            className="justify-items-end"
            states={{
              ready: (
                <Button variant="secondary" loading={sending} onClick={onOpen} aria-label={`Send ${item.label} to ${who}`}>
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
