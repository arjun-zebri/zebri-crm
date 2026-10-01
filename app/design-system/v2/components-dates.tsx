'use client';

import { useState } from 'react';

import { DateField } from '@/components/ui-v2/date-field';
import { DateRangePicker, type DateRange } from '@/components/ui-v2/date-range-picker';
import { RangeCalendar } from '@/components/ui-v2/range-calendar';

import { Demo, Group, Spec } from './showroom-v2';

/**
 * v2 date pieces: the typed date field, the range calendar and the two
 * together as the date range picker (as in the Payments period control's
 * Custom range). Client-side for the live values.
 *
 * @module app/design-system/v2/components-dates
 */

/** The Dates group. */
export function ComponentsDatesV2() {
  const [date, setDate] = useState('2026-10-10');
  const [range, setRange] = useState<DateRange>({ from: '2026-07-10', to: '2026-07-24' });
  const [cal, setCal] = useState<DateRange>({ from: '2026-10-03', to: '2026-10-11' });
  return (
    <Group id="dates" title="Dates">
      <Spec
        name="Date field"
        file="components/ui-v2/date-field.tsx"
        description="A date typed the way people type it: 1 Jul 2026, 1/7/26 or 2026-07-01, day first. On leaving the field it reads the date back as 1 Jul 2026, so there is no doubt which date it took; something it cannot read shows an error under the field instead of a guess."
      >
        <div className="w-60">
          <DateField label="Wedding date" value={date} onChange={setDate} />
        </div>
      </Spec>
      <Spec
        name="Range calendar"
        file="components/ui-v2/range-calendar.tsx"
        description="One month, Monday first, 32px days so it fits a popover. Give the same day as from and to to pick a single date, and `min` to grey out and disable the days before it (an event date in New client cannot be in the past). The ends are filled grass circles and the days between sit on a soft grass band, so a range reads as one shape. It only reports clicks; the caller decides which end a click sets."
      >
        <div className="w-72">
          <RangeCalendar
            from={cal.from}
            to={cal.to}
            today="2026-09-27"
            initialMonth="2026-10"
            onPick={(iso) => setCal((r) => (r.to || iso < r.from ? { from: iso, to: '' } : { from: r.from, to: iso }))}
          />
        </div>
      </Spec>
      <Spec
        name="Date range picker"
        file="components/ui-v2/date-range-picker.tsx"
        description="From and To fields over the range calendar: type either end or click a start then an end. Focusing a field makes the next click set that end. Never backwards: an end before the start swaps them. Sized for a card popover; the Payments period control's Custom range uses it."
      >
        <Demo label="In a card popover">
          <div className="w-80 rounded-panel bg-field p-4 shadow-lg ring-1 ring-zebra-950/5">
            <DateRangePicker value={range} onChange={setRange} today="2026-09-27" />
          </div>
        </Demo>
      </Spec>
    </Group>
  );
}
