'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Modal } from '@/components/ui/modal';
import { TimeSelect } from '@/components/ui/time-select';

/**
 * Props for the add-override modal.
 */
export interface AvailabilityOverrideModalProps {
  isOpen: boolean;
  /** Save the override. The modal closes itself first. */
  onSave: (override: {
    date: string;
    available: boolean;
    start_time: string | null;
    end_time: string | null;
  }) => void;
  onClose: () => void;
}

/**
 * Add one date override: block the day entirely, or replace the weekly
 * hours with a one-off window.
 *
 * Overrides save immediately rather than joining the weekly editor's
 * Save changes batch, so this modal's primary action writes.
 */
export function AvailabilityOverrideModal({
  isOpen,
  onSave,
  onClose,
}: AvailabilityOverrideModalProps) {
  const [date, setDate] = useState('');
  const [isBlock, setIsBlock] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');

  const reset = () => {
    setDate('');
    setIsBlock(true);
    setStartTime('09:00');
    setEndTime('17:00');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = () => {
    if (!date) return;
    onSave({
      date,
      available: !isBlock,
      start_time: isBlock ? null : startTime,
      end_time: isBlock ? null : endTime,
    });
    reset();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add a date override"
      // `md`, matching the meeting-type and timezone modals on this page. At
      // `sm` the date field, the hours row and the explanation were all
      // fighting for 384px.
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!date}>
            Add override
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <span className="block text-body font-medium text-text">Date</span>
          <DatePicker value={date} onChange={setDate} placeholder="Pick a date" />
        </div>

        <Checkbox
          checked={isBlock}
          onChange={setIsBlock}
          label="Block the whole day"
        />

        {/* Always mounted, disabled when the whole day is blocked. Unmounting
            it made the modal grow and shrink under the cursor as the checkbox
            was ticked, moving the buttons the user was reaching for. */}
        <div className="space-y-1">
          <span
            className={`block text-body font-medium ${
              isBlock ? 'text-text-subtle' : 'text-text'
            }`}
          >
            Hours
          </span>
          <div className="flex items-center gap-2">
            {/* Each end takes half the row, so the pair stays balanced at
                every modal width instead of huddling on the left. */}
            <div className="flex-1">
              <TimeSelect
                value={startTime}
                onChange={setStartTime}
                placeholder="Start"
                disabled={isBlock}
              />
            </div>
            <span className="text-body text-text-muted">to</span>
            <div className="flex-1">
              <TimeSelect
                value={endTime}
                onChange={setEndTime}
                placeholder="End"
                disabled={isBlock}
              />
            </div>
          </div>
        </div>

        {/* One line reserved: both messages fit on a single line at this
            width, and a self-sizing paragraph would make the modal grow and
            shrink as the checkbox is ticked. */}
        <p className="text-body text-text-muted min-h-5">
          {isBlock
            ? 'Couples will not see any slots on this date.'
            : 'These hours replace the weekly ones for this date.'}
        </p>
      </div>
    </Modal>
  );
}
