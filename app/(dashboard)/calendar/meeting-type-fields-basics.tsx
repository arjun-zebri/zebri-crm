'use client';

import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface BasicsProps {
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  /** Validation message for the name field, shown after a failed save. */
  nameError?: string | undefined;
  durationMinutes: string;
  setDurationMinutes: (value: string) => void;
  locationType: string;
  setLocationType: (value: string) => void;
  address: string;
  setAddress: (value: string) => void;
}

/**
 * Basic meeting type fields: name, description, duration, location.
 *
 * @module app/(dashboard)/calendar/meeting-type-fields-basics
 */
export function MeetingTypeFieldsBasics({
  name,
  setName,
  description,
  setDescription,
  nameError,
  durationMinutes,
  setDurationMinutes,
  locationType,
  setLocationType,
  address,
  setAddress,
}: BasicsProps) {
  const durationOptions: SelectOption[] = [
    { value: '15', label: '15 minutes' },
    { value: '30', label: '30 minutes' },
    { value: '45', label: '45 minutes' },
    { value: '60', label: '1 hour' },
    { value: '90', label: '1.5 hours' },
    { value: '120', label: '2 hours' },
    { value: '150', label: '2.5 hours' },
    { value: '180', label: '3 hours' },
    { value: '240', label: '4 hours' },
    { value: '300', label: '5 hours' },
  ];

  const locationOptions: SelectOption[] = [
    { value: 'video', label: 'Video call' },
    { value: 'phone', label: 'Phone call' },
    { value: 'in_person', label: 'In person' },
  ];

  return (
    <>
      <Input
        label="Name"
        placeholder="e.g. Consultation Call"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        {...(nameError ? { error: nameError } : {})}
      />

      <Textarea
        label="Description"
        placeholder="What is this meeting type about?"
        rows={3}
        resizable={false}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Duration"
          value={durationMinutes}
          onValueChange={setDurationMinutes}
          options={durationOptions}
        />

        <Select
          label="Location type"
          value={locationType}
          onValueChange={setLocationType}
          options={locationOptions}
        />
      </div>

      {locationType === 'in_person' && (
        <Input
          label="Address"
          placeholder="Street address or venue name"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      )}
    </>
  );
}
