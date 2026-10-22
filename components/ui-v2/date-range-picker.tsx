'use client';

import { useState } from 'react';

import { DateField } from '@/components/ui-v2/date-field';
import { RangeCalendar } from '@/components/ui-v2/range-calendar';

/**
 * Design system v2 date range picker (preview): From and To date fields
 * over a range calendar, so a range can be typed or clicked. Clicking
 * works the way people expect: the first click sets the start, the next
 * the end; a click before the start begins a new range. Focusing a field
 * makes the next click set that end, and the field shows it is the one
 * being set. Typed dates are read by `DateField`. The value is a pair of
 * local "YYYY-MM-DD" strings, never backwards: an end before the start
 * swaps them. Sized for a `card` popover.
 *
 * @example
 * ```tsx
 * <DateRangePicker value={range} onChange={setRange} />
 * ```
 *
 * @module components/ui-v2/date-range-picker
 */

/** A range of days, "YYYY-MM-DD" each, inclusive. */
export interface DateRange {
  from: string;
  to: string;
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (r: DateRange) => void;
  /** Today, "YYYY-MM-DD"; the real date when left out. */
  today?: string | undefined;
}

/** Keeps a range the right way round. */
const ordered = (a: string, b: string): DateRange => (b && a > b ? { from: b, to: a } : { from: a, to: b });

/** v2 date range picker. See {@link DateRangePickerProps}. */
export function DateRangePicker({ value, onChange, today }: DateRangePickerProps) {
  // Which end the next calendar click sets.
  const [setting, setSetting] = useState<'from' | 'to'>('from');
  const pick = (iso: string) => {
    if (setting === 'to' && iso >= value.from) {
      onChange({ from: value.from, to: iso });
      setSetting('from');
    } else {
      onChange({ from: iso, to: '' });
      setSetting('to');
    }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <DateField
          label="From"
          value={value.from}
          active={setting === 'from'}
          onFocus={() => setSetting('from')}
          onChange={(from) => onChange(ordered(from, value.to))}
        />
        <DateField
          label="To"
          value={value.to}
          active={setting === 'to'}
          onFocus={() => setSetting('to')}
          onChange={(to) => onChange(ordered(value.from, to))}
        />
      </div>
      {/* Keyed by the start's month, so typing a start date turns the calendar to it. */}
      <RangeCalendar key={(value.from || today || '').slice(0, 7)} from={value.from} to={value.to} onPick={pick} today={today} />
    </div>
  );
}
