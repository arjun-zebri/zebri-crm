'use client';

import { MeetingTypeFieldsBasics } from './meeting-type-fields-basics';
import { MeetingTypeFieldsScheduling } from './meeting-type-fields-scheduling';

interface MeetingTypeFieldsProps {
  name: string;
  setName: (value: string) => void;
  /** Validation message for the name field, shown after a failed save. */
  nameError?: string | undefined;
  description: string;
  setDescription: (value: string) => void;
  durationMinutes: string;
  setDurationMinutes: (value: string) => void;
  locationType: string;
  setLocationType: (value: string) => void;
  address: string;
  setAddress: (value: string) => void;
  minNoticeHours: string;
  setMinNoticeHours: (value: string) => void;
  maxAdvanceDays: string;
  setMaxAdvanceDays: (value: string) => void;
  reminderEnabled: boolean;
  setReminderEnabled: (value: boolean) => void;
}

/**
 * Compose basic and scheduling form fields for meeting types.
 *
 * @module app/(dashboard)/calendar/meeting-type-fields
 */
export function MeetingTypeFields({
  name,
  setName,
  nameError,
  description,
  setDescription,
  durationMinutes,
  setDurationMinutes,
  locationType,
  setLocationType,
  address,
  setAddress,
  minNoticeHours,
  setMinNoticeHours,
  maxAdvanceDays,
  setMaxAdvanceDays,
  reminderEnabled,
  setReminderEnabled,
}: MeetingTypeFieldsProps) {
  return (
    <div className="space-y-4">
      <MeetingTypeFieldsBasics
        name={name}
        setName={setName}
        nameError={nameError}
        description={description}
        setDescription={setDescription}
        durationMinutes={durationMinutes}
        setDurationMinutes={setDurationMinutes}
        locationType={locationType}
        setLocationType={setLocationType}
        address={address}
        setAddress={setAddress}
      />
      <MeetingTypeFieldsScheduling
        minNoticeHours={minNoticeHours}
        setMinNoticeHours={setMinNoticeHours}
        maxAdvanceDays={maxAdvanceDays}
        setMaxAdvanceDays={setMaxAdvanceDays}
        reminderEnabled={reminderEnabled}
        setReminderEnabled={setReminderEnabled}
      />
    </div>
  );
}
