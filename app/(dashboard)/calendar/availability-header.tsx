'use client';

import { Globe } from 'lucide-react';
import { useState } from 'react';

import { TimezonePickerModal } from '@/components/scheduling/timezone-picker-modal';
import { Button } from '@/components/ui/button';

/**
 * Props for the availability action bar.
 */
export interface AvailabilityHeaderProps {
  /** Currently selected IANA timezone. */
  timezone: string;
  /** Change handler for the timezone picker. */
  onTimezoneChange: (tz: string) => void;
  /** Open the inline override adder in the overrides card. */
  onAddOverride: () => void;
  /** True while the adder is already open, so the button reads as spent. */
  addingOverride: boolean;
  /** Whether the weekly schedule has unsaved edits. */
  dirty: boolean;
  /** Revert the weekly schedule to the last saved state. */
  onDiscard: () => void;
  /** Persist the weekly schedule. */
  onSave: () => void;
  /** Save in flight. */
  saving: boolean;
}

/**
 * Action bar above the editor: the MC's timezone on the left, then Add
 * an override, Discard and Save changes on the right.
 *
 * The timezone is a button rather than a select. There are 400-odd IANA
 * zones, which no dropdown handles well, so it opens a searchable modal
 * instead.
 */
export function AvailabilityHeader({
  timezone,
  onTimezoneChange,
  onAddOverride,
  addingOverride,
  dirty,
  onDiscard,
  onSave,
  saving,
}: AvailabilityHeaderProps) {
  const [pickingTimezone, setPickingTimezone] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button
        variant="outline"
        onClick={() => setPickingTimezone(true)}
        aria-label={`Timezone: ${timezone}. Change it`}
      >
        <Globe strokeWidth={1.5} className="mr-2 w-4 h-4 text-text-muted" />
        {timezone || 'Select timezone'}
      </Button>

      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onAddOverride} disabled={addingOverride}>
          Add an override
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
        )}
        <Button onClick={onSave} loading={saving} disabled={!dirty}>
          Save changes
        </Button>
      </div>

      <TimezonePickerModal
        isOpen={pickingTimezone}
        value={timezone}
        onSelect={onTimezoneChange}
        onClose={() => setPickingTimezone(false)}
      />
    </div>
  );
}
