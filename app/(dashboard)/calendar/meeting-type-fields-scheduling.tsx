'use client';

import { Select, type SelectOption } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';

interface SchedulingProps {
  minNoticeHours: string;
  setMinNoticeHours: (value: string) => void;
  maxAdvanceDays: string;
  setMaxAdvanceDays: (value: string) => void;
  reminderEnabled: boolean;
  setReminderEnabled: (value: boolean) => void;
}

/**
 * Scheduling meeting type fields: notice, advance, reminder.
 *
 * Active/paused is deliberately absent. It lives on the meeting type card,
 * where it is one click, because pausing a link is the change an MC makes in a
 * hurry and it should not cost them opening a modal and saving a form.
 *
 * Buffers are deliberately absent from this form. The columns still exist and
 * the slot engine still honours them, but almost no MC could say what a
 * "buffer after" should be without being taught the concept first, and every
 * one of them left it at None. Two more dropdowns to skip past on the way to
 * saving is a real cost; the setting can come back as an advanced option if
 * anyone actually asks for it.
 *
 * @module app/(dashboard)/calendar/meeting-type-fields-scheduling
 */
export function MeetingTypeFieldsScheduling({
  minNoticeHours,
  setMinNoticeHours,
  maxAdvanceDays,
  setMaxAdvanceDays,
  reminderEnabled,
  setReminderEnabled,
}: SchedulingProps) {
  const noticeOptions: SelectOption[] = [
    { value: '0', label: 'None' },
    { value: '4', label: '4 hours' },
    { value: '12', label: '12 hours' },
    { value: '24', label: '24 hours' },
    { value: '48', label: '48 hours' },
  ];

  const advanceOptions: SelectOption[] = [
    { value: '14', label: '14 days' },
    { value: '30', label: '30 days' },
    { value: '60', label: '60 days' },
    { value: '90', label: '90 days' },
    { value: '180', label: '180 days' },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Minimum notice"
          tooltip="The least warning you will accept. Couples cannot book a time sooner than this."
          value={minNoticeHours}
          onValueChange={setMinNoticeHours}
          options={noticeOptions}
        />

        <Select
          label="Maximum advance"
          tooltip="The furthest ahead couples can book. Times beyond this are not offered."
          value={maxAdvanceDays}
          onValueChange={setMaxAdvanceDays}
          options={advanceOptions}
        />
      </div>

      {/* A switch rather than a checkbox so this row shares a rail with the
          availability switch below it: a 16px box and a 36px pill start their
          labels 20px apart, which reads as a wonky column. */}
      <div className="space-y-4 border-t border-border pt-3">
        <Toggle
          label="Send a reminder email 24 hours before"
          checked={reminderEnabled}
          onChange={setReminderEnabled}
        />
      </div>
    </>
  );
}
