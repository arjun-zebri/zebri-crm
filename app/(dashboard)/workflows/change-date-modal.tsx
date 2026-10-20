'use client';

/**
 * Move one step to a day the MC picks, from the Upcoming row menu.
 *
 * The row menu only offered "Tomorrow" and "Next week", and an MC who
 * needed a to-do on a particular day went looking there and concluded
 * it could not be done (ZEB-125). The detail modal's date field only
 * exists on manual steps, so this is also the one way to move a send.
 *
 * Picking a day is the save: a calendar with a separate Save button is
 * two decisions for one.
 *
 * @module app/(dashboard)/workflows/change-date-modal
 */

import { DatePicker } from '@/components/ui/date-picker';
import { Modal } from '@/components/ui/modal';
import type { QueueItem } from '@/lib/workflows/queue';

import { onDate } from './queue-labels';

export interface ChangeDateModalProps {
  /** The step being moved, or null when the modal is closed. */
  item: QueueItem | null;
  onClose: () => void;
  /** Called with the step and its new due instant. */
  onPick: (stepId: string, dueAt: string) => void;
}

/** The Change date modal. See {@link ChangeDateModalProps}. */
export function ChangeDateModal({ item, onClose, onPick }: ChangeDateModalProps) {
  return (
    <Modal isOpen={item !== null} onClose={onClose} title="Change date" size="sm">
      {item ? (
        <div className="space-y-3">
          <p className="truncate text-body text-text-muted">{item.title}</p>
          {/* Keyed on the step so the calendar opens on this step's
              month, not the last one's. Not clearable: a step with no
              date is never run. */}
          <DatePicker
            key={item.stepId}
            calendarOnly
            clearable={false}
            value={item.dueAt ? new Date(item.dueAt).toLocaleDateString('en-CA') : ''}
            onChange={(date) => {
              if (!date) return;
              onPick(item.stepId, onDate(item.dueAt, date));
              onClose();
            }}
          />
        </div>
      ) : null}
    </Modal>
  );
}
