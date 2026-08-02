/**
 * The "how long did this take" control on the manual time-entry form.
 *
 * Quarter-hour steppers either side of a free-text field. Almost every
 * entry an MC writes up after the fact is a round number of quarter
 * hours, so those are one click away; the field stays typeable for the
 * rare entry that isn't.
 *
 * The text is only normalised on blur, never mid-keystroke: rewriting
 * `1h 3` to `1h 3m` while someone is still typing `1h 30m` moves the
 * caret out from under them.
 *
 * @module app/(dashboard)/couples/couple-time-duration-field
 */
'use client';

import { Minus, Plus } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DURATION_STEP_MINUTES,
  formatDurationInput,
  parseDurationInput,
  stepDurationMinutes,
} from '@/lib/time-tracking/duration';

export interface CoupleTimeDurationFieldProps {
  /** Current duration in whole minutes, or null while it is unreadable. */
  value: number | null;
  onChange: (minutes: number | null) => void;
}

/** Quarter-hour stepper with a typeable duration. See {@link CoupleTimeDurationFieldProps}. */
export function CoupleTimeDurationField({
  value,
  onChange,
}: CoupleTimeDurationFieldProps) {
  const labelId = useId();
  const [text, setText] = useState(() =>
    value === null ? '' : formatDurationInput(value),
  );

  const commit = (minutes: number) => {
    setText(formatDurationInput(minutes));
    onChange(minutes);
  };

  const step = (direction: 1 | -1) => {
    // Stepping from an unreadable field starts from zero, so the first
    // press lands on 15m rather than doing nothing.
    commit(stepDurationMinutes(value ?? 0, direction));
  };

  const invalid = text.trim() !== '' && value === null;

  return (
    <div>
      <span id={labelId} className="mb-1 block text-caption text-text-muted">
        Duration
      </span>
      <div className="flex w-56 max-w-full items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="w-8 shrink-0 cursor-pointer px-0"
          aria-label={`Less by ${DURATION_STEP_MINUTES} minutes`}
          onClick={() => step(-1)}
        >
          <Minus size={16} strokeWidth={1.5} />
        </Button>

        <Input
          size="sm"
          className="min-w-0 flex-1"
          inputMode="text"
          aria-labelledby={labelId}
          placeholder="1h 30m"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange(parseDurationInput(e.target.value));
          }}
          onBlur={() => {
            if (value !== null) setText(formatDurationInput(value));
          }}
          {...(invalid ? { 'aria-invalid': true } : {})}
        />

        <Button
          variant="outline"
          size="sm"
          className="w-8 shrink-0 cursor-pointer px-0"
          aria-label={`More by ${DURATION_STEP_MINUTES} minutes`}
          onClick={() => step(1)}
        >
          <Plus size={16} strokeWidth={1.5} />
        </Button>
      </div>
      {/* One line that swaps rather than an error appended below the
          field: the message lives outside the Input so the steppers stay
          centred on the field, and Save is already disabled, so this is
          the explanation rather than the alarm. */}
      <p
        className={`mt-1 text-caption ${invalid ? 'text-danger' : 'text-text-subtle'}`}
        {...(invalid ? { role: 'alert' } : {})}
      >
        {invalid ? 'Try 90, 1h 30m or 1:30.' : 'Steps by 15 minutes.'}
      </p>
    </div>
  );
}
